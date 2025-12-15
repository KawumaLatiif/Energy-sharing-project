"use client";

import { Suspense, useState, useEffect } from 'react';
import DesktopSidebar from "../_components/desktop-sidebar";
import RightHeader from "../_components/right-header";
import AccountForm from './_components/form';
import AccountDetails from './_components/account-details';
import { getAccountData, updateAccountData, UserAccount } from '@/lib/schema';

const AccountPage = () => {
  const [accountData, setAccountData] = useState<UserAccount | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccountData = async () => {
      try {
        setError(null);
        const data = await getAccountData();
        setAccountData(data);
      } catch (error) {
        console.error('Failed to fetch account data:', error);
        setError('Failed to load account information. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccountData();
  }, []);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

   const handleSave = async (updatedData: UserAccount) => {
    try {
      setError(null);
      const data = await updateAccountData(updatedData);
      setAccountData(data);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update account:', error);
      setError('Failed to update account information. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <DesktopSidebar />
        <div className="flex flex-col">
          <RightHeader />
          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
            <div className="flex items-center">
              <h1 className="text-lg font-semibold md:text-2xl">My Account</h1>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <p>Loading account information...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

   if (error) {
    return (
      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <DesktopSidebar />
        <div className="flex flex-col">
          <RightHeader />
          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
            <div className="flex items-center">
              <h1 className="text-lg font-semibold md:text-2xl">My Account</h1>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <p className="text-red-500 mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Try Again
                </button>
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
            <h1 className="text-lg font-semibold md:text-2xl">My Account</h1>
          </div>

          <div
            className="flex flex-1 justify-center rounded-lg border border-dashed shadow-sm" x-chunk="dashboard-02-chunk-1"
          >
            <div className="flex flex-col gap-1 w-full">
              {isEditing && accountData ? (
                <AccountForm 
                  accountData={accountData} 
                  onCancel={handleCancel} 
                  onSave={handleSave} 
                />
              ) : accountData ? (
                <AccountDetails 
                  accountData={accountData} 
                  onEdit={handleEdit} 
                />
              ) : (
                <div className="p-4 text-center">
                  <p>Failed to load account data.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AccountPage;