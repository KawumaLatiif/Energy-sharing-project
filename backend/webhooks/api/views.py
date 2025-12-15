from django.utils import timezone
import logging
from utils.models import TokenValidator
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404, render
from rest_framework.views import APIView
from meter.models import MeterToken, Meter
from loan.models import LoanDisbursement
from django.db import transaction

logger = logging.getLogger(__name__)


class TokenDecryptionView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        """Docs for browsable API"""
        return Response({
            "message": "This endpoint accepts POST requests for token decryption.",
            "required_fields": {
                "token": "The token to decrypt",
                "meterNo": "The meter number"
            },
            "example_payload": {
                "token": "example_token_123",
                "meterNo": "METER123"
            }
        })

    def post(self, request, *args, **kwargs):
        token_info = request.data
        logger.info(f"Token Decryption function called")

        data = TokenValidator(**token_info)
        token = data.token
        meter_no = data.meterNo

        try:
            token_obj = MeterToken.objects.get(token=token)
            meter = Meter.objects.get(meter_no=meter_no)
            if token_obj and meter and not token_obj.is_used:
                meter.units += token_obj.units
                meter.save()
                token_obj.is_used = True
                token_obj.save()
                response_data = {
                    "success": True,
                    "units": float(token_obj.units),
                    "message": "Token decrypted and units added",
                    "status": status.HTTP_200_OK
                }
                return Response(response_data, status=status.HTTP_200_OK)
            else:
                response_data = {
                    "success": False,
                    "message": "Either meter or token not found or token already used",
                }
                return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
        except MeterToken.DoesNotExist:
            message = "Token not found"
            response_data = {
                "success": False,
                "error": message,
            }
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Token decryption error: {str(e)}")
            return Response({
                "success": False,
                "message": "Internal server error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoanTokenVerificationView(APIView):
    """
    API endpoint for ESP32 to verify loan tokens and transfer units
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        """Docs for browsable API"""
        return Response({
            "message": "This endpoint accepts POST requests for loan token verification (for ESP32).",
            "required_fields": {
                "token": "The loan token to verify",
                "meter_number": "The meter number"
            },
            "example_payload": {
                "token": "example_loan_token_123",
                "meter_number": "METER123"
            },
            "response_format": {
                "success": True,
                "units_transferred": 50.5,  # Example
                "message": "Token verified successfully"
            }
        })

    def post(self, request, *args, **kwargs):
        token = request.data.get('token')
        meter_number = request.data.get('meter_number')
        
        logger.info(f"Token verification request - Token: {token}, Meter: {meter_number}")
        
        if not token or not meter_number:
            return Response({
                "success": False,
                "message": "Token and meter number are required"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Check if token exists in LoanDisbursement
            disbursement = get_object_or_404(
                LoanDisbursement, 
                token=token,
                token_expiry__gte=timezone.now() 
            )
            
            # Verify meter exists (Fixed: Use model's 'meter_no' field)
            meter = get_object_or_404(Meter, meter_no=meter_number)  # Changed: meter_no instead of meter_number
            
            # Check if token is already used
            if MeterToken.objects.filter(token=token, is_used=True).exists():
                return Response({
                    "success": False,
                    "message": "Token has already been used"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Transfer units to meter
            with transaction.atomic():
                # Update meter units
                meter.units += disbursement.units_disbursed
                meter.save()
                
                # Create MeterToken record to mark as used
                meter_token, created = MeterToken.objects.get_or_create(
                    token=token,
                    defaults={
                        'units': disbursement.units_disbursed,
                        'meter': meter,
                        'user': disbursement.loan_application.user,
                        'is_used': True,
                        'source': 'LOAN',
                        'loan_application': disbursement.loan_application
                    }
                )
                
                if not created:
                    meter_token.is_used = True
                    meter_token.save()
            
            logger.info(f"Token verified successfully. Units transferred: {disbursement.units_disbursed}")
            
            return Response({
                "success": True,
                "message": "Token verified successfully",
                "units_transferred": float(disbursement.units_disbursed),
                "loan_id": disbursement.loan_application.loan_id,
                "meter_number": meter_number,
                "token_expiry": disbursement.token_expiry.isoformat()
            }, status=status.HTTP_200_OK)
            
        except LoanDisbursement.DoesNotExist:
            return Response({
                "success": False,
                "message": "Invalid token or token expired"
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Meter.DoesNotExist:
            return Response({
                "success": False,
                "message": "Meter not found"
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Token verification error: {str(e)}")
            return Response({
                "success": False,
                "message": "Internal server error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                       