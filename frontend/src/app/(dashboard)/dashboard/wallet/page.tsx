import { Suspense } from 'react'
import DesktopSidebar from "../_components/desktop-sidebar"
import RightHeader from "../_components/right-header"
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircleIcon, FileTextIcon } from 'lucide-react';


const WalletsPage = async () => {
    return (
        <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
            <DesktopSidebar />
            <div className="flex flex-col">
                <RightHeader />
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
                    <div className="flex items-center">
                        <h1 className="text-lg font-semibold md:text-2xl">Wallet Balance</h1>
                    </div>
                    <div
                        className="flex flex-1 justify-center rounded-lg border border-dashed shadow-sm" x-chunk="dashboard-02-chunk-1"
                    >
                        <div className='flex flex-col md:flex-row gap-2'>
                            <Button asChild variant="outline" className="flex-1">
                                <Link href="/dashboard/request-loan">
                                    <FileTextIcon className="h-4 w-4 mr-2" />
                                    Deposit on your Account
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="flex-1">
                                <Link href="/dashboard/myloans">
                                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                                    Withdraw from your Account
                                </Link>
                            </Button>
                        </div>
                        <div className="flex flex-col gap-1 w-full">
                            <Suspense>

                            </Suspense>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
};

export default WalletsPage;