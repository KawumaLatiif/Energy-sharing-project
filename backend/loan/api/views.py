import logging
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from accounts.models import generate_random_string
from meter.models import Meter
from meter.services import push_units_to_thingsboard
from meter.api.serializers import MeterSerializer
from loan.models import ElectricityTariff, LoanApplication, LoanDisbursement, LoanRepayment
from transactions.models import UnitTransaction, TransactionLog, TransactionType
from loan.api.serializers import ElectricityTariffSerializer, LoanApplicationCreateSerializer, LoanApplicationSerializer
from loan.models import get_tier_by_score
from meter.models import MeterNotification
from meter.notifications import create_system_notification
from loan.scoring import (
    calculate_weighted_credit_score,
    get_or_create_dummy_credit_signal,
    get_factor_breakdown,
    FACTOR_WEIGHTS,
)
from wallet.models import Wallet as UnitWallet
from utils.general import dispatch_task
from accounts.tasks import handle_send_loan_application_email

logger = logging.getLogger(__name__)


class TariffListView(generics.ListAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = ElectricityTariffSerializer
    
    def get_queryset(self):
        return ElectricityTariff.objects.filter(is_active=True)

class LoanApplicationView(generics.ListCreateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = LoanApplicationCreateSerializer  

    def get_serializer_class(self):
        if self.request.method == "POST":
            return LoanApplicationCreateSerializer
        return LoanApplicationSerializer  

    def create(self, request, *args, **kwargs):
        try:
            data = request.data
            
            # Prevent multiple active loans
            from loan.services import user_can_apply_for_loan

            can_apply, apply_message = user_can_apply_for_loan(request.user)
            if not can_apply:
                return Response(
                    {"error": apply_message},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if user has a meter first
            try:
                meter = Meter.objects.get(user=request.user)
            except Meter.DoesNotExist:
                return Response(
                    {"error": "No meter found. Please register your meter before applying for a loan."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)

            from utils.billing import get_active_domestic_tariff

            tariff = get_active_domestic_tariff()

            # Collect third-party credit signals (dummy for now) and score user
            credit_signal = get_or_create_dummy_credit_signal(request.user)
            credit_score = self.calculate_credit_score(credit_signal)
            credit_breakdown = get_factor_breakdown(credit_signal)

            # Determine approved amount and tier
            amount_requested = float(data.get("amount_requested", 0))
            tier_info = self.determine_loan_tier(credit_score)
            
            if tier_info:
                tier_name, max_amount, interest_rate = tier_info
                amount_approved = min(max_amount, amount_requested)
            else:
                amount_approved = 0
                tier_name = None
                interest_rate = 10.0

            # Save loan - DON'T disburse automatically
            loan = serializer.save(
                user=request.user,
                credit_score=credit_score,
                amount_approved=amount_approved if amount_approved > 0 else None,
                loan_tier=tier_name,
                interest_rate=interest_rate,
                tariff = tariff,
                status="APPROVED" if amount_approved > 0 else "REJECTED",
                rejection_reason="" if amount_approved > 0 else "Credit score below 75%"
            )

            # Log application
            TransactionLog.objects.create(
                user=request.user,
                transaction_type=TransactionType.LOAN_APPLICATION,
                amount=amount_requested,
                status=loan.status,
                reference_id=loan.loan_id,
                details={
                    'purpose': loan.purpose,
                    'tenure_months': loan.tenure_months,
                    'credit_score': credit_score,
                    'loan_tier': tier_name,
                    'amount_approved': float(amount_approved) if amount_approved else 0
                }
            )
            create_system_notification(
                user=request.user,
                notification_type=MeterNotification.TYPE_LOAN_APPLICATION,
                message=(
                    f"Loan application {loan.loan_id}: {loan.status}. "
                    f"Requested UGX {amount_requested:,.2f}, "
                    f"approved UGX {float(amount_approved):,.2f}."
                ),
                units_kwh=Decimal("0"),
            )
            dispatch_task(
                handle_send_loan_application_email,
                request.user.id,
                loan.loan_id,
                loan.status,
                amount_requested,
                float(amount_approved or 0),
            )

            # Calculate units based on tariff (for response)
            if tariff and amount_approved:
                units_calculated = loan.calculate_units_from_amount()
                cost_breakdown = self.get_cost_breakdown(loan, float(amount_approved))
            else:
                units_calculated = amount_approved / 500 
                cost_breakdown = None

            response_data = {
                "loan_id": loan.loan_id,
                "credit_score": credit_score,
                "status": loan.status,
                "amount_requested": amount_requested,
                "amount_approved": float(amount_approved) if amount_approved > 0 else 0,
                "loan_tier": tier_name,
                "max_eligible_amount": tier_info[1] if tier_info else 0,
                "interest_rate": interest_rate,
                "tariff_applied": tariff.tariff_code if tariff else None,
                "units_calculated": units_calculated,
                "cost_breakdown": cost_breakdown,
                "credit_factors": {
                    "payment_history": credit_signal.payment_history,
                    "energy_consumption": credit_signal.energy_consumption,
                    "financial_capacity": credit_signal.financial_capacity,
                    "major_weights": FACTOR_WEIGHTS,
                    "factor_scores": credit_breakdown["factor_scores"],
                    "subfactor_scores": credit_breakdown["subfactor_scores"],
                    "threshold": 75,
                    "source": credit_signal.source,
                },
            }

            if loan.status == "APPROVED":
                response_data.update({
                    "message": f"Loan approved! You qualified for {tier_name} tier. Go to 'My Loans' to disburse and receive your electricity units."
                })
            else:
                response_data.update({
                    "rejection_reason": loan.rejection_reason
                })

            return Response(response_data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Loan application error: {str(e)}")
            return Response(
                {"error": f"Failed to submit loan application: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def calculate_credit_score(self, credit_signal):
        """Compute 0-100 score from weighted third-party factors."""
        return max(0, min(calculate_weighted_credit_score(credit_signal), 100))

    def get_cost_breakdown(self, loan, amount):
        """Calculate detailed cost breakdown for block tariff"""
        if not loan.tariff:
            return None
    
        blocks = loan.tariff.blocks.all().order_by('block_order')
        breakdown = []
        remaining_amount = amount
    
        for block in blocks:
            if remaining_amount <= 0:
                break
            
            if block.max_units:
                block_units_available = block.max_units - block.min_units + 1
                block_cost = block_units_available * float(block.rate_per_unit)
            
                if remaining_amount >= block_cost:
                    # Full block
                    units_from_block = block_units_available
                    cost_from_block = block_cost
                    remaining_amount -= block_cost
                else:
                    # Partial block
                    units_from_block = remaining_amount / float(block.rate_per_unit)
                    cost_from_block = remaining_amount
                    remaining_amount = 0
            else:
                # Last block - use all remaining amount
                units_from_block = remaining_amount / float(block.rate_per_unit)
                cost_from_block = remaining_amount
                remaining_amount = 0
        
            breakdown.append({
                'block_name': block.block_name,
                'units': round(units_from_block, 2),
                'rate': float(block.rate_per_unit),
                'cost': round(cost_from_block, 2),
                'block_range': f"{block.min_units}-{block.max_units if block.max_units else '∞'}"
            })
    
        return breakdown
    # def determine_loan_tier(self, score):
    #     """Determine loan tier, maximum amount, and interest rate based on credit score"""
    #     tiers = [
    #         {'min_score': 75, 'max_score': 79, 'name': 'BRONZE', 'max_amount': 50000, 'interest_rate': 12.0},
    #         {'min_score': 80, 'max_score': 84, 'name': 'SILVER', 'max_amount': 100000, 'interest_rate': 11.0},
    #         {'min_score': 85, 'max_score': 89, 'name': 'GOLD', 'max_amount': 150000, 'interest_rate': 10.0},
    #         {'min_score': 90, 'max_score': 100, 'name': 'PLATINUM', 'max_amount': 200000, 'interest_rate': 9.0}
    #     ]
        
    #     for tier in tiers:
    #         if tier['min_score'] <= score <= tier['max_score']:
    #             return tier['name'], tier['max_amount'], tier['interest_rate']
    #     return None
    def determine_loan_tier(self, score):
        """Determine loan tier, maximum amount, and interest rate based on credit score"""
        tier_info = get_tier_by_score(score)
    
        if tier_info:
            return tier_info['name'], tier_info['max_amount'], tier_info['interest_rate']
        return None

    def determine_approved_amount(self, score, requested_amount):
        """Determine approved loan amount based on credit score tier"""
        tier_info = self.determine_loan_tier(score)
        if not tier_info:
            return 0
        
        tier_name, max_amount, interest_rate = tier_info
        return min(max_amount, requested_amount)

    def get_queryset(self):
        # For GET requests, return user's loans
        if self.request.method == "GET":
            return LoanApplication.objects.filter(user=self.request.user)
        return LoanApplication.objects.none()

class UserLoansView(generics.ListAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = LoanApplicationSerializer
    
    def get_queryset(self):
        return LoanApplication.objects.filter(user=self.request.user)

class LoanDetailView(generics.RetrieveAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = LoanApplicationSerializer
    
    def get_queryset(self):
        return LoanApplication.objects.filter(user=self.request.user)

# class LoanRepaymentView(APIView):
#     permission_classes = (IsAuthenticated,)
    
#     def post(self, request, loan_id):
#         try:
#             loan = LoanApplication.objects.get(id=loan_id, user=request.user)
            
#             if loan.status != 'DISBURSED':
#                 return Response({"error": "Loan is not disbursed or already completed"}, status=status.HTTP_400_BAD_REQUEST)
            
#             amount = float(request.data.get('amount', 0))
            
#             if amount <= 0:
#                 return Response({"error": "Invalid amount"}, status=status.HTTP_400_BAD_REQUEST)
            
#             if amount > loan.outstanding_balance:
#                 return Response({"error": "Amount exceeds outstanding balance"}, status=status.HTTP_400_BAD_REQUEST)
            
#              # Calculate units equivalent based on tariff block rates
#             if loan.tariff:
#                 units_equivalent = loan.calculate_units_from_amount(amount)
#                 cost_breakdown = self.get_repayment_breakdown(loan, amount)
#                 tariff_info = {
#                     'tariff_code': loan.tariff.tariff_code,
#                     'cost_breakdown': cost_breakdown
#                 }
#             else:
#                 # Default calculation (500 UGX per unit)
#                 units_equivalent = round(amount / 500)
#                 tariff_info = {
#                     'tariff_code': 'DEFAULT',
#                     'rate_used': 500
#                 }
            
#             with transaction.atomic():
#                 # Generate payment reference
#                 payment_ref = generate_random_string(12)
                
#                 # Create repayment record
#                 repayment = LoanRepayment.objects.create(
#                     loan=loan,
#                     amount_paid=amount,
#                     units_paid=units_equivalent,
#                     payment_reference=payment_ref,
#                     is_on_time=self.check_payment_timeliness(loan)
#                 )
                
#                 # Add units to user's meter
#                 try:
#                     meter = Meter.objects.get(user=request.user)
#                     meter.units += units_equivalent
#                     meter.save()

#                     # Log repayment
#                     TransactionLog.objects.create(
#                         user=request.user,
#                         transaction_type=TransactionType.LOAN_REPAYMENT,
#                         amount=amount,
#                         units=units_equivalent,
#                         status='COMPLETED',
#                         reference_id=loan.loan_id,
#                         details={
#                             'payment_reference': payment_ref,
#                             'units_added': float(units_equivalent)
#                         }
#                     )
                    
#                     # SKIP UnitTransaction creation for now to avoid errors
#                     logger.info(f"Repayment processed. Loan: {loan.loan_id}, Amount: {amount}, Units: {units_equivalent}")
                    
#                 except Meter.DoesNotExist:
#                     return Response({"error": "Meter not found"}, status=status.HTTP_400_BAD_REQUEST)
                
#                 # Check if loan is fully paid
#                 if loan.outstanding_balance <= 0:
#                     loan.status = 'COMPLETED'
#                     loan.save()
            
#             return Response({
#                 "message": "Payment successful", 
#                 "units_added": round(units_equivalent,2),
#                 "payment_reference": payment_ref,
#                 "tariff_info": tariff_info,
#                 "outstanding_balance": loan.outstanding_balance
#             })
            
#         except LoanApplication.DoesNotExist:
#             return Response({"error": "Loan not found"}, status=status.HTTP_404_NOT_FOUND)
#         except Exception as e:
#             logger.error(f"Repayment error: {str(e)}")
#             return Response(
#                 {"error": f"Failed to process repayment: {str(e)}"}, 
#                 status=status.HTTP_500_INTERNAL_SERVER_ERROR
#             )
        
#     def get_repayment_breakdown(self, loan, amount):
#         """Calculate breakdown for repayment amount"""
#         if not loan.tariff:
#             return None
        
#         return loan.calculate_cost_for_units(loan.calculate_units_from_amount(amount))
    
#     def check_payment_timeliness(self, loan):
#         return True

class LoanRepaymentView(APIView):
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, loan_id):
        try:
            from loan.services import LoanOperationError, repay_loan

            result = repay_loan(
                request.user,
                loan_id,
                request.data.get("amount", 0),
                channel="WEB",
                payment_method="CASH",
            )
            return Response(
                {
                    "message": result["message"],
                    "units_added": result["units_added"],
                    "payment_reference": result["payment_reference"],
                    "outstanding_balance": result["outstanding_balance"],
                    "loan_status": result["loan_status"],
                }
            )

        except LoanOperationError as exc:
            return Response({"error": exc.message}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Repayment error: {str(e)}")
            return Response(
                {"error": f"Failed to process repayment: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get_repayment_breakdown(self, loan, amount):
        """Calculate breakdown for repayment amount"""
        if not loan.tariff:
            return None
        return loan.calculate_cost_for_units(loan.calculate_units_from_amount(amount))
    
    def check_payment_timeliness(self, loan):
        """Check if payment is on time"""
        if not loan.due_date:
            return True
        return timezone.now() <= loan.due_date


class LoanDisbursementView(APIView):
    permission_classes = (IsAuthenticated,)
    
    def get_cost_breakdown(self, loan, amount):
        """Calculate detailed cost breakdown for block tariff"""
        if not loan.tariff:
            return None
        
        blocks = loan.tariff.blocks.all().order_by('block_order')
        breakdown = []
        remaining_amount = amount
        
        for block in blocks:
            if remaining_amount <= 0:
                break
                
            if block.max_units:
                block_units_available = block.max_units - block.min_units + 1
                block_cost = block_units_available * float(block.rate_per_unit)
                
                if remaining_amount >= block_cost:
                    units_from_block = block_units_available
                    cost_from_block = block_cost
                    remaining_amount -= block_cost
                else:
                    units_from_block = remaining_amount / float(block.rate_per_unit)
                    cost_from_block = remaining_amount
                    remaining_amount = 0
            else:
                units_from_block = remaining_amount / float(block.rate_per_unit)
                cost_from_block = remaining_amount
                remaining_amount = 0
            
            breakdown.append({
                'block_name': block.block_name,
                'units': round(units_from_block, 2),
                'rate': float(block.rate_per_unit),
                'cost': round(cost_from_block, 2),
                'block_range': f"{block.min_units}-{block.max_units if block.max_units else 'inf'}"
            })
        
        return breakdown
    
    def post(self, request, loan_id):
        try:
            from loan.services import LoanOperationError, disburse_loan

            result = disburse_loan(request.user, loan_id, channel="WEB")
            return Response(
                {
                    "message": "Loan disbursed successfully to your unit wallet!",
                    "units_added_to_wallet": result["units_disbursed"],
                    "units_disbursed": result["units_disbursed"],
                    "meter_push": {
                        "status": "OK" if result["meter_push_ok"] else "FAILED",
                        "message": result["meter_push_message"],
                    },
                }
            )

        except LoanOperationError as exc:
            return Response({"error": exc.message}, status=status.HTTP_400_BAD_REQUEST)
        except LoanApplication.DoesNotExist:
            return Response({"error": "Loan not found"}, status=status.HTTP_404_NOT_FOUND)
        except Meter.DoesNotExist:
            return Response({"error": "No meter found for this account. Please register your meter first."}, status=400)

class LoanNotificationView(APIView):
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, loan_id):
        try:
            loan = LoanApplication.objects.get(id=loan_id, user=request.user)
            
            if loan.user_notified:
                return Response({"message": "User already notified"}, status=status.HTTP_200_OK)
            
            # Mark as notified
            loan.user_notified = True
            loan.save()
            
            if loan.status == 'APPROVED' and loan.check_eligibility():
                # For approved loans, we'll handle disbursement in a separate step
                return Response({
                    "message": "Loan approved! You can now disburse the loan to receive units.",
                    "approved": True,
                    "loan_id": loan.id
                })
            else:
                # For rejected loans, suggest buying units
                return Response({
                    "message": "Loan not approved. Consider purchasing units directly.",
                    "approved": False,
                    "suggestion": "buy_units"
                })
                
        except LoanApplication.DoesNotExist:
            return Response({"error": "Loan not found"}, status=status.HTTP_404_NOT_FOUND)
        
class LoanStatsView(APIView):
    permission_classes = (IsAuthenticated,)
    
    def get(self, request):
        try:
            from loan.services import get_user_loan_stats

            return Response(get_user_loan_stats(request.user), status=200)

        except Exception as e:
            logger.exception("Loan stats failed")
            return Response({"error": "Failed to fetch stats"}, status=500)

