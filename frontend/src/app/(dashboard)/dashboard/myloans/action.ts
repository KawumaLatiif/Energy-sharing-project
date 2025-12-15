"use server";

import { getErrorMessage } from "@/lib/errors";
import { post } from "@/lib/fetch";

export async function disburseLoan(loanId: number) {
  try {
    console.log('Disbursing loan:', loanId);
    
    const response = await post<any>(`loans/disburse/${loanId}/`, {});
    
    if (response.error) {
      console.error('Disbursement error response:', response.error);
      
      if (response.status === 401) {
        throw new Error('Authentication expired. Please log in again.');
      }
      throw new Error(response.error.detail || response.error.error || 'Failed to disburse loan');
    }

    console.log('Disbursement success:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('Disbursement error:', error);
    throw new Error(getErrorMessage(error));
  }
}

export async function repayLoan(loanId: number, amount: number) {
  try {
    console.log('Repaying loan:', loanId, 'Amount:', amount);
    
    const response = await post<any>(`loans/repay/${loanId}/`, { amount });
    
    if (response.error) {
      console.error('Repayment error response:', response.error);
      
      if (response.status === 401) {
        throw new Error('Authentication expired. Please log in again.');
      }
      throw new Error(response.error.detail || response.error.error || 'Failed to process repayment');
    }

    console.log('Repayment success:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('Repayment error:', error);
    throw new Error(getErrorMessage(error));
  }
}

export async function repayLoanWithMomo(loanId: number, amount: number, phoneNumber: string) {
  try {
    console.log('MoMo repayment:', { loanId, amount, phoneNumber });
    
    const response = await post<any>(`loans/repay/momo/${loanId}/`, { 
      amount, 
      phone_number: phoneNumber 
    });
    
    if (response.error) {
      console.error('MoMo repayment error response:', response.error);
      
      if (response.status === 401) {
        throw new Error('Authentication expired. Please log in again.');
      }
      throw new Error(response.error.detail || response.error.error || 'Mobile Money payment failed');
    }

    console.log('MoMo repayment success:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('MoMo repayment error:', error);
    throw new Error(getErrorMessage(error));
  }
}

export async function checkPaymentStatus(externalId: string) {
  try {
    console.log('Checking payment status:', externalId);
    
    const response = await post<any>(`loans/payment-status/${externalId}/`, {});
    
    if (response.error) {
      console.error('Payment status check error:', response.error);
      
      if (response.status === 401) {
        throw new Error('Authentication expired. Please log in again.');
      }
      throw new Error(response.error.detail || response.error.error || 'Failed to check payment status');
    }

    console.log('Payment status check success:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('Payment status check error:', error);
    throw new Error(getErrorMessage(error));
  }
}

export async function getLoanDetails(loanId: number) {
  try {
    console.log('Fetching loan details:', loanId);
    
    const response = await post<any>(`loans/loan/${loanId}/`, {});
    
    if (response.error) {
      console.error('Loan details error:', response.error);
      
      if (response.status === 401) {
        throw new Error('Authentication expired. Please log in again.');
      }
      throw new Error(response.error.detail || response.error.error || 'Failed to fetch loan details');
    }

    console.log('Loan details success:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('Loan details error:', error);
    throw new Error(getErrorMessage(error));
  }
}