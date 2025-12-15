import { Suspense } from 'react';
import { getUserConfig } from '@/lib/account';
import { get } from '@/lib/fetch';
import DashboardClient from './dashboard-client';
import { User } from '@/interface/user.interface';

type SetupStep = 'loading' | 'meter' | 'profile' | 'complete';

async function getInitialData(): Promise<{
  userConfig: User | null;
  currentStep: SetupStep;
}> {
  try {
    const config = await getUserConfig<User>();
    
    if (!config) {
      return { userConfig: null, currentStep: 'loading' };
    }

    // Check meter registration
    const meterResponse = await get<any>('meter/my-meter/');
    const userHasMeter = !meterResponse.error && !!meterResponse.data;
    
    // Check profile completion
    let userHasProfile = false;
    try {
      const profileResponse = await get<any>('auth/user-profile/');
      userHasProfile = !profileResponse.error && !!profileResponse.data?.completed;
    } catch (error) {
      console.error('Profile check failed:', error);
    }

    // Determine current step
    let currentStep: SetupStep = 'loading';
    if (!userHasMeter) {
      currentStep = 'meter';
    } else if (!userHasProfile) {
      currentStep = 'profile';
    } else {
      currentStep = 'complete';
    }

    return { userConfig: config, currentStep };
  } catch (error) {
    console.error('Initial data load failed:', error);
    return { userConfig: null, currentStep: 'loading' };
  }
}

// Loading component for Suspense fallback
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
      <div className="flex flex-col">
        {/* Header skeleton */}
        <div className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 justify-end">
          <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex items-center">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
            ))}
          </div>
          <div className="flex flex-1 justify-center rounded-lg border border-dashed shadow-sm">
            <div className="flex flex-col gap-1 w-full p-4">
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
  const { userConfig, currentStep } = await getInitialData();
  
  return <DashboardClient initialStep={currentStep} userConfig={userConfig} />;
}