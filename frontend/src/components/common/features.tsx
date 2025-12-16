import { motion } from "framer-motion";
import {
  CheckCircleIcon,
  BoltIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

export default function Features() {
  const features = [
    {
      icon: CheckCircleIcon,
      title: "Secure Energy Sharing",
      desc: "Blockchain-secured transactions ensure tamper-proof energy transfers between neighbors and communities, with zero risk of fraud or disputes.",
    },
    {
      icon: BoltIcon,
      title: "Another one",
      desc: "the description comes along.",
    },
    {
      icon: ChartBarIcon,
      title: "another one",
      desc: "its description.",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="relative py-20 md:py-28 bg-gradient-to-bl from-white/50 to-emerald-50/50 dark:from-gray-900/50 dark:to-teal-900/50"
    >
      <div className="container mx-auto px-4 md:px-8 max-w-7xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Why Choose EnergyShare?
          </h3>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Join a network that's revolutionizing energy distribution—simple,
            green, and rewarding for everyone involved.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.2 }}
              viewport={{ once: true }}
              className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border border-white/20 dark:border-gray-700/50 hover:border-emerald-300/50"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <item.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                    {item.title}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      {/* Glowing overlay for energy theme */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.1)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.1)_0%,transparent_70%)]"></div>
    </motion.section>
  );
}
