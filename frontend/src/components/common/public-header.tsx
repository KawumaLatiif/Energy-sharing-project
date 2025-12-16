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
      className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50"
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
                    className="h-10 w-auto rounded-lg shadow-md"
                  />
                  <span className="hidden sm:block text-2xl font-bold text-gray-900 dark:text-white">
                    <span className="text-blue-600">Energy</span>
                    <span className="text-gray-900 dark:text-white">Share</span>
                  </span>
                </Link>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <Link
                    href="/about"
                    className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md transition-colors"
                  >
                    About
                  </Link>
                  <Link
                    href="/contact"
                    className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md transition-colors"
                  >
                    Contact
                  </Link>
                  <Link
                    href="/privacy"
                    className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md transition-colors"
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
                        className="px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-800/30 rounded-lg transition-all"
                      >
                        Sign Up
                      </Link>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }}>
                      <Link
                        href="/auth/login"
                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-md"
                      >
                        Sign In
                      </Link>
                    </motion.div>
                  </>
                )}
                {auth && (
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-md"
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

          <Disclosure.Panel className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link
                href="/about"
                className="block px-3 py-2 text-base font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
              >
                About
              </Link>
              <Link
                href="/contact"
                className="block px-3 py-2 text-base font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
              >
                Contact
              </Link>
              <Link
                href="/privacy"
                className="block px-3 py-2 text-base font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
              >
                Privacy
              </Link>
              {!auth && (
                <>
                  <Link
                    href="/auth/register"
                    className="block w-full text-left px-3 py-2 text-base font-medium text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-md"
                  >
                    Sign Up
                  </Link>
                  <Link
                    href="/auth/login"
                    className="block w-full text-left px-3 py-2 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
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
