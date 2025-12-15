"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DesktopSidebar from './_components/desktop-sidebar';
import RightHeader from './_components/right-header';
import LoanOverview from './_components/loan-overview';
import MeterRegistrationPopup from './_components/meter-registration-popup';
import UserProfilePopup from './_components/user-profile-popup';
import { User } from '@/interface/user.interface';

type SetupStep = 'loading' | 'meter' | 'profile' | 'complete';

interface DashboardClientProps {
  initialStep: SetupStep;
  userConfig: User | null;
}

export default function DashboardClient({ 
  initialStep, 
  userConfig 
}: DashboardClientProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>(initialStep);
  const [isMeterPopupOpen, setIsMeterPopupOpen] = useState(false);
  const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
  const router = useRouter();

  // Initialize popup states based on initial step
  useEffect(() => {
    if (initialStep === 'meter') {
      setIsMeterPopupOpen(true);
    } else if (initialStep === 'profile') {
      setIsProfilePopupOpen(true);
    }
  }, [initialStep]);

  const handleMeterSuccess = () => {
    setIsMeterPopupOpen(false);
    setCurrentStep('profile');
    setIsProfilePopupOpen(true);
    // Refresh server data
    router.refresh();
  };

  const handleProfileSuccess = () => {
    setIsProfilePopupOpen(false);
    setCurrentStep('complete');
    // Refresh server data to get updated state
    router.refresh();
  };

  const handleMeterClose = () => {
    if (currentStep === 'meter') {
      // For required steps, don't allow closing - keep it open
      return;
    }
    setIsMeterPopupOpen(false);
  };

  const handleProfileClose = () => {
    if (currentStep === 'profile') {
      // For required steps, don't allow closing - keep it open
      return;
    }
    setIsProfilePopupOpen(false);
  };

  // Show loading state
  if (currentStep === 'loading' || !userConfig) {
    return (
      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <DesktopSidebar />
        <div className="flex flex-col">
          <RightHeader />
          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                <p>Setting up your account...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <DesktopSidebar />
      <div className="flex flex-col">
        <RightHeader />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex items-center">
            <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
          </div>

          {/* Meter Registration Popup */}
          <MeterRegistrationPopup
            isOpen={isMeterPopupOpen}
            onClose={handleMeterClose}
            onSuccess={handleMeterSuccess}
            forceCompletion={currentStep === 'meter'}
          />

          {/* User Profile Popup */}
          <UserProfilePopup
            isOpen={isProfilePopupOpen}
            onClose={handleProfileClose}
            onSuccess={handleProfileSuccess}
            forceCompletion={currentStep === 'profile'}
          />

          {/* Full Dashboard Content */}
          {currentStep === 'complete' && (
            <>
              <LoanOverview />
              <div className="flex flex-1 justify-center rounded-lg border border-dashed shadow-sm">
                <div className="flex flex-col gap-1 w-full">
                  <h3 className="text-2xl text-left font-bold tracking-tight p-4">
                    Latest transactions
                  </h3>
                  {/* Add your transactions component here */}
                  <div className="p-4 text-center text-muted-foreground">
                    No recent transactions
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Setup in Progress Message */}
          {(currentStep === 'meter' || currentStep === 'profile') && (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                <div className="flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">
                  {currentStep === 'meter' 
                    ? "Complete Meter Registration" 
                    : "Complete Your Profile"}
                </h3>
                <p className="mb-4 mt-2 text-sm text-muted-foreground">
                  {currentStep === 'meter'
                    ? "Please register your electricity meter to continue using Power Cred services."
                    : "Complete your profile setup to access all features and loan services."}
                </p>
                <p className="text-xs text-muted-foreground">
                  Follow the steps in the popup above to continue.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}