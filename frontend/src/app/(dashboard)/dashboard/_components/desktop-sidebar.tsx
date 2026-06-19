"use client";

import Link from "next/link";
import { Smartphone } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { GpawaLogo } from "@/components/common/gpawa-logo";
import DashboardNavLinks from "@/components/dashboard/dashboard-nav-links";

export default function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <GpawaLogo href="/" textSize="lg" logoSize={40} />
        </div>
        <div className="flex-1">
          <DashboardNavLinks />
          <div className="mt-2 px-2 lg:px-4">
            <Link
              href="/ussd-simulator"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/ussd-simulator" }
              )}
            >
              <Smartphone className="h-4 w-4" />
              USSD Simulator
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
