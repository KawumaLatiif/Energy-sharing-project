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

  const staffRoles = ["ADMIN", "CUSTOMER_SERVICE", "OPERATOR"];
  if (!staffRoles.includes(userData.user_role) && !userData.is_admin) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-[220px] lg:w-[260px] shrink-0 flex-col sticky top-0 h-screen overflow-hidden">
        <AdminDesktopSidebar />
      </div>
      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminRightHeader />
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
