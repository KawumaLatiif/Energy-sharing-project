import logging
from rest_framework import serializers
from transactions.models import Transaction




class BuyUnitSerializer(serializers.ModelSerializer):
    amount = serializers.CharField(required=True)
    phone_number = serializers.CharField(required=True)    
    
    class Meta:
        model= Transaction
        fields = [
            "amount",
            "phone_number",
            
        ]