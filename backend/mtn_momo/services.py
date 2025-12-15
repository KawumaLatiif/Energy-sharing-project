import requests
import json
import logging
import base64
import uuid
import random
from django.conf import settings
from .config import MTN_MOMO_CONFIG

logger = logging.getLogger(__name__)

class MTNMoMoService:
    def __init__(self):
        self.base_url = MTN_MOMO_CONFIG['BASE_URL']
        self.primary_key = MTN_MOMO_CONFIG.get('PRIMARY_KEY', 'efc825a16cd54e91b257495f3798fc73')  
        self.secondary_key = MTN_MOMO_CONFIG.get('SECONDARY_KEY', '82ab603816854e039508b274aec3dca4')  
        self.callback_host = MTN_MOMO_CONFIG['CALLBACK_HOST']
        self.environment = MTN_MOMO_CONFIG['ENVIRONMENT']
        
        # Generate reference_id (UUID) 
        self.reference_id = str(uuid.uuid4())
        self.api_key = None
        
        # Auto-setup on initialization
        self.auto_setup()
    
    def auto_setup(self):
        """Automatically setup API user and credentials"""
        try:
            logger.info("Starting MoMo API auto-setup...")
            
            # self.delete_api_user()
            
            # Step 1: Create API User
            if self.create_api_user():
                logger.info("API user created successfully")
                
                # Step 2: Create API Key
                self.api_key = self.create_api_key()
                if self.api_key:
                    logger.info("✅ API key generated successfully")
                    
                    # Step 3: Test token generation
                    token = self.get_api_token()
                    if token:
                        logger.info("Token generation working - Setup completed!")
                    else:
                        logger.warning("Setup completed but token test failed")
                else:
                    logger.error("API key generation failed")
            else:
                logger.error("API user creation failed")
                
        except Exception as e:
            logger.error(f"Auto-setup failed: {str(e)}")

    def create_api_user(self):
        try:
            """Create API user in MoMo system - FIXED VERSION"""
            url = f"{self.base_url}/v1_0/apiuser"

            headers = {
                'X-Reference-Id': self.reference_id,           
                'Ocp-Apim-Subscription-Key': self.secondary_key,
                'Content-Type': 'application/json'
            }

            payload = {
                "providerCallbackHost": str(self.callback_host)
            }
        
            logger.info(f"Headers: X-Reference-Id = {self.reference_id}")
            logger.info(f"Subscription-Key: {self.secondary_key[:8]}...")
            logger.info(f"POST → {url}")

            response = requests.post(url, headers=headers, json=payload, timeout=10)
        
            logger.info(f"Response: {response.status_code} {response.text}")

            if response.status_code == 201:
                logger.info("API user created successfully (201)")
                return True
            elif response.status_code == 409:
                logger.warning("API user already exists (409) - continuing...")
                return True
            else:
                logger.error(f"API user creation failed: {response.status_code} - {response.text} (Full response: {response.content})")
                return False

        except requests.exceptions.RequestException as e:
            logger.error(f"Request exception: {str(e)}")
            return False
         
        except Exception as e:
            logger.error(f"Unexpected error in create_api_user: {str(e)}")
            return False

    def create_api_key(self):
        """Create API key for the API user"""
        try:
            url = f"{self.base_url}/v1_0/apiuser/{self.reference_id}/apikey"
            
            # Headers exactly like PHP
            headers = {
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': self.secondary_key
            }
            
            logger.info(f"Creating API key for user: {self.reference_id}")
            
            response = requests.post(url, headers=headers, json={})
            
            if response.status_code == 201:
                data = response.json()
                api_key = data.get('apiKey')
                if api_key:
                    logger.info("API key generated successfully")
                    return api_key
                else:
                    logger.error("No API key in response")
                    return None
            else:
                logger.error(f"Failed to create API key: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error creating API key: {str(e)}")
            return None

    def get_api_token(self):
        """Get API token for MoMo API"""
        try:
            if not self.api_key:
                logger.error("API key not available")
                return None
                
            url = f"{self.base_url}/collection/token/"
            
            # Create Basic Auth header 
            credentials = f"{self.reference_id}:{self.api_key}"
            encoded_credentials = base64.b64encode(credentials.encode()).decode()
            
            # Headers 
            headers = {
                'Authorization': f'Basic {encoded_credentials}',
                'Ocp-Apim-Subscription-Key': self.secondary_key
            }
            
            logger.info("Requesting API token...")
            
            response = requests.post(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                token = data.get('access_token')
                if token:
                    logger.info("API token obtained successfully")
                    return token
                else:
                    logger.error("No access token in response")
                    return None
            else:
                logger.error(f"Token request failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting API token: {str(e)}")
            return None

    def request_payment(self, amount, phone_number, external_id, payment_reference):
        """Request payment from user"""
        try:
            # Validate Uganda phone number
            phone_number = phone_number.replace(' ', '').replace('-', '').replace('+', '')
            if not phone_number.startswith('256') or len(phone_number) != 12:
                return {'status': 'FAILED', 'message': 'Invalid Uganda phone number (must be 256XXXXXXXXXX)'}
            
            token = self.get_api_token()
            if not token:
                return {'status': 'FAILED', 'message': 'Could not get API token'}
                
            url = f"{self.base_url}/collection/v1_0/requesttopay"
            
            # Use provided external_id or generate
            if not external_id:
                external_id = str(random.randint(10000000, 99999999))
            
            headers = {
                'Authorization': f'Bearer {token}',
                'X-Reference-Id': self.reference_id, 
                'X-Target-Environment': self.environment,
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': self.secondary_key
            }
            
            # Payload - uses EUR because UGX not supported by MTN MoMo API sandbox
            payload = {
                "amount": str(amount),
                "currency": "EUR",  
                "externalId": external_id,
                "payer": {
                    "partyIdType": "MSISDN",
                    "partyId": phone_number
                },
                "payerMessage": f"Loan repayment - {payment_reference}. Reply with PIN to authorize.",
                "payeeNote": "Electricity loan repayment"
            }
            
            logger.info(f"Sending payment request: {payload}")
            
            response = requests.post(url, headers=headers, json=payload)
            
            if response.status_code == 202:
                logger.info("Payment request submitted successfully - PIN prompt sent to phone")
                return {
                    'status': 'PENDING', 
                    'message': 'Payment request submitted successfully',
                    'external_id': external_id,
                    'reference_id': self.reference_id,
                    'user_prompt': 'Check your phone now. Enter your MTN MoMo PIN to complete the payment.'  # For frontend
                }
            else:
                logger.error(f"Payment request failed: {response.status_code} - {response.text}")
                return {
                    'status': 'FAILED', 
                    'message': f'Payment request failed: {response.text}'
                }
                
        except Exception as e:
            logger.error(f"Error requesting payment: {str(e)}")
            return {'status': 'FAILED', 'message': str(e)}
        
    def delete_api_user(self):
        """Delete existing API user to allow recreation with new callback host"""
        try:
            url = f"{self.base_url}/v1_0/apiuser/{self.reference_id}"
            headers = {
                'Ocp-Apim-Subscription-Key': self.secondary_key
            }
            logger.info(f"Deleting existing API user: {self.reference_id}")
            response = requests.delete(url, headers=headers)
            if response.status_code in [200, 204]:
                logger.info("API user deleted successfully")
                return True
            elif response.status_code == 404:
                logger.info("API user not found - safe to create new")
                return True
            else:
                logger.warning(f"Delete failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error deleting API user: {str(e)}")
            return False

    def get_payment_status(self, external_id):
        """Get payment status"""
        try:
            token = self.get_api_token()
            if not token:
                return {'status': 'FAILED', 'message': 'Could not get API token'}
                
            url = f"{self.base_url}/collection/v1_0/requesttopay/{external_id}"
            
            headers = {
                'Authorization': f'Bearer {token}',
                'X-Target-Environment': self.environment,
                'Ocp-Apim-Subscription-Key': self.secondary_key,
            }
            
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                status = data.get('status', 'FAILED')
                
                status_map = {
                    'SUCCESSFUL': 'SUCCESS',
                    'PENDING': 'PENDING', 
                    'FAILED': 'FAILED'
                }
                
                result = {
                    'status': status_map.get(status, 'FAILED'),
                    'transaction_id': data.get('financialTransactionId'),
                    'amount': float(data.get('amount', 0)),
                    'currency': data.get('currency', 'UGX'),
                    'payer': data.get('payer', {}).get('partyId'),
                    'message': f"Payment {status.lower()}"
                }
                
                logger.info(f"Payment status: {result}")
                return result
                
            else:
                # Better error handling
                error_msg = response.text if response.text else 'Unknown error'
                logger.error(f"Status check failed: {response.status_code} - {error_msg}")
                return {
                    'status': 'FAILED', 
                    'message': f'Status check failed: {response.status_code} - {error_msg}'
                }
                
        except Exception as e:
            logger.error(f"Error getting payment status: {str(e)}")
            return {'status': 'FAILED', 'message': str(e)}
        
  
  
  
  
        