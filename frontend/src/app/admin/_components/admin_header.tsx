'use client';
import {
  ArrowUpRight,
  CircleUser,
  FileTextIcon,
  Forward,
  Home,
  LineChart,
  Menu,
  Package,
  Package2,
  PlusCircleIcon,
  Search,
  ShoppingCart,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Image from "next/image";
import logo from "@/assets/images/logo.jpg";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { ModeToggle } from "@/components/theme-toggle";
import { IconMoneybag } from "@tabler/icons-react";
import { Zap } from "lucide-react";
import logout from "@/app/(dashboard)/dashboard/logout";

export default function AdminRightHeader() {
  const pathname = usePathname();

  return (
    <header className="flex justify-between sm:justify-end h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
          <nav className="grid gap-2 text-lg font-medium">
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
              <Forward className="h-4 w-4" />
              My Account
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="rounded-full">
            <CircleUser className="h-5 w-5" />
            <span className="sr-only">Toggle user menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/admin/myaccount">Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <span
              onClick={async () => {
                await logout();
              }}
            >
              Logout
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ModeToggle />
    </header>
  );
}