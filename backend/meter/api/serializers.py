import logging
from rest_framework import serializers
from meter.models import Meter, MeterToken


from rest_framework import serializers
from meter.models import Meter

class MeterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Meter
        fields = ["meter_no", "static_ip", "units"]
        extra_kwargs = {
            "units": {"read_only": True}
        }



class SendUnitSerializer(serializers.ModelSerializer):

    receiver_meter_no = serializers.CharField(required=True)
    no_units = serializers.CharField(required=True)
    message = serializers.CharField(required=True)
    
    class Meta:
        model= Meter
        fields = [
            "receiver_meter_no",
            "no_units",
            "message"
        ]

class TokenSerializer(serializers.ModelSerializer):
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    loan_id = serializers.SerializerMethodField()

    class Meta:
        model = MeterToken
        fields = '__all__'

    def get_loan_id(self, obj):
        if obj.loan_application:
            return obj.loan_application.loan_id
        return None
