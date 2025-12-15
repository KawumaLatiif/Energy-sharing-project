'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { verifyEmail } from '../../../../ck/verify/email/verify';
import { resendVerificationEmail } from '../../resend';

interface VerifyEmailProps {
  uid?: string;
  token?: string;
}

export default function VerifyEmail({ uid: propUid, token: propToken }: VerifyEmailProps = {}) {
  const searchParams = useSearchParams();
  const params = useParams();
  
  // Get uid and token from props, URL params, or search params
  const uid = propUid || params?.uid || searchParams.get('uid');
  const token = propToken || params?.token || searchParams.get('token');
  const email = searchParams.get('email');
  
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error' | 'resending'>('idle');
  const [message, setMessage] = useState('');
  const [showResend, setShowResend] = useState(false);

  useEffect(() => {
    // Only auto-verify if we have both uid and token
    if (uid && token) {
      handleVerifyEmail();
    } else if (email) {
      // If we only have email, show message to check inbox
      setStatus('idle');
      setMessage(`Please check your email (${email}) for the verification link.`);
    }
  }, [uid, token, email]);

  const handleVerifyEmail = async () => {
    if (!uid || !token) {
      setStatus('error');
      setMessage('Missing verification parameters');
      return;
    }
    
    setStatus('verifying');
    try {
      const result = await verifyEmail(uid, token);
      
      if (result.success) {
        setStatus('success');
        setMessage(result.success);
        // Redirect after a delay
        setTimeout(() => {
          window.location.href = result.redirectTo || '/auth/login';
        }, 3000);
      } else {
        setStatus('error');
        setMessage(result.error || 'Verification failed');
        setShowResend(true);
      }
    } catch (error) {
      setStatus('error');
      setMessage('An unexpected error occurred during verification');
      setShowResend(true);
    }
  };

  const handleResendEmail = async () => {
    if (!email) {
      setMessage('No email address available for resending');
      return;
    }
    
    setStatus('resending');
    try {
      const result = await resendVerificationEmail(email);
      
      if (result.success) {
        setStatus('success');
        setMessage(result.success);
      } else {
        setStatus('error');
        setMessage(result.error || 'Failed to resend verification email');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Failed to resend verification email');
    }
  };

  return (
    <div className="flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Email Verification
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {status === 'verifying' && (
            <div className="text-center">
              <p>Verifying your email address...</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="text-center text-green-600">
              <p>{message}</p>
              <p>Redirecting to login page...</p>
            </div>
          )}
          
          {status === 'error' && (
            <div className="text-center text-red-600">
              <p>{message}</p>
              {showResend && email && (
                <button
                  onClick={handleResendEmail}
                  disabled={status === 'resending'}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
                >
                  {status === 'resending' ? 'Sending...' : 'Resend Verification Email'}
                </button>
              )}
            </div>
          )}
          
          {(status === 'idle' || (!uid && !token)) && (
            <div className="text-center">
              <p>{message || 'Please check your email for a verification link.'}</p>
              {email && (
                <>
                  <p className="mt-2">Sent to: {email}</p>
                  <button
                    onClick={handleResendEmail}
                    disabled={status === 'resending'}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
                  >
                    {status === 'resending' ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}