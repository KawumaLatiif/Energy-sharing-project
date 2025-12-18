// // app/admin/layout.tsx
// 'use client';
// import { useEffect, useState } from 'react';
// import { useRouter } from 'next/navigation';
// import AdminDesktopSidebar from './_components/desktop_dashboard';
// import AdminRightHeader from './_components/admin_header';
// import { getUserConfig } from '@/lib/account';

// interface UserConfig {
//   id: number;
//   email: string;
//   first_name: string;
//   last_name: string;
//   user_role: string;
//   is_admin: boolean;
// }

// export default function AdminLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   const router = useRouter();
//   const [isLoading, setIsLoading] = useState(true);

//   // useEffect(() => {
//   //   const checkAdminAccess = async () => {
//   //     try {
//   //       console.log('[ADMIN LAYOUT] Checking admin access...');
        
//   //       const userData = await getUserConfig<UserConfig>();
        
//   //       console.log('[ADMIN LAYOUT] User data:', userData);
        
//   //       if (!userData) {
//   //         console.log('[ADMIN LAYOUT] No user data, redirecting to login');
//   //         router.push('/auth/login');
//   //         return;
//   //       }
        
//   //       console.log('[ADMIN LAYOUT] User role:', userData.user_role);
//   //       console.log('[ADMIN LAYOUT] Is admin:', userData.is_admin);
        
//   //       // Check if user is admin
//   //       if (userData.user_role !== 'ADMIN' && !userData.is_admin) {
//   //         console.log('[ADMIN LAYOUT] User is not admin, redirecting to /dashboard');
//   //         router.push('/dashboard');
//   //       } else {
//   //         console.log('[ADMIN LAYOUT] User is admin, allowing access');
//   //         setIsLoading(false);
//   //       }
//   //     } catch (error) {
//   //       console.error('[ADMIN LAYOUT] Error:', error);
//   //       router.push('/auth/login');
//   //     } finally {
//   //       setIsLoading(false);
//   //     }
//   //   };

//   //   checkAdminAccess();
//   // }, [router]);

//   // Update the useEffect checkAdminAccess function:

// useEffect(() => {
//   const checkAdminAccess = async () => {
//     try {
//       console.log('[ADMIN LAYOUT] Checking admin access...');
      
//       const userData = await getUserConfig<UserConfig>();
      
//       console.log('[ADMIN LAYOUT] User data:', userData);
      
//       if (!userData) {
//         console.log('[ADMIN LAYOUT] No user data, redirecting to login');
//         router.push('/auth/login');
//         return;
//       }
      
//       console.log('[ADMIN LAYOUT] User role:', userData.user_role);
//       console.log('[ADMIN LAYOUT] Is admin:', userData.is_admin);
      
//       // IMPORTANT: Check both user_role and is_admin
//       if (userData.user_role !== 'ADMIN' && userData.is_admin !== true) {
//         console.log('[ADMIN LAYOUT] User is not admin, redirecting to /dashboard');
//         router.push('/dashboard');
//         return; // Add return to prevent setting loading to false
//       } else {
//         console.log('[ADMIN LAYOUT] User is admin, allowing access');
//         setIsLoading(false);
//       }
//     } catch (error) {
//       console.error('[ADMIN LAYOUT] Error:', error);
//       router.push('/auth/login');
//     }
//   };

//   checkAdminAccess();
// }, [router]);

//   if (isLoading) {
//     return (
//       <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
//         <div className="hidden border-r bg-muted/40 md:block">
//           <div className="flex h-full max-h-screen flex-col gap-2">
//             <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
//               <div className="h-8 w-32 bg-muted animate-pulse rounded"></div>
//             </div>
//           </div>
//         </div>
//         <div className="flex flex-col">
//           <div className="flex justify-between h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
//             <div className="h-8 w-32 bg-muted animate-pulse rounded"></div>
//           </div>
//           <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
//             <div className="h-64 bg-muted animate-pulse rounded"></div>
//           </main>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
//       <AdminDesktopSidebar />
//       <div className="flex flex-col">
//         <AdminRightHeader />
//         <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
//           {children}
//         </main>
//       </div>
//     </div>
//   );
// }

// app/admin/layout.tsx   ← Remove 'use client' entirely
import { redirect } from "next/navigation";
import { getUserConfig } from "@/lib/account";
import AdminDesktopSidebar from "./_components/desktop_dashboard";
import AdminRightHeader from "./_components/admin_header";

interface UserConfig {
  user_role: string;
  is_admin: boolean;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userData = await getUserConfig<UserConfig>();

  if (!userData) {
    redirect("/auth/login");
  }

  if (userData.user_role !== "ADMIN" && !userData.is_admin) {
    redirect("/dashboard"); // regular user dashboard
  }

  // If we reach here, user is admin → render layout
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <AdminDesktopSidebar />
      <div className="flex flex-col">
        <AdminRightHeader />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}