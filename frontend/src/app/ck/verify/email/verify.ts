// lib/verify-email.ts
import { get } from "../../../../lib/fetch";
import { getApiErrorMessage } from "../../../../lib/api-response";

export async function verifyEmail(uid: string, token: string) {
  try {
    // Decode the uid first to handle any double encoding
    const decodedUid = decodeURIComponent(uid);
    
    const response = await get(`auth/verify-email/?uid=${encodeURIComponent(decodedUid)}&token=${encodeURIComponent(token)}`);
    
    console.log("Verification response:", response);
    
    if (response.error) {
      return { 
        success: false, 
        error: getApiErrorMessage(response.error, 'Invalid or expired verification link')
      };
    }

    return { 
      success: true, 
      message: 'Email verified successfully' 
    };
  } catch (err) {
    console.error('Verification Error:', err);
    return { 
      success: false, 
      error: 'Server error occurred during verification' 
    };
  }
}
