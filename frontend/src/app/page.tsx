"use client";
import Features from "@/components/common/features";
import PublicFooter from "@/components/common/public-footer";
import PublicHeader from "@/components/common/public-header";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Zap, Users, Shield, ArrowRight, Smartphone,
  TrendingUp, CheckCircle2,
} from "lucide-react";

const stats = [
  { value: "100%",   label: "Transparent" },
  { value: "0 UGX",  label: "Hidden Fees"  },
  { value: "2.8%",   label: "Max Interest / Month" },
];

const steps = [
  {
    step: "01",
    title: "Register & link your meter",
    desc: "Create an account and link your UEDCL prepaid meter number. Takes under two minutes.",
    icon: Smartphone,
  },
  {
    step: "02",
    title: "Buy or receive energy credits",
    desc: "Top up via MTN Mobile Money. Credits land on your meter as an STS token or direct balance.",
    icon: Zap,
  },
  {
    step: "03",
    title: "Share with neighbours",
    desc: "Send kWh directly to any meter on the platform. Peer-to-peer, instant, verified by email.",
    icon: Users,
  },
  {
    step: "04",
    title: "Access micro-finance",
    desc: "Need a top-up now? borrow against your energy history at Uganda's statutory 2.8%/month cap.",
    icon: TrendingUp,
  },
];

const pillars = [
  "No hidden service fees",
  "MTN Mobile Money payments",
  "ERA-compliant block tariffs",
  "Peer-to-peer unit sharing",
  "Statutory lending caps enforced",
  "STS & AMI meter support",
];

export default function Home() {
  return (
    <>
      <PublicHeader />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0A1628] min-h-[92vh] flex items-center">
        {/* Background glow blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[100px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan-400/15 blur-[80px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center w-full">
          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.75, ease: "easeOut" }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-cyan-400 bg-cyan-400/10 border border-cyan-400/25 rounded-full px-4 py-1.5">
              <Zap className="h-3 w-3" />
              Community Energy Platform · Uganda
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-white">
              Share energy,
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-blue-500 bg-clip-text text-transparent">
                build community.
              </span>
            </h1>

            <p className="text-lg text-slate-300 max-w-lg leading-relaxed">
              gPawa lets households and institutions buy, share, and
              finance electricity credits directly — no middleman, no
              branch visit, no delays.
            </p>

            {/* Pills */}
            <div className="flex flex-wrap gap-2">
              {pillars.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200 bg-white/8 border border-white/12 rounded-full px-3 py-1"
                >
                  <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                  {p}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/auth/register">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-semibold text-sm shadow-xl shadow-blue-700/30 transition-all"
                >
                  Get started free <ArrowRight className="h-4 w-4" />
                </motion.button>
              </Link>
              <Link href="#how-it-works">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-7 py-3.5 border border-white/20 text-white hover:bg-white/8 rounded-xl font-semibold text-sm transition-all"
                >
                  How it works
                </motion.button>
              </Link>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-8 pt-2 border-t border-white/10">
              {stats.map(({ value, label }) => (
                <div key={label}>
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — hero image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative flex items-center justify-center"
          >
            {/* Glow ring behind image */}
            <div className="absolute inset-8 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="relative w-full max-w-lg mx-auto">
              <Image
                src="/hero-network.png"
                alt="gPawa energy sharing network — peer-to-peer solar community"
                width={600}
                height={600}
                className="w-full h-auto object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── TRUST BAR ──────────────────────────────────────────────── */}
      <section className="border-y border-gray-100 dark:border-slate-800/60 bg-white dark:bg-slate-900/40 py-6">
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500 dark:text-gray-400">
          {[
            { icon: Shield,      text: "Bank-grade security" },
            { icon: Zap,         text: "Real-time token delivery" },
            { icon: Users,       text: "Community-governed" },
            { icon: CheckCircle2, text: "ERA-compliant tariffs" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 md:py-28 bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-blue-600 dark:text-blue-400 mb-3">
              Simple process
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Up and running in{" "}
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                four steps
              </span>
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ step, title, desc, icon: Icon }, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="relative bg-gray-50 dark:bg-slate-900/80 rounded-2xl p-6 border border-gray-100 dark:border-slate-800/60 hover:border-blue-200 dark:hover:border-blue-900/60 transition-colors group"
              >
                <div className="text-4xl font-black text-blue-100 dark:text-blue-900/60 mb-4 select-none">
                  {step}
                </div>
                <div className="w-10 h-10 gpawa-gradient rounded-xl flex items-center justify-center mb-4 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">
                  {title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────── */}
      <Features />

      {/* ── BOTTOM CTA ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0A1628] py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-blue-600/25 blur-3xl" />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready to power your community?
          </h2>
          <p className="text-slate-300 text-lg">
            Join gPawa today — it&apos;s free to register and takes less than 2 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/register">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm shadow-xl shadow-blue-700/30"
              >
                Create free account <ArrowRight className="h-4 w-4" />
              </motion.button>
            </Link>
            <Link href="/auth/login">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="w-full sm:w-auto px-8 py-4 border border-white/20 text-white hover:bg-white/8 rounded-xl font-semibold text-sm transition-all"
              >
                Sign in
              </motion.button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </>
  );
}
