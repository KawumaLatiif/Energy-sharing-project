import requests
import logging
from datetime import date
from django.utils.timezone import now
from django.conf import settings
from django.http import JsonResponse
from meter.models import Meter, MeterToken
from transactions.models import UnitTransaction, TransactionLog
from .serializers import BuyUnitSerializer
from rest_framework.generics import (
    GenericAPIView,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .generate_token import generate_numeric_token

from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from datetime import datetime
# from .models import 
from .serializers import TransactionLogSerializer
import logging

logger = logging.getLogger(__name__)

class TransactionHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            # Filters: optional query params
            transaction_type = request.query_params.get('type')  # e.g., 'LOAN_REPAYMENT'
            start_date = request.query_params.get('start_date')  # YYYY-MM-DD
            end_date = request.query_params.get('end_date')      # YYYY-MM-DD
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', 20))

            queryset = TransactionLog.objects.filter(user=user).order_by('-created_at')

            # Apply filters
            if transaction_type:
                queryset = queryset.filter(transaction_type=transaction_type)
            if start_date:
                start_dt = datetime.strptime(start_date, '%Y-%m-%d')
                queryset = queryset.filter(created_at__gte=start_dt)
            if end_date:
                end_dt = datetime.strptime(end_date, '%Y-%m-%d')
                queryset = queryset.filter(created_at__lte=end_dt)

            # Pagination (simple offset-based)
            total = queryset.count()
            queryset = queryset[(page-1)*page_size:page*page_size]

            serializer = TransactionLogSerializer(queryset, many=True)

            return Response({
                'success': True,
                'total': total,
                'page': page,
                'page_size': page_size,
                'transactions': serializer.data
            }, status=status.HTTP_200_OK)

        except ValueError as ve:
            logger.warning(f"Invalid filter params: {str(ve)}")
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)
        except Exception as e:
            logger.error(f"Error fetching history: {str(e)}")
            return Response({'error': 'Failed to fetch transaction history'}, status=500)

def is_start_of_new_month():
    today = now().date()
    return today.day == 1 


class BuyUnitsView(GenericAPIView):

    permission_classes = (IsAuthenticated,)
    serializer_class = BuyUnitSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = request.data.get("amount")
        phone_number = request.data.get("phone_number")
        user = request.user

        try:
            meter = Meter.objects.get(user=user)
        except Meter.DoesNotExist:
            return Response({
                "error": "No meter found. Please register your meter before purchasing units."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Tariff rates
        first_8_unit_rate = 250
        additional_unit_rate = 775.7
        min_purchase_amount = 5000

       
        if is_start_of_new_month():
            user.monthly_unit_balance = 0  
        
        if user.monthly_unit_balance < 8:
            amount_first_8_units = (8-user.monthly_unit_balance) * first_8_unit_rate
            first_8_units = amount_first_8_units / first_8_unit_rate
            print("Monthly units_balance:", user.monthly_unit_balance)
            print("amount of 1st 8 units",amount_first_8_units)
            print("first 8",first_8_units)
            print("other",8-(user.monthly_unit_balance))
            units_purchased = first_8_units
            user.monthly_unit_balance += first_8_units
            user.save()
            print("Monthly units_balance after", user.monthly_unit_balance)

            if (amount-amount_first_8_units) > min_purchase_amount:
                additional_units = (amount-amount_first_8_units) / additional_unit_rate
                units_purchased += additional_units

            token = generate_numeric_token()
            MeterToken.objects.create(
                user=user,
                meter=meter,  
                token=token,
                units=units_purchased
            )
            
            meter.units += units_purchased
            meter.save()

            TransactionLog.objects.create(
                user=user,
                transaction_type=TransactionType.UNIT_PURCHASE,
                amount=amount,
                units=units_purchased,
                status='COMPLETED',
                reference_id=token,  
                details={'meter_no': meter.meter_no, 'phone_number': phone_number, 'discounted': True}
            )
            
            response_data = {
                "Units purchased": "{:.2f}".format(units_purchased),
                "token": token,
                "message": "You have successfully purchased units"
            }
            return Response(response_data, status=status.HTTP_200_OK)

        # If the user has already purchased the first 8 units in the month
        units_purchased = amount / additional_unit_rate
        token = generate_numeric_token()
        MeterToken.objects.create(
            user=user,
            meter=meter, 
            token=token,
            units=units_purchased
        )
        
        meter.units += units_purchased
        meter.save()

        TransactionLog.objects.create(
            user=user,
            transaction_type=TransactionType.UNIT_PURCHASE,
            amount=amount,
            units=units_purchased,
            status='COMPLETED',
            reference_id=token,  
            details={'meter_no': meter.meter_no, 'phone_number': phone_number}
        )
        
        response_data = {
            "Units purchased": "{:.2f}".format(units_purchased),
            "token": token,
            "message": "You have successfully purchased units"
        }
        return Response(response_data, status=status.HTTP_200_OK)
    
    
    