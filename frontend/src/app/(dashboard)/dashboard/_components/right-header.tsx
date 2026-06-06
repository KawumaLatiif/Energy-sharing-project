"use client";

import {
  ArrowUpRight,
  CircleUser,
  FileTextIcon,
  Forward,
  Home,
  Menu,
  PlusCircleIcon,
  Settings,
  Smartphone,
  User,
  Zap,
  LogOut,
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
import { ModeToggle } from "@/components/theme-toggle";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { IconMoneybag } from "@tabler/icons-react";
import logout from "../logout";

interface RightHeaderProps {
  onProfileClick?: () => void;
  onMeterClick?: () => void;
}

const mobileNav = [
  { href: "/dashboard",              label: "Dashboard",      icon: Home,           exact: true },
  { href: "/dashboard/buy-units",    label: "Buy Units",      icon: PlusCircleIcon  },
  { href: "/dashboard/share",        label: "Share Units",    icon: Forward         },
  { href: "/dashboard/tokens",       label: "My Tokens",      icon: ArrowUpRight    },
  { href: "/dashboard/request-loan", label: "Request Loan",   icon: IconMoneybag    },
  { href: "/dashboard/myloans",      label: "My Loans",       icon: FileTextIcon    },
  { href: "/dashboard/transactions", label: "Transactions",   icon: FileTextIcon    },
  { href: "/dashboard/myaccount",    label: "My Account",     icon: User            },
  { href: "/ussd-simulator",         label: "USSD Simulator", icon: Smartphone      },
];

export default function RightHeader({ onProfileClick, onMeterClick }: RightHeaderProps) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <header className="flex justify-between md:justify-end h-[60px] items-center gap-3 border-b border-border bg-card/80 backdrop-blur-sm px-4 lg:px-6 shrink-0">
      {/* Mobile sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 bg-card border-r border-border">
          <div className="flex h-[60px] items-center gap-2.5 px-5 border-b border-border">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow shadow-blue-500/20">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight">
              <span className="text-primary">g</span>
              <span className="text-foreground">Pawa</span>
            </span>
          </div>
          <nav className="p-3 space-y-0.5">
            {mobileNav.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSheetOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all border-l-2",
                    active
                      ? "bg-primary/10 text-primary border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {onMeterClick && (
          <Button variant="ghost" size="sm" className="hidden md:flex gap-2 text-xs" onClick={onMeterClick}>
            <Zap className="h-3.5 w-3.5" /> Meter
          </Button>
        )}
        <ModeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 border border-border">
              <CircleUser className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {onProfileClick && (
              <DropdownMenuItem onClick={onProfileClick} className="gap-2">
                <User className="h-3.5 w-3.5" /> Manage Profile
              </DropdownMenuItem>
            )}
            {onMeterClick && (
              <DropdownMenuItem onClick={onMeterClick} className="gap-2">
                <Zap className="h-3.5 w-3.5" /> Manage Meter
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/dashboard/myaccount" className="flex items-center gap-2">
                <Settings className="h-3.5 w-3.5" /> Account Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/transactions" className="flex items-center gap-2">
                <FileTextIcon className="h-3.5 w-3.5" /> Transactions
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/myloans" className="flex items-center gap-2">
                <IconMoneybag className="h-3.5 w-3.5" /> My Loans
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive gap-2 cursor-pointer"
              onClick={async () => { await logout(); }}
            >
              <LogOut className="h-3.5 w-3.5" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
