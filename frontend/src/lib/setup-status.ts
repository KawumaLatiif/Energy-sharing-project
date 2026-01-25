import { get } from '@/lib/fetch';
import { User } from '@/interface/user.interface';

export interface SetupStatus {
  hasMeter: boolean;
  hasCompleteProfile: boolean;
  completedSetup: boolean;
  currentStep: 'meter' | 'profile' | 'complete';
}

export async function checkUserSetupStatus(user: User | null): Promise<SetupStatus> {
  if (!user) {
    return {
      hasMeter: false,
      hasCompleteProfile: false,
      completedSetup: false,
      currentStep: 'meter'
    };
  }

  // Admins don't need setup
  if (user.is_admin || user.user_role === 'ADMIN') {
    return {
      hasMeter: true,
      hasCompleteProfile: true,
      completedSetup: true,
      currentStep: 'complete'
    };
  }

  try {
    // Check meter registration
    const meterResponse = await get<any>('meter/my-meter/');
    const hasMeter = !meterResponse.error && 
                     meterResponse.data?.success && 
                     meterResponse.data.data?.has_meter;
    
    // Check profile completion
    let hasCompleteProfile = false;
    try {
      const profileResponse = await get<any>('auth/user-profile/');
      hasCompleteProfile = !profileResponse.error && !!profileResponse.data?.completed;
    } catch (error) {
      console.error('Profile check failed:', error);
      hasCompleteProfile = false;
    }

    // Determine current step
    let currentStep: 'meter' | 'profile' | 'complete' = 'complete';
    if (!hasMeter) {
      currentStep = 'meter';
    } else if (!hasCompleteProfile) {
      currentStep = 'profile';
    }

    return {
      hasMeter,
      hasCompleteProfile,
      completedSetup: hasMeter && hasCompleteProfile,
      currentStep
    };
  } catch (error) {
    console.error('Failed to check setup status:', error);
    return {
      hasMeter: false,
      hasCompleteProfile: false,
      completedSetup: false,
      currentStep: 'meter'
    };
  }
}