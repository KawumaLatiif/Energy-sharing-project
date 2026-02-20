"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DesktopSidebar from './_components/desktop-sidebar';
import RightHeader from './_components/right-header';
import LoanOverview from './_components/loan-overview';
import MeterRegistrationPopup from './_components/meter-registration-popup';
import UserProfilePopup from './_components/user-profile-popup';
import ProfileManagementModal from './_components/profile-management-modal';
import { User } from '@/interface/user.interface';
import LatestTransactions from './_components/latest-transactions';
import { CheckCircle, User as UserIcon, Zap } from 'lucide-react';
import MeterManagementModal from './_components/meter-registration-modal';

type SetupStep = 'loading' | 'meter' | 'profile' | 'complete';

interface DashboardClientProps {
  initialStep: SetupStep;
  userConfig: User | null;
  userHasMeter: boolean;
  userHasProfile: boolean;
}

export default function DashboardClient({ 
  initialStep, 
  userConfig,
  userHasMeter,
  userHasProfile
}: DashboardClientProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>(initialStep);
  const [isMeterPopupOpen, setIsMeterPopupOpen] = useState(false);
  const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
  const [isMeterManagementOpen, setIsMeterManagementOpen] = useState(false);
  const [isProfileManagementOpen, setIsProfileManagementOpen] = useState(false);
  const [userData, setUserData] = useState<User | null>(userConfig);
  const router = useRouter();

  // Initialize popup states based on initial step (for new users)
  useEffect(() => {
    console.log('Initial step:', initialStep, 'User has meter:', userHasMeter, 'User has profile:', userHasProfile);
    
    // Only show setup popups for new users who haven't completed setup
    if (initialStep === 'meter' && !userHasMeter) {
      setIsMeterPopupOpen(true);
    } else if (initialStep === 'profile' && !userHasProfile) {
      setIsProfilePopupOpen(true);
    } else {
      // Existing users or completed setup - no popups
      setCurrentStep('complete');
    }
  }, [initialStep, userHasMeter, userHasProfile]);

  const handleMeterSuccess = () => {
    setIsMeterPopupOpen(false);
    // Only move to profile step if user doesn't have profile yet
    if (!userHasProfile) {
      setCurrentStep('profile');
      setIsProfilePopupOpen(true);
    } else {
      setCurrentStep('complete');
    }
    router.refresh();
  };

  const handleProfileSuccess = () => {
    setIsProfilePopupOpen(false);
    setCurrentStep('complete');
    router.refresh();
  };

  const handleMeterManagementSuccess = () => {
    setIsMeterManagementOpen(false);
    router.refresh();
  };

  const handleProfileManagementSuccess = () => {
    setIsProfileManagementOpen(false);
    router.refresh();
  };

  const openMeterManagement = () => {
    setIsMeterManagementOpen(true);
  };

  const openProfileManagement = () => {
    setIsProfileManagementOpen(true);
  };

  // Show loading state
  if (currentStep === 'loading' || !userData) {
    return (
      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <DesktopSidebar />
        <div className="flex min-w-0 flex-col overflow-x-hidden">
          <RightHeader />
          <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                <p>Loading dashboard...</p>
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
      <div className="flex min-w-0 flex-col overflow-x-hidden">
        <RightHeader 
          onProfileClick={openProfileManagement}
          onMeterClick={openMeterManagement}
        />
        
        {/* Meter Registration Popup (Setup Mode for new users) */}
        {currentStep === 'meter' && !userHasMeter && (
          <MeterRegistrationPopup
            isOpen={isMeterPopupOpen}
            onClose={() => setIsMeterPopupOpen(false)}
            onSuccess={handleMeterSuccess}
            forceCompletion={currentStep === 'meter'}
          />
        )}

        {/* User Profile Popup (Setup Mode for new users) */}
        {currentStep === 'profile' && !userHasProfile && (
          <UserProfilePopup
            isOpen={isProfilePopupOpen}
            onClose={() => setIsProfilePopupOpen(false)}
            onSuccess={handleProfileSuccess}
            forceCompletion={currentStep === 'profile'}
            mode="setup"
          />
        )}

        {/* Meter Management Modal (For existing users to edit) */}
        <MeterManagementModal
          isOpen={isMeterManagementOpen}
          onClose={() => setIsMeterManagementOpen(false)}
          onSuccess={handleMeterManagementSuccess}
          userData={userData}
        />

        {/* Profile Management Modal (For existing users to edit) */}
        <ProfileManagementModal
          isOpen={isProfileManagementOpen}
          onClose={() => setIsProfileManagementOpen(false)}
          onSuccess={handleProfileManagementSuccess}
          userData={userData}
          mode="edit"
        />

        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
            
            {/* Quick Action Buttons */}
            {currentStep === 'complete' && (
              <div className="flex gap-2">
                <button
                  onClick={openMeterManagement}
                  className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  {userHasMeter ? 'Manage Meter' : 'Register Meter'}
                </button>
                <button
                  onClick={openProfileManagement}
                  className="px-4 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-2"
                >
                  <UserIcon className="h-4 w-4" />
                  Manage Profile
                </button>
              </div>
            )}
          </div>

          {/* Setup in Progress Message (for new users) */}
          {(currentStep === 'meter' || currentStep === 'profile') && (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                <div className="flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">
                  {currentStep === 'meter' 
                    ? "Step 1: Complete Meter Registration" 
                    : "Step 2: Complete Your Profile"}
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

          {/* Full Dashboard Content (for existing/completed users) */}
          {/* {currentStep === 'complete' && (
            <>
              {/* Setup Completion Banner *
              <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Setup Complete!</h3>
                      <p className="text-sm text-gray-600">
                        {userHasProfile ? 'Profile is complete.' : 'Profile needs completion.'} 
                        {userHasMeter ? ' Meter is registered.' : ' Meter not registered.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={openMeterManagement}
                      className="px-4 py-2 text-sm bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
                    >
                      <Zap className="h-4 w-4" />
                      {userHasMeter ? 'View Meter' : 'Register Meter'}
                    </button>
                    <button
                      onClick={openProfileManagement}
                      className="px-4 py-2 text-sm bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors flex items-center gap-2"
                    >
                      <UserIcon className="h-4 w-4" />
                      Manage Profile
                    </button>
                  </div>
                </div>
              </div>*/}

              {/* Dashboard Content */}
              <LoanOverview />
              <div className="flex flex-1 justify-center rounded-lg border border-dashed shadow-sm">
                <div className="flex flex-col gap-1 w-full">
                  <h3 className="text-2xl text-left font-bold tracking-tight p-4">
                    Latest transactions
                  </h3>
                  <LatestTransactions />
                </div>
              </div>
            {/* </> */}
        </main>
      </div>
    </div>
  );
}
