from rest_framework import serializers
from loan.models import ElectricityTariff, LoanApplication, LoanDisbursement, LoanRepayment, TariffBlock

class TariffBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = TariffBlock
        fields = ['id', 'block_name', 'min_units', 'max_units', 'rate_per_unit', 'block_order']

class ElectricityTariffSerializer(serializers.ModelSerializer):
    blocks = TariffBlockSerializer(many=True, read_only=True)
    
    class Meta:
        model = ElectricityTariff
        fields = [
            'id', 'tariff_code', 'tariff_name', 'tariff_type', 'voltage_level', 'voltage_value', 'service_charge', 'blocks', 'is_active'
        ]

class LoanRepaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanRepayment
        fields = ['id', 'amount_paid', 'payment_date', 'units_paid', 'is_on_time', 'payment_reference']

class LoanApplicationSerializer(serializers.ModelSerializer):
    repayments = LoanRepaymentSerializer(many=True, read_only=True)
    outstanding_balance = serializers.SerializerMethodField()
    get_total_amount_due = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_eligible = serializers.SerializerMethodField()
    disbursement_token = serializers.SerializerMethodField()
    disbursement_units = serializers.SerializerMethodField()
    tier_display = serializers.CharField(source='get_loan_tier_display', read_only=True)
    
    user_profile_data = serializers.SerializerMethodField()

    #tariff fields
    tariff_details = ElectricityTariffSerializer(source='tariff', read_only=True)
    units_calculated = serializers.SerializerMethodField()
    cost_breakdown = serializers.SerializerMethodField()
    due_date = serializers.SerializerMethodField()

    class Meta:
        model = LoanApplication
        fields = '__all__'
        read_only_fields = ('user', 'status', 'credit_score', 'amount_approved', 'loan_id', 'rejection_reason', 'user_notified', 'loan_tier', 'interest_rate', 'outstanding_balance', 'total_amount_due')
    
    def get_user_profile_data(self, obj):
        """Include user profile data in the loan response"""
        user = obj.user
        return {
            'monthly_expenditure': user.monthly_expenditure,
            'purchase_frequency': user.purchase_frequency,
            'payment_consistency': user.payment_consistency,
            'disconnection_history': user.disconnection_history,
            'meter_sharing': user.meter_sharing,
            'monthly_income': user.monthly_income,
            'income_stability': user.income_stability,
            'consumption_level': user.consumption_level,
        }

    def get_outstanding_balance(self, obj):
        return obj.outstanding_balance
    
    def get_total_amount_due(self, obj):
        return obj.total_amount_due
    
    def get_is_eligible(self, obj):
        return obj.check_eligibility()
    
    def get_disbursement_token(self, obj):
        if hasattr(obj, 'disbursement') and obj.disbursement:
            return obj.disbursement.token
        return None
    
    def get_disbursement_units(self, obj):
        if hasattr(obj, 'disbursement') and obj.disbursement:
            return obj.disbursement.units_disbursed
        return None
    
    def get_units_calculated(self, obj):
        """Calculate units based on tariff block rates"""
        if obj.amount_approved:
            return obj.calculate_units_from_amount()
        return None
    
    def get_cost_breakdown(self, obj):
        """Get detailed cost breakdown for the approved amount"""
        if not obj.amount_approved or not obj.tariff:
            return None
        
        amount = float(obj.amount_approved)
        blocks = obj.tariff.blocks.all().order_by('block_order')
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
                'cost': round(cost_from_block, 2)
            })
        
        return breakdown

    def get_due_date(self, obj):
        return obj.due_date

class LoanApplicationCreateSerializer(serializers.ModelSerializer):
    tariff_id = serializers.PrimaryKeyRelatedField(
        queryset=ElectricityTariff.objects.filter(is_active=True),
        source='tariff',
        required=False,
        allow_null=True
    )

    class Meta:
        model = LoanApplication
        fields = [
            'purpose', 'amount_requested', 'tenure_months', 'tariff_id',
        ]
    
    def validate_amount_requested(self, value):
        if value < 5000:
            raise serializers.ValidationError("Minimum loan amount is 5,000 UGX")
        if value > 200000:
            raise serializers.ValidationError("Maximum loan amount is 200,000 UGX")
        return value
    
    def validate_monthly_expenditure(self, value):
        valid_choices = [choice[0] for choice in LoanApplication._meta.get_field('monthly_expenditure').choices]
        if value not in valid_choices:
            raise serializers.ValidationError("Invalid choice for monthly expenditure")
        return value


class LoanDisbursementSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanDisbursement
        fields = '__all__'

class LoanRepaymentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanRepayment
        fields = ['amount_paid']