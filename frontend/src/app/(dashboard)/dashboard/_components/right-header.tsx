"use client";
import {
  ArrowRight,
  ArrowUpRight,
  CircleUser,
  FileTextIcon,
  Forward,
  Home,
  LineChart,
  Menu,
  Package,
  Package2,
  PlusCircleIcon,
  Search,
  ShoppingCart,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logout from "../logout";
import Image from "next/image";
import logo from "@/assets/images/logo.jpg";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { ModeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { IconMoneybag } from "@tabler/icons-react";

export default function RightHeader() {
  const pathname = usePathname();
  // const {user, loading} = useAccount()

  return (
    <header className="flex justify-between sm:justify-end h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
          <nav className="grid gap-2 text-lg font-medium">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Image
                src={logo}
                width={40}
                height={400}
                className="w-18 auto"
                alt="Reload Mobile"
              />
              <span className="">Energy Share</span>
            </Link>
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard" }
              )}
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/buy-units"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard/deposit" }
              )}
            >
              <PlusCircleIcon className="h-4 w-4" />
              Buy Units
            </Link>
            <Link
              href="/dashboard/share"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard/share" }
              )}
            >
              <Forward className="h-4 w-4" />
              Share Units
            </Link>            
            <Link
              href="/dashboard/transfering"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard/transfering" }
              )}
            >
              <ArrowRight className="h-4 w-4" />
              Transfer Units
            </Link>
            <Link
              href="/dashboard/tokens"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard/withdraw" }
              )}
            >
              <ArrowUpRight className="h-4 w-4" />
              Tokens
            </Link>
            <Link
              href="/dashboard/request-loan"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                {
                  "bg-muted text-primary":
                    pathname === "/dashboard/request-loan",
                }
              )}
            >
              <IconMoneybag className="h-4 w-4" />
              Request Loan
            </Link>

            <Link
              href="/dashboard/myloans"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard/myloans" }
              )}
            >
              <FileTextIcon className="h-4 w-4" />
              My Loans
            </Link>
            {/* <Link
                  href="/dashboard/buy-airtime"
                  className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary", {"bg-muted text-primary": pathname === "/dashboard/buy-airtime"})}
                >
                  <LineChart className="h-4 w-4" />
                  Buy airtime &amp; data
                </Link> */}
            {/* {loading ? <Skeleton/> : <>
                {user?.package !== "NONE" && <Link
            href={`/dashboard/network/${user?.id}`}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary", {"bg-muted text-primary": pathname === "/dashboard/network"})}
          >
            <Users className="h-4 w-4" />
            My team
          </Link>}
          </>} */}
            <Link
              href={`/dashboard/transactions`}
              className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary", { "bg-muted text-primary": pathname === "/dashboard/transactions" })}
            >
              <Forward className="h-4 w-4" />
              Transaction
            </Link>
            <Link
              href={`/dashboard/myaccount`}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                { "bg-muted text-primary": pathname === "/dashboard/myaccount" }
              )}
            >
              <Forward className="h-4 w-4" />
              My Account
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
      {/* <div className="w-full flex-1">
            <form>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
                />
              </div>
            </form>
          </div> */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="rounded-full">
            <CircleUser className="h-5 w-5" />
            <span className="sr-only">Toggle user menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/myaccount">Settings</Link>
          </DropdownMenuItem>
          {/* <DropdownMenuItem>Support</DropdownMenuItem> */}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <span
              onClick={async () => {
                await logout();
              }}
            >
              Logout
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ModeToggle />
    </header>
  );
}
