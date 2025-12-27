import logging
from rest_framework import serializers
from .models import Share
from django.core.validators import MinValueValidator

class ShareUnitSerializer(serializers.ModelSerializer):
    meter_number = serializers.CharField(
        required=True,
        min_length=10,
        max_length=10,
        help_text="Receiver's 10-digit meter number"
    )
    units = serializers.DecimalField(
        required=True,
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('2.00'),
        help_text="Minimum 2 units to share"
    )
    
    class Meta:
        model = Share
        fields = [
            "meter_number",
            "units",
        ]
    
    def validate_meter_number(self, value):
        # Ensure meter number contains only digits
        if not value.isdigit():
            raise serializers.ValidationError("Meter number must contain only digits")
        return value

class TransferUnitsSerializer(serializers.ModelSerializer):
    meter_no_old = serializers.CharField(
        required=True,
        min_length=10,
        max_length=10,
        help_text="Your current 10-digit meter number"
    )
    meter_no_new = serializers.CharField(
        required=True,
        min_length=10,
        max_length=10,
        help_text="New 10-digit meter number"
    )
    
    class Meta:
        model = Share
        fields = [
            "meter_no_old",
            "meter_no_new",
        ]
    
    def validate(self, data):
        # Ensure old and new meter numbers are different
        if data['meter_no_old'] == data['meter_no_new']:
            raise serializers.ValidationError(
                "Old and new meter numbers must be different"
            )
        
        # Ensure meter numbers contain only digits
        for field in ['meter_no_old', 'meter_no_new']:
            if not data[field].isdigit():
                raise serializers.ValidationError(
                    f"{field} must contain only digits"
                )
        
        return data