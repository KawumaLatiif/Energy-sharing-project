from django.shortcuts import render

class ShareUnits(GenericAPIView):
    permission_classes = (IsAuthenticated)
    
