from decouple import config

# Use your nginx server as the callback host
MTN_MOMO_CONFIG = {
    'BASE_URL': 'https://sandbox.momodeveloper.mtn.com',
    'PRIMARY_KEY': config('PRIMARY_KEY', default='efc825a16cd54e91b257495f3798fc73'),
    'SECONDARY_KEY': config('SECONDARY_KEY', default='82ab603816854e039508b274aec3dca4'),
    'CALLBACK_HOST': config('CALLBACK_HOST', default='https://unantagonizable-gluttingly-linh.ngrok-free.dev'),
    'ENVIRONMENT': config('ENVIRONMENT', default='sandbox'),  
}

MTN_TEST_NUMBERS = [
    '256771950092',
    '256786973581'
]