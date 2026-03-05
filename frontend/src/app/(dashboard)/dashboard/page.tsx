export const dynamic = "force-dynamic";

import { Suspense } from 'react';
import { getUserConfig } from '@/lib/account';
import { get } from '@/lib/fetch';
import DashboardClient from './dashboard-client';
import { User } from '@/interface/user.interface';

type SetupStep = 'loading' | 'meter' | 'profile' | 'complete';

async function getInitialData(): Promise<{
  userConfig: User | null;
  currentStep: SetupStep;
  userHasMeter: boolean;
  userHasProfile: boolean;
}> {
  try {
    const config = await getUserConfig<User>();
    
    if (!config) {
      return { 
        userConfig: null, 
        currentStep: 'loading',
        userHasMeter: false,
        userHasProfile: false
      };
    }

    // Check if user is admin - skip setup for admins
    if (config.is_admin || config.user_role === 'ADMIN') {
      return {
        userConfig: config,
        currentStep: 'complete',
        userHasMeter: true, // Assume admins don't need meter
        userHasProfile: true // Assume admins don't need profile
      };
    }

    // Check meter registration
    let userHasMeter = false;
    try {
      const meterResponse = await get<any>('meter/my-meter/');
      console.log('Meter response:', meterResponse);
      userHasMeter = !meterResponse.error && meterResponse.data?.success && meterResponse.data.data?.has_meter;
    } catch (error) {
      console.error('Meter check failed:', error);
      userHasMeter = false;
    }
    
    // Check profile completion
    let userHasProfile = false;
    try {
      const profileResponse = await get<any>('auth/user-profile/');
      console.log('Profile response:', profileResponse);
      userHasProfile = !profileResponse.error && profileResponse.data?.completed === true;
    } catch (error) {
      console.error('Profile check failed:', error);
      userHasProfile = false;
    }

    console.log('Setup status:', { userHasMeter, userHasProfile });

    // Determine current step - ONLY for new users who haven't completed setup
    let currentStep: SetupStep = 'complete'; // Default to complete
    
    // If user hasn't completed both steps, show setup
    if (!userHasMeter) {
      currentStep = 'meter';
    } else if (!userHasProfile) {
      currentStep = 'profile';
    }

    return { 
      userConfig: config, 
      currentStep,
      userHasMeter,
      userHasProfile
    };
  } catch (error) {
    console.error('Initial data load failed:', error);
    return { 
      userConfig: null, 
      currentStep: 'loading',
      userHasMeter: false,
      userHasProfile: false
    };
  }
}

function DashboardLoading() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        {/* Desktop sidebar skeleton */}
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="flex-1">
            <div className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2">
                  <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col overflow-x-hidden">
        {/* Header skeleton */}
        <div className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 justify-end">
          <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex items-center">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 justify-center rounded-lg border border-dashed shadow-sm">
            <div className="flex min-w-0 flex-col gap-1 w-full p-4">
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4"></div>
              <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const { userConfig, currentStep, userHasMeter, userHasProfile } = await getInitialData();
  
  return (
    <DashboardClient 
      initialStep={currentStep} 
      userConfig={userConfig}
      userHasMeter={userHasMeter}
      userHasProfile={userHasProfile}
    />
  );
}

