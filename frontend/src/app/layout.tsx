import { ThemeProvider } from "@/components/theme-provider";
import authenticated from "@/lib/authenticated";
import { cn } from "@/lib/utils";
import Providers from "@/providers";
import "@/styles/globals.css";
import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import { headers } from "next/headers";
import { Toaster } from "react-hot-toast";
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
  const isAuth = await authenticated();
  const headersList = await headers();
  // const pathname = headersList.get("x-current-path") || "";

  return (
    <html lang="en">
      <body
        className={cn(
          "min-h-screen relative  font-sans antialiased bg-white dark:bg-gray-900 max-w-full",
          fontSans.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            <div className="min-h-[100dvh] grid grid-rows-[auto_1fr_auto]">
              {children}
            </div>
            <Toaster position="bottom-center" />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
