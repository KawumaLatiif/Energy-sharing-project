import logging
from rest_framework import serializers
from cities_light.models import Country
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.validators import UniqueValidator
from django.conf import settings
from accounts.models import (
    
    Profile,
    SettingsConfirmationEmailCode,
    User,
    UserAccountDetails,
    generate_random_string,
    
   
)
from django.db.models import Q

from utils.validations import validate_password

logger = logging.getLogger(__name__)


class CreateUserSerializer(serializers.ModelSerializer):

    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)
    email = serializers.EmailField(
        required=True,
        validators=[
            UniqueValidator(
                queryset=User.objects.all(), message="Email already in use!"
            )
        ],
    )
    phone_number = serializers.CharField(
        required=True,
        validators=[
            UniqueValidator(
                queryset=User.objects.all(), message="Phone number already in use!"
            )
        ],
    )
   
    gender = serializers.CharField(required=True)
    password = serializers.CharField(
        validators=[validate_password], required=True
    )
    confirm_password = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "password",
            "confirm_password",
            "gender"
            
        ]

    def create(self, validated_data):
        """
        Create and return a new User instance
        """
       


        user = User.objects.create_user(**validated_data)
        Profile.objects.create(
            user=user
        )
        logger.info(
            f"[ACCOUNTS] Successfully created user account for user {user.id}"
        )

        return user

    def validate(self, data):
        """
        Method to validate request data
        """
        confirm_password = data.pop("confirm_password")
        if data.get("password") != confirm_password:
            raise serializers.ValidationError({"password": "Passwords mismatch"})

        elif len(data.get("password")) < 8:
            raise serializers.ValidationError({"password": "Password should be atleast 8 characters long"})
        if data.get("country"):
            country = Country.objects.filter(code=data.get("country")).first()
            if not country:
            # error_message = f"Country {country} does not exist!"
                raise serializers.ValidationError({"country": f"Country {data.get('country')} does not exist"})
        return data


class SettingsSerializer(serializers.ModelSerializer):

    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)
    phone_number = serializers.CharField(required=True)
    country = serializers.CharField(required=True)
    gender = serializers.CharField(required=True)
    current_password = serializers.CharField(required=True)
    phone_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    confirm_password = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    code = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "phone_number",
            "password",
            "confirm_password",
            "country",
            "gender",
            "current_password",
            "code",
        ]

    def create(self, validated_data):
        """
        Save and return  User instance
        """
        country_code = validated_data.pop('country', None)
        first_name = validated_data.get("first_name")
        last_name = validated_data.get("last_name")
        phone_number = validated_data.get("phone_number")
        password = validated_data.get("password")
        code = validated_data.get("code")
        gender = validated_data.get("gender")

        user = self.context.user
        user.first_name = first_name
        user.last_name = last_name
        user.gender = gender
        print(f"Received code: {code}")
        if code:
            print(f"Changing phone number  to {phone_number}")
            user.phone_number = phone_number
        else:
            print(f"Not Changing phone number  to {phone_number}")

        if password:
            user.set_password(password)

        country = Country.objects.get(code=country_code)
        user.country = country
        user.save()

        return user

    def validate(self, data):
        """
        Method to validate request data
        """
        user = self.context.user
        phone_exists = User.objects.filter(Q(~Q(id=user.id) & Q(phone_number=data.get("phone_number")))).last()
        if phone_exists:
            raise serializers.ValidationError({"phone_number": "Phone number is already registered"})
        if "password" in data and data.get("password"):
            confirm_password = data.pop("confirm_password")
            if data.get("password") != confirm_password:
                raise serializers.ValidationError({"password": "Passwords mismatch"})

            elif len(data.get("password")) < 8:
                raise serializers.ValidationError({"password": "Password should be atleast 8 characters long"})
        country_code = data.get("country")
        country = Country.objects.filter(code=country_code).first()

        if not country:
            error_message = f"Country {country} does not exist!"
            raise serializers.ValidationError({"country": error_message})

        if "code" in data and data.get("code"):
            # check and validate code
            code = data.get("code")
            active_code = SettingsConfirmationEmailCode.objects.filter(code=code).first()
            if not active_code:
                error_message = "Confirmation code is invalid"
                raise serializers.ValidationError({"code": error_message})

            active_code.delete()

        if not user.check_password(data.get("current_password")):
            error_message = "Password is invalid"
            raise serializers.ValidationError({"current_password": error_message})

        return data


class EmailTokenObtainSerializer(TokenObtainPairSerializer):
    username_field = User.EMAIL_FIELD


class LoginSerializer(EmailTokenObtainSerializer):
    tokens = serializers.CharField(read_only=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True)

    @classmethod
    def get_token(cls, user):
        return RefreshToken.for_user(user)

    def validate(self, attrs):
        # this method authenticates and add user to self if valid
        tokens = super().validate(attrs)
        user = self.user
        # try:
        #     email_verified = user.profile.email_verified
        # except Profile.DoesNotExist:
        #     error_msg = "No profile found with user account"
        #     logger.exception(
        #         f"[LOGIN] User {self.user.id} is missing a profile"
        #     )
        #     raise serializers.ValidationError(error_msg)
        if not user.profile.email_verified:
            error_msg = "Please verify your email address"
            raise serializers.ValidationError({"email": error_msg})

        return tokens


class LoginResponseSerializer(serializers.Serializer):
    access_token = serializers.CharField(read_only=True)
    refresh_token = serializers.EmailField(read_only=True)


# class CountrySerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Country
#         fields = ["code", "name"]


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['email_verified']  # Add other profile fields as necessary


class UserAccountDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAccountDetails
        fields = ['account_number', 'address', 'energy_preference', 'payment_method']

class UserConfigSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    account_details = UserAccountDetailsSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 
            'phone_number', 'profile', 'account_is_active',
            'account_details'
        ]


class UserConfigSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    # country = CountrySerializer(read_only=True)
    account_details = UserAccountDetailsSerializer(read_only=True)
    

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'phone_number', 'profile', 'account_is_active','account_details']


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class ResetPasswordConfirmSerializer(serializers.Serializer):
    password = serializers.CharField(
        validators=[validate_password],
        max_length=128,
        min_length=8,
        required=True,
    )
    confirm_password = serializers.CharField(
        max_length=128, min_length=8, required=True
    )

    def validate(self, data):
        password = data.get("password")
        confirm_password = data.pop("confirm_password")
        if password != confirm_password:
            raise serializers.ValidationError("Passwords mismatch!")
        return data


class UpdateAccountDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAccountDetails
        fields = ['address', 'energy_preference', 'payment_method']
    
    def update(self, instance, validated_data):
        validated_data.pop('account_number', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
