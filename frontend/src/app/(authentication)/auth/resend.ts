// app/auth/verify-email/_actions/resend.ts
'use server';

import { get } from '@/lib/fetch';

export async function resendVerificationEmail(email: string) {
  if (!email) {
    return { error: 'Email is required' };
  }
  
  try {
    const response = await get(`auth/resend-email-link/?email=${encodeURIComponent(email)}`);
    
    if (response.error) {
      return { 
        error: response.error?.message || 'Failed to resend verification email' 
      };
    }
    
    return { 
      success: 'Verification email sent successfully. Please check your inbox.' 
    };
  } catch (error) {
    console.error('Resend verification error:', error);
    return { error: 'Server error occurred while resending verification email' };
  }
}