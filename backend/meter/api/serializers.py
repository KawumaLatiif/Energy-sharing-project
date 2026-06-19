import logging
from rest_framework import serializers
from meter.models import Meter, MeterToken


from rest_framework import serializers
from meter.models import Meter

class MeterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Meter
        fields = ["meter_no", "static_ip", "units", "architecture", "label"]
        extra_kwargs = {
            "units": {"read_only": True},
            "static_ip": {"required": False, "allow_null": True, "allow_blank": True},
            "label": {"required": False, "allow_blank": True},
        }

    def validate(self, data):
        # Determine effective architecture (fall back to instance value on partial update)
        arch = data.get("architecture")
        if arch is None and self.instance:
            arch = self.instance.architecture
        arch = arch or Meter.ARCH_STS

        static_ip = data.get("static_ip")
        if arch == Meter.ARCH_AMI and not static_ip:
            raise serializers.ValidationError(
                {"static_ip": "IP address is required for AMI meters."}
            )
        if arch == Meter.ARCH_STS:
            # STS meters have no IP — omit/ignore any value sent from the client
            data["static_ip"] = None
        return data



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
