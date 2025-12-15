import requests
import logging
from datetime import date
from django.utils.timezone import now
from django.conf import settings
from django.http import JsonResponse
from meter.models import Meter, MeterToken
from transactions.models import UnitTransaction
from .serializers import BuyUnitSerializer
from rest_framework.generics import (
    GenericAPIView,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .generate_token import generate_numeric_token



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
        
        response_data = {
            "Units purchased": "{:.2f}".format(units_purchased),
            "token": token,
            "message": "You have successfully purchased units"
        }
        return Response(response_data, status=status.HTTP_200_OK)
    
    
    