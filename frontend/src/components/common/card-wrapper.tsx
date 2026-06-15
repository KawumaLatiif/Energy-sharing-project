"use client";
import Image from "next/image";
import logo from "@/assets/images/logo.jpg";

function GpawaAuthBrand() {
  return (
    <div className="flex flex-col items-center gap-2 mb-6">
      <Image
        src={logo}
        alt="gPawa"
        width={44}
        height={44}
        className="rounded-2xl object-cover shadow-lg shadow-blue-500/25"
      />
      <span className="text-xl font-bold tracking-tight">
        <span className="gpawa-gradient-text">g</span>
        <span className="text-gray-900 dark:text-white">Pawa</span>
      </span>
    </div>
  );
}

const CardWrapper = ({
  title,
  subtitle,
  children,
  variant = "default",
  containerClassName,
  cardClassName,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  variant?: "default" | "auth";
  containerClassName?: string;
  cardClassName?: string;
}) => {
  const containerBase =
    variant === "auth"
      ? "min-h-screen flex items-center justify-center px-4 py-8"
      : "min-h-full flex flex-col justify-center py-10 sm:py-14 sm:px-6 lg:px-8";
  const cardBase =
    variant === "auth"
      ? "bg-white dark:bg-slate-900 py-8 px-6 shadow-xl shadow-slate-900/8 dark:shadow-black/30 rounded-2xl sm:px-10 border border-gray-200/80 dark:border-slate-800/80 max-h-[92vh] overflow-y-auto"
      : "bg-white dark:bg-slate-900 py-8 px-6 shadow-xl shadow-slate-900/8 dark:shadow-black/30 sm:rounded-2xl sm:px-10 border border-gray-200/80 dark:border-slate-800/80";

  return (
    <div className="relative">
      {variant === "auth" && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
          <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>
      )}
      <div className={`${containerBase} ${containerClassName ?? ""}`}>
        <div className="sm:mx-auto sm:w-full sm:max-w-md w-full mt-4">
          <div className={`${cardBase} ${cardClassName ?? ""}`}>
            {variant === "auth" && <GpawaAuthBrand />}
            <h1 className="text-xl font-semibold text-center text-gray-900 dark:text-white mb-1">
              {title}
            </h1>
            {subtitle && (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-5">
                {subtitle}
              </p>
            )}
            <div className={variant === "auth" ? "mt-5" : ""}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardWrapper;
