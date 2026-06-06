'use client';

import {
  Activity, BarChart3, ClipboardList, CreditCard,
  Home, Menu, Monitor, Settings, Users, UserCog, Zap, LogOut, CircleUser,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ModeToggle } from '@/components/theme-toggle';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import logout from '@/app/(dashboard)/dashboard/logout';

const mobileNav = [
  { href: '/admin/dashboard',    label: 'Dashboard',      icon: Home },
  { href: '/admin/users',        label: 'Users',          icon: Users },
  { href: '/admin/meters',       label: 'Meters',         icon: Zap },
  { href: '/admin/loans',        label: 'Credit & Loans', icon: CreditCard },
  { href: '/admin/transactions', label: 'Transactions',   icon: Activity },
  { href: '/admin/system-health',label: 'System Health',  icon: Monitor },
  { href: '/admin/reports',      label: 'Reports',        icon: BarChart3 },
  { href: '/admin/audit-log',    label: 'Audit Log',      icon: ClipboardList },
  { href: '/admin/staff',        label: 'Staff Accounts', icon: UserCog },
  { href: '/admin/myaccount',    label: 'My Account',     icon: Settings },
];

export default function AdminRightHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="flex justify-between md:justify-end h-[60px] items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-4 lg:px-6 shrink-0">
      {/* Mobile hamburger */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 gpawa-sidebar border-r border-white/5">
          <div className="flex h-[60px] items-center gap-2.5 px-5 border-b border-white/8">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">
              <span className="text-blue-400">g</span>
              <span className="text-white">Pawa</span>
              <span className="text-white/40 text-xs ml-1.5 font-normal">Admin</span>
            </span>
          </div>
          <nav className="p-3 space-y-0.5">
            {mobileNav.map(({ href, label, icon: Icon }) => {
              const active = href === '/admin/dashboard'
                ? pathname === href
                : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`gpawa-sidebar-link${active ? ' active' : ''}`}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <ModeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 border border-border">
              <CircleUser className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">Staff Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/myaccount" className="flex items-center gap-2">
                <Settings className="h-3.5 w-3.5" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
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
