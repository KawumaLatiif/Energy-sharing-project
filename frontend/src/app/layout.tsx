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
  title: "EnergyShare",
  description: "Empowering Sustainable Energy Sharing Across Communities",
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

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen relative font-sans antialiased bg-background text-foreground",
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
            <div className="min-h-dvh grid grid-rows-[auto_1fr_auto] w-full relative">
              {/* Subtle energy wave background for theme */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-green-50/50 dark:from-gray-900/50 dark:to-teal-900/50 pointer-events-none"></div>
              {children}
            </div>
            <Toaster
              position="bottom-center"
              containerClassName="w-full px-4 sm:px-6"
              toastOptions={{
                style: {
                  background: "hsl(var(--background))",
                  color: "hsl(var(--foreground))",
                },
              }}
            />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
