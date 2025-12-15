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
export default function PublicHeader() {
  const user: any = null;

  const [isPending, setIsPending] = useState<boolean>(false);

  const { loading, auth } = useAuth();

  return (
    <div className="sticky top-0 z-50">
      <Disclosure
        as={"nav"}
        className={
          "dark:bg-gray-900 bg-white border-b border-slate-200 dark:border-none"
        }
      >
        <div className={"mx-auto max-w-7xl sm:px-8"}>
          <div className={"relative flex h-16 justify-between sm:-ml-8"}>
            <div className={"flex grow"}>
              <div className={"flex w-1/3 justify-between items-center"}>
                <Link
                  className={
                    "flex space-x-3 text-nowrap font-mono text-lg font-bold sm:items-center"
                  }
                  href={"/"}
                >
                  <div className="bg-white rounded-md max-sm:ml-8">
                    <Image
                      src={logo}
                      width={200}
                      height={200}
                      alt="Digital Repository"
                      className="h-10 sm:h-14 rounded-md w-auto dark:text-white text-slate-100"
                    />
                  </div>
                  <h1 className="hidden sm:block text-white text-3xl font-bold text-nowrap">
                    <span className="text-sky-500">Power</span>{" "}
                    <span className="text-gray-900 dark:text-white mr-0">
                      Loans
                    </span>
                  </h1>
                </Link>
              </div>

              <div className={"flex w-full items-center justify-end"}>
                <div
                  className={"hidden space-x-8 sm:ml-6 sm:flex sm:items-center"}
                >
                  <Link
                    className="text-sm font-medium dark:text-white dark:hover:text-gray-100 text-sky-500 hover:text-teal-800"
                    href={"/about"}
                  >
                    About
                  </Link>

                  <Link
                    className="text-sm font-medium dark:text-white dark:hover:text-gray-100 text-sky-500 hover:text-teal-800"
                    href={"#"}
                  >
                    Contact-us
                  </Link>

                  <Link
                    className="text-sm font-medium dark:text-white dark:hover:text-gray-100 text-sky-500 hover:text-teal-800"
                    href={"#"}
                  >
                    Privacy
                  </Link>

                  {!auth && (
                    <>
                      <Link
                        href="/auth/register"
                        className="bg-transparent no-underline group cursor-pointer relative shadow-2xl shadow-red-900 rounded-full p-px text-xs font-semibold leading-6  dark:text-white inline-block"
                      >
                        <span className="absolute inset-0 overflow-hidden rounded-full">
                          <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"></span>
                        </span>
                        <div className="relative flex space-x-2 items-center text-sky-500 justify-between z-10 rounded-full dark:bg-transparent py-0.5 px-4 ring-1 dark:ring-white/10 dark:text-white">
                          <span>Create account</span>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                              d="M10.75 8.75L14.25 12L10.75 15.25"
                            ></path>
                          </svg>
                        </div>
                        <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-red-400/0 via-red-400/90 to-emerald-400/0 transition-opacity duration-500 group-hover:opacity-40"></span>
                      </Link>

                      <Link
                        href="/auth/login"
                        className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6  text-white inline-block"
                      >
                        <span className="absolute inset-0 overflow-hidden rounded-full">
                          <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"></span>
                        </span>
                        <div className="relative flex space-x-2 items-center z-10 rounded-full bg-sky-500 py-0.5 px-4 ring-1 ring-white/10 ">
                          <span>Sign In</span>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                              d="M10.75 8.75L14.25 12L10.75 15.25"
                            ></path>
                          </svg>
                        </div>
                        <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-emerald-400/0 via-emerald-400/90 to-emerald-400/0 transition-opacity duration-500 group-hover:opacity-40"></span>
                      </Link>
                    </>
                  )}

                  {auth && (
                    <Link
                      href="/dashboard"
                      className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6  text-white inline-block"
                    >
                      <span className="absolute inset-0 overflow-hidden rounded-full">
                        <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"></span>
                      </span>
                      <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10 ">
                        <span>Dashboard</span>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                            d="M10.75 8.75L14.25 12L10.75 15.25"
                          ></path>
                        </svg>
                      </div>
                      <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-emerald-400/0 via-emerald-400/90 to-emerald-400/0 transition-opacity duration-500 group-hover:opacity-40"></span>
                    </Link>
                  )}

                  <ModeToggle />
                </div>
              </div>
            </div>

            <div
              className={
                "absolute inset-y-0 right-0 flex items-center space-x-3"
              }
            >
              {user && (
                <Menu as={"div"} className={"relative mr-3"}>
                  <Menu.Button
                    className={"flex items-center space-x-3 text-sm"}
                  >
                    <span className={"font-medium text-gray-900"}>
                      {user?.name}
                    </span>

                    <Image
                      src={user?.avatar_url}
                      width={40}
                      height={40}
                      className={"h-8 w-8 rounded-full"}
                      alt={user.name || ""}
                    />
                  </Menu.Button>

                  <Menu.Items
                    className={
                      "absolute right-0 z-10 mt-2 w-48 border border-b-slate-200 bg-white focus:outline-0"
                    }
                  >
                    <Menu.Item as={"div"}>
                      {({ active }) => (
                        <Link
                          href={"#"}
                          className={`block w-full px-4 py-2 text-left text-sm text-gray-900 ${
                            active ? "bg-gray-100" : ""
                          }`}
                        >
                          Dashboard
                        </Link>
                      )}
                    </Menu.Item>

                    <Menu.Item as={"div"}>
                      {({ active }) => (
                        <Link
                          href={"#"}
                          className={`block w-full px-4 py-2 text-left text-sm text-gray-900 ${
                            active ? "bg-gray-100" : ""
                          }`}
                        >
                          Account
                        </Link>
                      )}
                    </Menu.Item>

                    <Menu.Item as={"div"}>
                      {({ active }) => (
                        <Link
                          href={"#"}
                          className={`block w-full px-4 py-2 text-left text-sm text-gray-900 ${
                            active ? "bg-gray-100" : ""
                          }`}
                        >
                          Security
                        </Link>
                      )}
                    </Menu.Item>

                    <Menu.Item as={"div"}>
                      {({ active }) => (
                        <Button type="button" variant={"link"} asChild={true}>
                          <Link
                            className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm text-gray-900 ${
                              active ? "bg-gray-100" : ""
                            }`}
                            href="/api/account/logout"
                          >
                            <span>Signout</span>
                            {isPending ? <Spinner className="h-4 w-4" /> : null}
                          </Link>
                        </Button>
                      )}
                    </Menu.Item>
                  </Menu.Items>
                </Menu>
              )}

              <Disclosure.Button
                className={
                  "relative p-2 dark:text-white dark:hover:bg-gray-100 text-gray-900 sm:hidden"
                }
              >
                {({ open }) =>
                  !open ? (
                    <Bars3Icon className={"block h-6 w-6"} />
                  ) : (
                    <XMarkIcon className={"block h-6 w-6"} />
                  )
                }
              </Disclosure.Button>
            </div>
          </div>
        </div>

        <Disclosure.Panel className={"sm:hidden"}>
          {!user && (
            <div className={"space-y-1 pb-3"}>
              <Link
                href={"#"}
                className={"block px-8 py-2 font-medium dark:text-white"}
              >
                Company
              </Link>

              <Link
                href={"#"}
                className={"block px-8 py-2 font-medium dark:text-white"}
              >
                Products
              </Link>

              <Link
                href={"#"}
                className={"block px-8 py-2 font-medium dark:text-white"}
              >
                Download
              </Link>

              <div className="h-1 w-full border-b border-0.5 border-red-300" />

              <div className="flex flex-col space-y-4 px-8">
                <Link
                  href="/auth/register"
                  className="bg-transparent no-underline group cursor-pointer relative shadow-2xl shadow-red-900 rounded-full p-px text-xs font-semibold leading-6  dark:text-white inline-block"
                >
                  <span className="absolute inset-0 overflow-hidden rounded-full">
                    <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"></span>
                  </span>
                  <div className="relative flex space-x-2 items-center justify-between z-10 rounded-full dark:bg-transparent py-0.5 px-4 ring-1 dark:ring-white/10 ">
                    <span>Create account</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M10.75 8.75L14.25 12L10.75 15.25"
                      ></path>
                    </svg>
                  </div>
                  <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-red-400/0 via-red-400/90 to-emerald-400/0 transition-opacity duration-500 group-hover:opacity-40"></span>
                </Link>

                <Link
                  href="/auth/login"
                  className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6  text-white inline-block"
                >
                  <span className="absolute inset-0 overflow-hidden rounded-full">
                    <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"></span>
                  </span>
                  <div className="relative flex space-x-2 items-center justify-between z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10 ">
                    <span>Sign In</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M10.75 8.75L14.25 12L10.75 15.25"
                      ></path>
                    </svg>
                  </div>
                  <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-emerald-400/0 via-emerald-400/90 to-emerald-400/0 transition-opacity duration-500 group-hover:opacity-40"></span>
                </Link>
              </div>
            </div>
          )}
        </Disclosure.Panel>
      </Disclosure>
    </div>
  );
}
