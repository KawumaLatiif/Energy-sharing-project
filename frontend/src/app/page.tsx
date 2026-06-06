"use client";
import Features from "@/components/common/features";
import PublicFooter from "@/components/common/public-footer";
import PublicHeader from "@/components/common/public-header";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import image from "@/assets/images/image.png";
import { Zap, Users, Shield, ArrowRight } from "lucide-react";

const stats = [
  { value: "2,400+", label: "Active Users" },
  { value: "98.7%", label: "Uptime" },
  { value: "UGX 0", label: "Hidden Fees" },
];

export default function Home() {
  return (
    <>
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 py-16 sm:py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl" />
          <div className="absolute top-1/2 right-0 h-80 w-80 rounded-full bg-emerald-500/12 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Text */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="space-y-7"
            >
              <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 rounded-full px-4 py-1.5">
                <Zap className="h-3 w-3" />
                Community Energy Platform
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
                <span className="text-gray-900 dark:text-white">Share energy,</span>
                <br />
                <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-500 bg-clip-text text-transparent">
                  build community.
                </span>
              </h1>

              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-lg leading-relaxed">
                gPawa lets households and institutions buy, share, and finance
                electricity credits directly — no middleman, no delays.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link href="/auth/register">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-500/20"
                  >
                    Get started free <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </Link>
                <Link href="#features">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-7 py-3.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl font-semibold text-sm transition-all"
                  >
                    How it works
                  </motion.button>
                </Link>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-6 pt-2">
                {stats.map(({ value, label }) => (
                  <div key={label}>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="relative h-64 sm:h-80 md:h-96 lg:h-[30rem]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-emerald-500/10 rounded-3xl blur-2xl" />
              <Image
                src={image}
                alt="gPawa energy sharing platform"
                fill
                className="object-cover rounded-3xl shadow-2xl ring-1 ring-gray-200/60 dark:ring-slate-800/70"
                priority
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-y border-gray-100 dark:border-slate-800/60 bg-white dark:bg-slate-900/40 py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500 dark:text-gray-400">
          {[
            { icon: Shield, text: "Bank-grade security" },
            { icon: Zap,    text: "Real-time token delivery" },
            { icon: Users,  text: "Community-governed" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{text}</span>
            </div>
          ))}
        </div>
      </section>

      <Features />

      <PublicFooter />
    </>
  );
}
