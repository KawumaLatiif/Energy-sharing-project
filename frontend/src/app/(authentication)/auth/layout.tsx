import type { Metadata } from "next";
import "@/styles/globals.css";
import { Inter as FontSans } from "next/font/google";
import PublicHeader from "@/components/common/public-header";
import authenticated from "@/lib/authenticated";
import { get } from "@/lib/fetch";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Power Loans",
  description: "Share with the world",
};

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-current-path") || "";
  const search = headersList.get("x-current-search") || "";
  const isAuth = await authenticated();
  const isVerificationRoute = pathname.startsWith("/auth/verify-email");
  const isVerifiedLoginRoute = pathname === "/auth/login" && search.includes("verified=1");

  if (isAuth && !isVerificationRoute && !isVerifiedLoginRoute) {
    const config = await get<any>("auth/get-user-config/");
    const isAdmin = !config.error && (config.data?.is_admin || config.data?.user_role === "ADMIN");
    redirect(isAdmin ? "/admin/dashboard" : "/dashboard");
  }

  return (
    <>
      <PublicHeader />
      {children}
      {/* <PublicFooter /> */}
    </>
  );
}
