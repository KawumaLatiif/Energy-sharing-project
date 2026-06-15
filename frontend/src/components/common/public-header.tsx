"use client";
import { Disclosure } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { ModeToggle } from "../theme-toggle";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { GpawaLogo } from "./gpawa-logo";

const navLinks = [
  { href: "/about",   label: "About"   },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
];

export default function PublicHeader() {
  const { auth } = useAuth();

  return (
    <Disclosure
      as="nav"
      className="sticky top-0 z-50 bg-white/90 dark:bg-slate-950/85 backdrop-blur-xl border-b border-gray-200/60 dark:border-slate-800/60"
    >
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <GpawaLogo href="/" textSize="xl" logoSize={36} />

              {/* Desktop nav */}
              <div className="hidden md:flex items-center gap-1">
                {navLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-lg transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {!auth ? (
                  <>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Link
                        href="/auth/register"
                        className="px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded-xl transition-all"
                      >
                        Sign Up
                      </Link>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Link
                        href="/auth/login"
                        className="px-4 py-2 text-sm font-semibold text-white gpawa-gradient rounded-xl transition-all shadow-md shadow-blue-500/20"
                      >
                        Sign In
                      </Link>
                    </motion.div>
                  </>
                ) : (
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 text-sm font-semibold text-white gpawa-gradient rounded-xl transition-all shadow-md shadow-blue-500/20"
                  >
                    Dashboard
                  </Link>
                )}
                <ModeToggle />
                <Disclosure.Button className="md:hidden ml-1 inline-flex items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                  {open ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          <Disclosure.Panel className="md:hidden border-t border-gray-200/70 dark:border-slate-800/70 bg-white/95 dark:bg-slate-950/90 backdrop-blur-lg">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(({ href, label }) => (
                <Disclosure.Button
                  key={href}
                  as={Link}
                  href={href}
                  className="block px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-900 rounded-lg transition-colors"
                >
                  {label}
                </Disclosure.Button>
              ))}
              {!auth && (
                <div className="pt-2 border-t border-gray-200/70 dark:border-slate-800/70 space-y-2">
                  <Disclosure.Button
                    as={Link}
                    href="/auth/register"
                    className="block w-full text-center px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
                  >
                    Sign Up
                  </Disclosure.Button>
                  <Disclosure.Button
                    as={Link}
                    href="/auth/login"
                    className="block w-full text-center px-3 py-2.5 text-sm font-semibold text-white gpawa-gradient rounded-lg"
                  >
                    Sign In
                  </Disclosure.Button>
                </div>
              )}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
