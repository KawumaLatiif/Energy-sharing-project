"use client";

import {
  ArrowUpRight,
  FileTextIcon,
  Forward,
  Home,
  PlusCircleIcon,
  Smartphone,
  User,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import logo from "@/assets/images/logo.jpg";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { IconMoneybag } from "@tabler/icons-react";

const navItems = [
  { href: "/dashboard",               label: "Dashboard",      icon: Home,           exact: true },
  { href: "/dashboard/buy-units",     label: "Buy Units",      icon: PlusCircleIcon  },
  { href: "/dashboard/share",         label: "Share Units",    icon: Forward         },
  { href: "/dashboard/tokens",        label: "My Tokens",      icon: ArrowUpRight    },
  { href: "/dashboard/request-loan",  label: "Request Loan",   icon: IconMoneybag    },
  { href: "/dashboard/myloans",       label: "My Loans",       icon: FileTextIcon    },
  { href: "/dashboard/transactions",  label: "Transactions",   icon: FileTextIcon    },
  { href: "/dashboard/myaccount",     label: "My Account",     icon: User            },
  { href: "/ussd-simulator",          label: "USSD Simulator", icon: Smartphone      },
];

export default function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden border-r border-border bg-card md:flex flex-col h-full max-h-screen">
      {/* Brand */}
      <div className="flex h-[60px] items-center gap-2.5 px-5 border-b border-border shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src={logo}
            alt="gPawa"
            width={32}
            height={32}
            className="rounded-lg object-cover shadow shadow-blue-500/25"
          />
          <span className="font-bold text-base tracking-tight">
            <span className="gpawa-gradient-text">g</span>
            <span className="text-foreground">Pawa</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted border-l-2 border-transparent"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
