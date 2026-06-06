import { motion } from "framer-motion";
import { Zap, Shield, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Secure Energy Sharing",
    desc: "Every transaction is cryptographically signed and audit-logged. Transfer energy credits between meters with zero risk of fraud or double-spend.",
    accent: "from-blue-500 to-blue-600",
  },
  {
    icon: Zap,
    title: "Instant Token Delivery",
    desc: "Purchase or receive STS prepaid tokens in seconds. Our platform communicates directly with meters to confirm delivery in real time.",
    accent: "from-emerald-500 to-emerald-600",
  },
  {
    icon: BarChart3,
    title: "Smart Credit & Loans",
    desc: "gPawa's credit engine analyses your energy usage history to offer fair, instant micro-loans — no paperwork, no branch visit required.",
    accent: "from-violet-500 to-violet-600",
  },
];

export default function Features() {
  return (
    <motion.section
      id="features"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="relative py-20 md:py-28 bg-gradient-to-bl from-white via-slate-50 to-emerald-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/40"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08)_0%,transparent_70%)]" />
      <div className="container mx-auto px-4 md:px-8 max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-blue-600 dark:text-blue-400 mb-3">
            Why gPawa
          </span>
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Built for communities that{" "}
            <span className="bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
              share power
            </span>
          </h3>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            From Soroti to every campus grid — gPawa makes peer-to-peer electricity
            sharing simple, transparent, and fair.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
              viewport={{ once: true }}
              className="group bg-white dark:bg-slate-900/80 rounded-2xl p-7 shadow-sm hover:shadow-lg transition-all border border-gray-100 dark:border-slate-800/60 hover:border-blue-200 dark:hover:border-slate-700"
            >
              <div className={`w-11 h-11 bg-gradient-to-br ${item.accent} rounded-xl flex items-center justify-center text-white shadow-md mb-5 group-hover:scale-105 transition-transform`}>
                <item.icon className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {item.title}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
