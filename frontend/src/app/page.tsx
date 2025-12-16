"use client";
import Features from "@/components/common/features";
import PublicFooter from "@/components/common/public-footer";
import PublicHeader from "@/components/common/public-header";
import Partners from "@/components/common/partners";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import image from "@/assets/images/image.png";

export default function Home() {
  return (
    <>
      <PublicHeader />
      {/* RESPONSIVE HERO: Mobile stack, desktop side-by-side with enhanced gradients */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-green-50 to-emerald-50 dark:from-gray-900 via-teal-900 to-gray-800 py-8 sm:py-12 md:py-16 lg:py-20">
        <div className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="space-y-6 order-2 lg:order-1"
            >
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-teal-500 to-green-600 dark:from-blue-400 via-teal-400 to-green-400 text-center lg:text-left leading-tight">
                Empower Energy Sharing
              </h1>
              <p className="text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-lg mx-auto lg:mx-0 text-center lg:text-left leading-relaxed">
                Seamlessly transfer renewable energy across local grids.
                Sustainable, secure, and community-driven.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/auth/register">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white rounded-xl font-semibold text-base transition-all shadow-lg"
                  >
                    Start Sharing
                  </motion.button>
                </Link>
                <Link href="#features">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full sm:w-auto px-8 py-4 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-900/20 rounded-xl font-semibold text-base transition-all"
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
              className="relative h-64 sm:h-80 md:h-96 lg:h-[28rem] order-1 lg:order-2 mx-auto lg:mx-0"
            >
              <Image
                src={image}
                alt="Community energy grid sharing"
                fill
                className="object-cover rounded-2xl shadow-xl"
              />
            </motion.div>
          </div>
        </div>
        {/* Subtle overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-green-500/5 to-transparent"></div>
      </section>

      <Features />

      {/* <Partners /> */}

      <PublicFooter />
    </>
  );
}
