import logging
import random
from datetime import timedelta
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
from meter.api.serializers import MeterSerializer
from loan.models import ElectricityTariff, LoanApplication, LoanDisbursement, LoanRepayment
from transactions.models import UnitTransaction
from loan.api.serializers import ElectricityTariffSerializer, LoanApplicationCreateSerializer, LoanApplicationSerializer
from meter.models import MeterToken

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
            
            # CHECK: Prevent multiple active loans
            existing_active_loans = LoanApplication.objects.filter(
                user=request.user,
                status__in=['PENDING', 'APPROVED', 'DISBURSED']
            ).exists()
            
            if existing_active_loans:
                return Response(
                    {"error": "You already have an active loan. Please complete repayment before applying for a new one."},
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
            
            #check if user has completed profile
            if not request.user.has_complete_profile:
                return Response(
                    {"error" : "Please complete your profile before applying for a loan."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)

            try:
                tariff = ElectricityTariff.objects.get(tariff_code="CODE10.1", is_active=True)
            except ElectricityTariff.DoesNotExist:
                # Fallback to first active tariff or None
                tariff = ElectricityTariff.objects.filter(is_active=True).first()

            # Calculate credit score
            credit_score = self.calculate_credit_score(request.user, data)

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

    def calculate_credit_score(self, user, loan_data):
        """Compute credit score from all frontend fields with new weightings"""
        score = 0

        # 1. Payment consistency (30 points)
        payment_map = {
            "Always on time": 30,
            "Often on time": 22,
            "Sometimes late": 12,
            "Mostly late": 5,
            "Never paid": 0
        }
        score += payment_map.get(user.payment_consistency, 12)  # Default: 12 ("Sometimes late")

        # 2. Disconnection history (20 points)
        disconnection_map = {
            "No disconnections": 20,
            "1–2 disconnections": 15,
            "3–4 disconnections": 8,
            ">4 disconnections": 3,
            "Frequently disconnected": 0
        }
        score += disconnection_map.get(user.disconnection_history, 8)  # Default: 8 ("3–4 disconnections")

        # 3. Monthly expenditure (15 points) - Lower expenditure gets higher score
        expenditure_map = {
            "<50,000 UGX": 15,
            "50,000–100,000 UGX": 12,
            "100,001–200,000 UGX": 8,
            "200,001–300,000 UGX": 5,
            ">300,000 UGX": 2
        }
        score += expenditure_map.get(user.monthly_expenditure, 8)  # Default: 8 ("100,001–200,000 UGX")

        # 4. Purchase frequency (10 points) - More frequent purchases get higher score
        frequency_map = {
            "Daily": 10,
            "Weekly": 8,
            "Bi-weekly": 6,
            "Monthly": 4,
            "Rarely": 2
        }
        score += frequency_map.get(user.purchase_frequency, 4)  # Default: 4 ("Monthly")

        # 5. Consumption level (10 points) - Moderate consumption gets highest score
        consumption_map = {
            "Moderate (100–200 kWh)": 10,
            "Low (50–99 kWh)": 8,
            "High (>200 kWh)": 6,
            "Very low (<50 kWh)": 4,
            "Extremely high (>300 kWh)": 2
        }
        score += consumption_map.get(user.consumption_level, 8)  # Default: 8 ("Low (50–99 kWh)")

        # 6. Monthly income (7 points) - Higher income gets higher score
        income_map = {
            ">1,000,000 UGX": 7,
            "500,000–999,999 UGX": 6,
            "200,000–499,999 UGX": 5,
            "100,000–199,999 UGX": 3,
            "<100,000 UGX": 1
        }
        score += income_map.get(user.monthly_income, 5)  # Default: 5 ("200,000–499,999 UGX")

        # 7. Income stability (5 points) - Stable income gets higher score
        stability_map = {
            "Fixed and stable": 5,
            "Regular but variable": 4,
            "Seasonal income": 3,
            "Irregular but frequent": 2,
            "Unstable income": 1
        }
        score += stability_map.get(user.income_stability, 4)  # Default: 4 ("Regular but variable")

        # 8. Meter sharing (3 points) - No sharing gets full points
        sharing_map = {
            "No sharing": 3,
            "Shared with 1 household": 2,
            "Shared with 2+ households": 1,
            "Commercial sharing": 0
        }
        score += sharing_map.get(user.meter_sharing, 3)  # Default: 3 ("No sharing")

        # 9. Loan amount factor (bonus/penalty based on requested amount)
        amount_requested = float(loan_data.get("amount_requested", 0))
        amount_factor = self.calculate_amount_factor(amount_requested, user.monthly_income)
        score += amount_factor

        return max(0, min(score, 100))

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

    def calculate_amount_factor(self, amount_requested, monthly_income):
        """Calculate bonus/penalty based on loan amount vs income"""
        # Define income ranges and their maximum recommended loan amounts
        income_ranges = {
            "<100,000 UGX": 20000,
            "100,000–199,999 UGX": 50000,
            "200,000–499,999 UGX": 100000,
            "500,000–999,999 UGX": 150000,
            ">1,000,000 UGX": 200000
        }
        
        max_recommended = income_ranges.get(monthly_income, 50000)
        
        if amount_requested <= max_recommended * 0.5:
            return 5  
        elif amount_requested <= max_recommended:
            return 2  
        elif amount_requested <= max_recommended * 1.5:
            return -5  
        else:
            return -10  
    
    def determine_loan_tier(self, score):
        """Determine loan tier, maximum amount, and interest rate based on credit score"""
        tiers = [
            {'min_score': 75, 'max_score': 79, 'name': 'BRONZE', 'max_amount': 50000, 'interest_rate': 12.0},
            {'min_score': 80, 'max_score': 84, 'name': 'SILVER', 'max_amount': 100000, 'interest_rate': 11.0},
            {'min_score': 85, 'max_score': 89, 'name': 'GOLD', 'max_amount': 150000, 'interest_rate': 10.0},
            {'min_score': 90, 'max_score': 100, 'name': 'PLATINUM', 'max_amount': 200000, 'interest_rate': 9.0}
        ]
        
        for tier in tiers:
            if tier['min_score'] <= score <= tier['max_score']:
                return tier['name'], tier['max_amount'], tier['interest_rate']
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

class LoanRepaymentView(APIView):
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, loan_id):
        try:
            loan = LoanApplication.objects.get(id=loan_id, user=request.user)
            
            if loan.status != 'DISBURSED':
                return Response({"error": "Loan is not disbursed or already completed"}, status=status.HTTP_400_BAD_REQUEST)
            
            amount = float(request.data.get('amount', 0))
            
            if amount <= 0:
                return Response({"error": "Invalid amount"}, status=status.HTTP_400_BAD_REQUEST)
            
            if amount > loan.outstanding_balance:
                return Response({"error": "Amount exceeds outstanding balance"}, status=status.HTTP_400_BAD_REQUEST)
            
             # Calculate units equivalent based on tariff block rates
            if loan.tariff:
                units_equivalent = loan.calculate_units_from_amount(amount)
                cost_breakdown = self.get_repayment_breakdown(loan, amount)
                tariff_info = {
                    'tariff_code': loan.tariff.tariff_code,
                    'cost_breakdown': cost_breakdown
                }
            else:
                # Default calculation (500 UGX per unit)
                units_equivalent = round(amount / 500)
                tariff_info = {
                    'tariff_code': 'DEFAULT',
                    'rate_used': 500
                }
            
            with transaction.atomic():
                # Generate payment reference
                payment_ref = generate_random_string(12)
                
                # Create repayment record
                repayment = LoanRepayment.objects.create(
                    loan=loan,
                    amount_paid=amount,
                    units_paid=units_equivalent,
                    payment_reference=payment_ref,
                    is_on_time=self.check_payment_timeliness(loan)
                )
                
                # Add units to user's meter
                try:
                    meter = Meter.objects.get(user=request.user)
                    meter.units += units_equivalent
                    meter.save()
                    
                    # SKIP UnitTransaction creation for now to avoid errors
                    logger.info(f"Repayment processed. Loan: {loan.loan_id}, Amount: {amount}, Units: {units_equivalent}")
                    
                except Meter.DoesNotExist:
                    return Response({"error": "Meter not found"}, status=status.HTTP_400_BAD_REQUEST)
                
                # Check if loan is fully paid
                if loan.outstanding_balance <= 0:
                    loan.status = 'COMPLETED'
                    loan.save()
            
            return Response({
                "message": "Payment successful", 
                "units_added": round(units_equivalent,2),
                "payment_reference": payment_ref,
                "tariff_info": tariff_info,
                "outstanding_balance": loan.outstanding_balance
            })
            
        except LoanApplication.DoesNotExist:
            return Response({"error": "Loan not found"}, status=status.HTTP_404_NOT_FOUND)
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
        return True

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
            loan = LoanApplication.objects.get(id=loan_id, user=request.user)
            
            if loan.status != 'APPROVED':
                return Response({"error": "Loan is not approved for disbursement"}, status=status.HTTP_400_BAD_REQUEST)
            
            if not loan.amount_approved or loan.amount_approved <= 0:
                return Response({"error": "Loan amount not approved"}, status=status.HTTP_400_BAD_REQUEST)
            
            with transaction.atomic():
                # Get user's meter
                try:
                    meter = Meter.objects.get(user=request.user)
                except Meter.DoesNotExist:
                    return Response({"error": "Meter not found"}, status=status.HTTP_400_BAD_REQUEST)
                
                # Calculate units to disburse based on tariff block rates
                if loan.tariff:
                    units_to_disburse = loan.calculate_units_from_amount()
                    # FIXED: Now this method exists
                    cost_breakdown = self.get_cost_breakdown(loan, float(loan.amount_approved))
                    tariff_info = {
                        'tariff_code': loan.tariff.tariff_code,
                        'tariff_name': loan.tariff.tariff_name,
                        'cost_breakdown': cost_breakdown
                    }
                else:
                    # Fallback to default calculation (500 UGX per unit)
                    units_to_disburse = round(float(loan.amount_approved) / 500)
                    tariff_info = {
                        'tariff_code': 'DEFAULT',
                        'rate_per_kwh': 500,
                        'tariff_name': 'Default Rate'
                    }

                # Generate token and set expiry (30 days from now)
                token = ''.join(random.choices('0123456789', k=10))
                token_expiry = timezone.now() + timedelta(days=30)
                
                # Create disbursement record
                disbursement = LoanDisbursement.objects.create(
                    loan_application=loan,
                    disbursed_amount=loan.amount_approved,
                    units_disbursed=units_to_disburse,
                    token=token,
                    token_expiry=token_expiry,
                    meter=meter
                )
                
                # Create MeterToken record
                try:
                    meter_token = MeterToken.objects.create(
                        token=token,
                        units=units_to_disburse,
                        meter=meter,
                        user=meter.user,
                        is_used=False,
                        source='LOAN',
                        loan_application=loan
                    )
                except Exception as e:
                    logger.error(f"Error creating MeterToken: {str(e)}")
                    # Continue even if MeterToken creation fails
                
                # Update loan status to DISBURSED
                loan.status = 'DISBURSED'
                loan.save()
                
                # Add units to meter
                meter.units += units_to_disburse
                meter.save()
                
                try:
                    # Try minimal fields based on your model structure
                    unit_transaction_data = {
                        'sender': request.user,
                        'receiver': request.user,
                        'units': units_to_disburse,
                        'meter': meter,
                        'direction': 'IN',
                        'status': 'COMPLETED',
                        'message': f'Loan disbursement - {loan.loan_id}'
                    }
                    
                    # Remove any None values
                    unit_transaction_data = {k: v for k, v in unit_transaction_data.items() if v is not None}
                    
                    UnitTransaction.objects.create(**unit_transaction_data)
                    
                except Exception as e:
                    logger.warning(f"UnitTransaction creation failed, but continuing: {e}")
                    # Don't fail the whole disbursement if transaction recording fails
            
            return Response({
                "message": "Loan disbursed successfully!",
                "token": disbursement.token,
                "units_added": round(units_to_disburse, 2),
                "tariff_info": tariff_info,
                "token_expiry": token_expiry.isoformat()
            })
            
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
            user_loans = LoanApplication.objects.filter(user=request.user)
            
            active_loans = user_loans.filter(status__in=['DISBURSED']).count()
            pending_applications = user_loans.filter(status='PENDING').count()
            approved_loans = user_loans.filter(status='APPROVED').count()
            
            total_repayments = LoanRepayment.objects.filter(
                loan__user=request.user
            ).aggregate(Sum('amount_paid'))['amount_paid__sum'] or 0
            
            total_borrowed = user_loans.filter(status__in=['APPROVED', 'DISBURSED', 'COMPLETED']).aggregate(
                total = Sum('amount_approved')
            )['total'] or 0
           
            # outstanding_balance = sum(
            #     float(loan.outstanding_balance) 
            #     for loan in user_loans.filter(status__in=['DISBURSED'])
            # )

            disbursed_loans = user_loans.filter(status='DISBURSED')
            outstanding_balance = 0
            for loan in disbursed_loans:
                outstanding_balance += float(loan.outstanding_balance)
            
            return Response({
                'active_loans': active_loans,
                'pending_applications': pending_applications,
                'approved_loans': approved_loans,
                'total_repayments': float(total_repayments),
                'total_borrowed': float(total_borrowed),
                'outstanding_balance': outstanding_balance,
                'total_loans': user_loans.count()
            })
            
        except Exception as e:
            logger.error(f"Error fetching loan stats: {str(e)}")
            return Response(
                {"error": "Failed to fetch loan statistics"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
