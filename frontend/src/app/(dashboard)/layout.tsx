// import { User } from "@/interface/user.interface";
// import { getUserConfig } from "@/lib/account";
// import authenticated from "@/lib/authenticated";
// import "@/styles/globals.css";
// import type { Metadata } from "next";
// import { Inter as FontSans } from "next/font/google";
// import { headers } from "next/headers";
// import { redirect } from "next/navigation";


// const fontSans = FontSans({
//   subsets: ["latin"],
//   variable: "--font-sans",
// })

// export const metadata: Metadata = {
//   title: "Energy share | Home",
//   description: "Share with the world",
// };

// export default async function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {

//   // check if the user is authenticated
//   const headersList = await headers();
//   const pathname = headersList.get("x-current-path") || "";
//   const isAuth = await authenticated()

//   if (!isAuth) {
//     redirect("/auth/login");
//   }

//   // console.log(`Intermediate layout: latest :: ${pathname}`)
//   if (isAuth) {
//     const userConfig = await getUserConfig<User>()
//     console.log({ userConfig })
//     const email_verified = userConfig?.profile?.email_verified
//     if (userConfig && email_verified === false && pathname !== "/ck/verify/email") {
//       // static logout
//       // cookies().delete(AUTHENTICATION_COOKIE)
//       redirect("/auth/verify-email")
//     }
//   }

//   return (
//     <>{children}</>
//   );
// }

// app/(user)/layout.tsx
import { User } from "@/interface/user.interface";
import { getUserConfig } from "@/lib/account";
import authenticated from "@/lib/authenticated";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function UserProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-current-path") || "";
  const isAuth = await authenticated();

  if (!isAuth) {
    redirect("/auth/login");
  }

  const userConfig = await getUserConfig<User>();
  const email_verified = userConfig?.profile?.email_verified;

  if (userConfig && email_verified === false && pathname !== "/ck/verify/email") {
    redirect("/auth/verify-email");
  }

  return <>{children}</>;
}
