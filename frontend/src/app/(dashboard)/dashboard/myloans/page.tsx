import { Suspense } from 'react';
import DesktopSidebar from '../_components/desktop-sidebar';
import RightHeader from '../_components/right-header';
import LoanList from './_components/loan-list';
import { get } from '@/lib/fetch';

async function getLoans() {
  try {
    const response = await get<any>('loans/my-loans/');
    
    if (response.error) {
      console.warn('Failed to fetch loans:', response.error);
      return [];
    }

    // Handle different response formats
    return Array.isArray(response.data) 
      ? response.data 
      : response.data.results || response.data.data || [];
  } catch (error) {
    console.error('Error fetching loans:', error);
    return [];
  }
}

export default async function MyloansPage() {
  const loans = await getLoans();

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <DesktopSidebar />
      <div className="flex flex-col">
        <RightHeader />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex items-center">
            <h1 className="text-lg font-semibold md:text-2xl">My Electricity Loans</h1>
          </div>

          <div className="flex flex-1 justify-center rounded-lg border border-dashed shadow-sm">
            <div className="flex flex-col gap-1 w-full p-4">
              <Suspense fallback={<div className="p-4">Loading loans...</div>}>
                <LoanList loans={loans} />
              </Suspense>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}