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