'use client';
import {
  ArrowUpRight,
  Bell,
  FileTextIcon,
  Forward,
  Home,
  LineChart,
  Package,
  Package2,
  PlusCircleIcon,
  ShoppingCart,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import logo from "@/assets/images/logo.jpg";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { IconMoneybag } from "@tabler/icons-react";
import { PersonIcon } from "@radix-ui/react-icons";

export default function AdminDesktopSidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Image
              src={logo}
              width={40}
              height={400}
              className="w-18 auto"
              alt="Power Cred"
            />
            <span className="">Power Cred Admin</span>
          </Link>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            <Link
              href="/admin/dashboard"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/admin/dashboard" }
              )}
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/admin/users"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname.startsWith("/admin/users") }
              )}
            >
              <Users className="h-4 w-4" />
              Manage Users
            </Link>
            <Link
              href="/admin/meters"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname.startsWith("/admin/meters") }
              )}
            >
              <Zap className="h-4 w-4" />
              Manage Meters
            </Link>
            <Link
              href="/admin/loans"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname.startsWith("/admin/loans") }
              )}
            >
              <IconMoneybag className="h-4 w-4" />
              Manage Loans
            </Link>
            <Link
              href="/admin/myaccount"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/admin/myaccount" }
              )}
            >
              <PersonIcon className="h-4 w-4" />
              My Account
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}