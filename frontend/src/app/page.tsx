"use client";
import Features from "@/components/common/features";
import PublicFooter from "@/components/common/public-footer";
import PublicHeader from "@/components/common/public-header";
import Partners from "@/components/common/partners";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import image from "@/assets/images/image.png";
import { Zap, Battery, Shield, Users, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <>
      <PublicHeader />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-emerald-50 to-blue-100 dark:from-blue-950 dark:via-emerald-900/20 dark:to-blue-900 py-12 sm:py-16 md:py-20 lg:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="space-y-6 lg:space-y-8"
            >
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold">
                <span className="block text-gray-900 dark:text-gray-100">Empower</span>
                <span className="block bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600 bg-clip-text text-transparent">
                  Energy Sharing
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-lg leading-relaxed">
                Seamlessly transfer renewable energy across local grids.
                Join our sustainable, secure, and community-driven platform.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/auth/register">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="group relative overflow-hidden px-8 py-4 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white rounded-xl font-semibold text-base transition-all shadow-lg shadow-blue-500/20"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Get Started
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.button>
                </Link>
                <Link href="#features">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-xl font-semibold text-base transition-all"
                  >
                    Learn More
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative h-64 sm:h-80 md:h-96 lg:h-[28rem]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-emerald-500/10 rounded-3xl blur-xl" />
              <Image
                src={image}
                alt="Community energy grid sharing"
                fill
                className="object-cover rounded-2xl shadow-2xl"
                priority
              />
            </motion.div>
          </div>
        </div>
      </section>

      <Features />
      

      <PublicFooter />
    </>
  );
}