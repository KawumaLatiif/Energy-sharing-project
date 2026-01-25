"use client";

import {
  ArrowRight,
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
  User,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logout from "../logout";
import Image from "next/image";
import logo from "@/assets/images/logo.jpg";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { ModeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { IconMoneybag } from "@tabler/icons-react";
import { useState } from "react";
import { Zap, Settings, LogOut } from "lucide-react";

interface RightHeaderProps {
  onProfileClick?: () => void;
  onMeterClick?: () => void;
}

export default function RightHeader({ onProfileClick, onMeterClick }: RightHeaderProps) {
  const pathname = usePathname();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const handleProfileClick = () => {
    if (onProfileClick) {
      onProfileClick();
      setIsProfileMenuOpen(false);
    }
  };

  const handleMeterClick = () => {
    if (onMeterClick) {
      onMeterClick();
      setIsProfileMenuOpen(false);
    }
  };

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
                alt="Reload Mobile"
              />
              <span className="">Energy Share</span>
            </Link>
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard" }
              )}
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/buy-units"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard/deposit" }
              )}
            >
              <PlusCircleIcon className="h-4 w-4" />
              Buy Units
            </Link>
            <Link
              href="/dashboard/share"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard/share" }
              )}
            >
              <Forward className="h-4 w-4" />
              Share Units
            </Link>            
            <Link
              href="/dashboard/transfering"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard/transfering" }
              )}
            >
              <ArrowRight className="h-4 w-4" />
              Transfer Units
            </Link>
            <Link
              href="/dashboard/tokens"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard/withdraw" }
              )}
            >
              <ArrowUpRight className="h-4 w-4" />
              Tokens
            </Link>
            <Link
              href="/dashboard/request-loan"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                {
                  "bg-muted text-primary":
                    pathname === "/dashboard/request-loan",
                }
              )}
            >
              <IconMoneybag className="h-4 w-4" />
              Request Loan
            </Link>

            <Link
              href="/dashboard/myloans"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard/myloans" }
              )}
            >
              <FileTextIcon className="h-4 w-4" />
              My Loans
            </Link>
            <Link
              href={`/dashboard/transactions`}
              className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary", { "bg-muted text-primary": pathname === "/dashboard/transactions" })}
            >
              <Forward className="h-4 w-4" />
              Transaction
            </Link>
            <Link
              href={`/dashboard/myaccount`}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard/myaccount" }
              )}
            >
              <Forward className="h-4 w-4" />
              My Account
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
      
      <div className="flex items-center gap-3">
        {/* Profile Management Button (visible on desktop) */}
        {/* {onProfileClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleProfileClick}
            className="hidden md:flex items-center gap-2"
          >
            <User className="h-4 w-4" />
            Manage Profile
          </Button>
        )} */}
        
        <ModeToggle />
        
        <DropdownMenu open={isProfileMenuOpen} onOpenChange={setIsProfileMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="rounded-full">
              <CircleUser className="h-5 w-5" />
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Profile Management Option */}
            {onProfileClick && (
              <DropdownMenuItem onClick={handleProfileClick}>
                <User className="h-4 w-4 mr-2" />
                Manage Profile
              </DropdownMenuItem>
            )}
            
            {/* Meter Management Option */}
            {onMeterClick && (
              <DropdownMenuItem onClick={handleMeterClick}>
                <Zap className="h-4 w-4 mr-2" />
                Manage Meter
              </DropdownMenuItem>
            )}
            
            <DropdownMenuItem asChild>
              <Link href="/dashboard/myaccount">
                <Settings className="h-4 w-4 mr-2" />
                Account Settings
              </Link>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem asChild>
              <Link href="/dashboard/transactions">
                <FileTextIcon className="h-4 w-4 mr-2" />
                Transaction History
              </Link>
            </DropdownMenuItem>
            
            <DropdownMenuItem asChild>
              <Link href="/dashboard/myloans">
                <IconMoneybag className="h-4 w-4 mr-2" />
                My Loans
              </Link>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem asChild>
              <span
                onClick={async () => {
                  await logout();
                }}
                className="w-full text-left cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}