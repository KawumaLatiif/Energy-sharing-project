"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function GpawaLogoMark({ size = 36, className }: LogoMarkProps) {
  const iconSize = Math.round(size * 0.46);
  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "gpawa-gradient rounded-xl flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0",
        className
      )}
    >
      {/* Lightning bolt — the gPawa mark */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 14 18"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M9.5 0L1 10h5.5L3 18 14 8H8.5L9.5 0z"
          fill="white"
          fillOpacity="0.95"
        />
      </svg>
    </div>
  );
}

interface LogoProps {
  href?: string;
  textSize?: "sm" | "base" | "lg" | "xl";
  showText?: boolean;
  logoSize?: number;
  className?: string;
}

export function GpawaLogo({
  href = "/",
  textSize = "base",
  showText = true,
  logoSize = 36,
  className,
}: LogoProps) {
  const textClass = {
    sm:   "text-sm",
    base: "text-base",
    lg:   "text-lg",
    xl:   "text-xl",
  }[textSize];

  const inner = (
    <span className={cn("flex items-center gap-2.5 group", className)}>
      <GpawaLogoMark size={logoSize} />
      {showText && (
        <span className={cn("font-bold tracking-tight", textClass)}>
          <span className="gpawa-gradient-text">g</span>
          <span className="text-gray-900 dark:text-white">Pawa</span>
        </span>
      )}
    </span>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}
