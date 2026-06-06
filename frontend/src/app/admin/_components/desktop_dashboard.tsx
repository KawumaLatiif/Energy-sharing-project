'use client';

import {
  Activity,
  BarChart3,
  ClipboardList,
  CreditCard,
  Home,
  Monitor,
  Settings,
  Users,
  UserCog,
  Zap,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navSections = [
  {
    label: 'Overview',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: Home, exact: true },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/admin/users',        label: 'Users',           icon: Users },
      { href: '/admin/meters',       label: 'Meters',          icon: Zap },
      { href: '/admin/loans',        label: 'Credit & Loans',  icon: CreditCard },
      { href: '/admin/transactions', label: 'Transactions',    icon: Activity },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/system-health', label: 'System Health', icon: Monitor },
      { href: '/admin/reports',       label: 'Reports',        icon: BarChart3 },
      { href: '/admin/audit-log',     label: 'Audit Log',      icon: ClipboardList },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/admin/staff',     label: 'Staff Accounts', icon: UserCog },
      { href: '/admin/myaccount', label: 'My Account',     icon: Settings, exact: true },
    ],
  },
];

function GpawaWordmark() {
  return (
    <span className="text-base font-bold tracking-tight select-none">
      <span className="text-blue-400">g</span>
      <span className="text-white">Pawa</span>
    </span>
  );
}

export default function AdminDesktopSidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden md:flex flex-col h-full max-h-screen gpawa-sidebar border-r border-white/5">
      {/* Logo */}
      <div className="flex h-[60px] items-center gap-3 px-5 border-b border-white/8 shrink-0">
        <Link href="/admin/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <GpawaWordmark />
            <span className="text-[10px] text-white/40 font-medium tracking-widest uppercase">Admin Portal</span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/28 px-3 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`gpawa-sidebar-link${active ? ' active' : ''}`}
                  >
                    <Icon className="h-[15px] w-[15px] shrink-0 opacity-80" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-white/8">
        <div className="flex items-center gap-2 text-[11px] text-white/32">
          <Lock className="h-3 w-3 shrink-0" />
          <span>VPN access required</span>
        </div>
      </div>
    </div>
  );
}
