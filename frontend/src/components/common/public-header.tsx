"use client";
import { Disclosure, Menu } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import logo from "@/assets/images/logo.jpg";
import Spinner from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { ModeToggle } from "../theme-toggle";
import { motion } from "framer-motion";

export default function PublicHeader() {
  const [isPending, setIsPending] = useState<boolean>(false);
  const { loading, auth } = useAuth();

  return (
    <Disclosure
      as="nav"
      className="sticky top-0 z-50 bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-slate-800/60 shadow-sm"
    >
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center">
                <Link href="/" className="flex items-center space-x-2">
                  <Image
                    src={logo}
                    width={48}
                    height={48}
                    alt="EnergyShare"
                    className="h-10 w-auto rounded-xl shadow-md ring-1 ring-white/50 dark:ring-slate-800/60"
                  />
                  <span className="hidden sm:block text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                    <span className="text-blue-600">Energy</span>
                    <span className="text-gray-900 dark:text-white">Share</span>
                  </span>
                </Link>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <Link
                    href="/about"
                    className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-lg transition-colors"
                  >
                    About
                  </Link>
                  <Link
                    href="/contact"
                    className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-lg transition-colors"
                  >
                    Contact
                  </Link>
                  <Link
                    href="/privacy"
                    className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-lg transition-colors"
                  >
                    Privacy
                  </Link>
                </div>
              </div>
              <div className="ml-4 flex items-center md:ml-6 gap-2">
                {!auth && (
                  <>
                    <motion.div whileHover={{ scale: 1.02 }}>
                      <Link
                        href="/auth/register"
                        className="px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-100/70 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-800/40 rounded-xl transition-all"
                      >
                        Sign Up
                      </Link>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }}>
                      <Link
                        href="/auth/login"
                        className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 rounded-xl transition-all shadow-md shadow-blue-500/20"
                      >
                        Sign In
                      </Link>
                    </motion.div>
                  </>
                )}
                {auth && (
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 rounded-xl transition-all shadow-md shadow-blue-500/20"
                  >
                    Dashboard
                  </Link>
                )}
                <ModeToggle />
                <Disclosure.Button className="md:hidden ml-2 inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-500 dark:hover:text-gray-300">
                  {open ? (
                    <XMarkIcon className="h-6 w-6" />
                  ) : (
                    <Bars3Icon className="h-6 w-6" />
                  )}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          <Disclosure.Panel className="md:hidden bg-white/95 dark:bg-slate-950/90 border-t border-gray-200/70 dark:border-slate-800/70 backdrop-blur-lg">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link
                href="#"
                className="block px-3 py-2 text-base font-medium text-gray-900 dark:text-white hover:bg-blue-50 dark:hover:bg-slate-900 rounded-lg"
              >
                About
              </Link>
              <Link
                href="#"
                className="block px-3 py-2 text-base font-medium text-gray-900 dark:text-white hover:bg-blue-50 dark:hover:bg-slate-900 rounded-lg"
              >
                Contact
              </Link>
              <Link
                href="#"
                className="block px-3 py-2 text-base font-medium text-gray-900 dark:text-white hover:bg-blue-50 dark:hover:bg-slate-900 rounded-lg"
              >
                Privacy
              </Link>
              {!auth && (
                <>
                  <Link
                    href="/auth/register"
                    className="block w-full text-left px-3 py-2 text-base font-medium text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg"
                  >
                    Sign Up
                  </Link>
                  <Link
                    href="/auth/login"
                    className="block w-full text-left px-3 py-2 text-base font-medium text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 rounded-lg"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
