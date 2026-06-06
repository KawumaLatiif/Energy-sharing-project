import Link from "next/link";
import { Zap } from "lucide-react";

const footerLinks = [
  { href: "/terms",   name: "Terms"   },
  { href: "/privacy", name: "Privacy" },
  { href: "/about",   name: "About"   },
  { href: "/contact", name: "Contact" },
];

export default function PublicFooter() {
  return (
    <footer className="border-t border-gray-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">
              <span className="text-blue-600 dark:text-blue-400">g</span>
              <span className="text-gray-900 dark:text-white">Pawa</span>
            </span>
          </Link>

          {/* Links */}
          <ul className="flex flex-wrap items-center gap-6">
            {footerLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>

          <p className="text-sm text-gray-400 dark:text-gray-500 shrink-0">
            &copy; {new Date().getFullYear()} gPawa. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
