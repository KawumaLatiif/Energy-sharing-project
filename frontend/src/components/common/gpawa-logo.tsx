"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LOGO_MARK_SRC = "/gpawa-logo-mark.png";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function GpawaLogoMark({ size = 36, className }: LogoMarkProps) {
  return (
    <Image
      src={LOGO_MARK_SRC}
      alt="gPawa"
      width={size}
      height={size}
      priority
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
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
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
    xl: "text-xl",
  }[textSize];

  const inner = (
    <span className={cn("flex items-center gap-2.5", className)}>
      <GpawaLogoMark size={logoSize} />
      {showText && (
        <span className={cn("font-bold tracking-tight", textClass)}>
          <span className="text-blue-600 dark:text-blue-400">g</span>
          <span className="text-gray-900 dark:text-white">Pawa</span>
        </span>
      )}
    </span>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}
