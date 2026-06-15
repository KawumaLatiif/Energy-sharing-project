import { motion } from "framer-motion";
import { Zap, Shield, BarChart3, Share2 } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Secure Energy Sharing",
    desc: "Every transaction is cryptographically verified and audit-logged. Share kWh between meters with email-verified two-step confirmation.",
    accent: "from-blue-500 to-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    icon: Zap,
    title: "Instant STS Token Delivery",
    desc: "Purchase prepaid tokens via MTN Mobile Money in seconds. Tokens conform to IEC 62055-41 and work on any compatible UEDCL meter.",
    accent: "from-cyan-500 to-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
  },
  {
    icon: Share2,
    title: "Peer-to-Peer Unit Transfer",
    desc: "Send electricity units directly from your meter to a neighbour's. STS meters receive a keypad token; AMI meters get an automatic balance update.",
    accent: "from-violet-500 to-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/30",
  },
  {
    icon: BarChart3,
    title: "Compliant Micro-Finance",
    desc: "gPawa's credit engine offers instant micro-loans capped at Uganda's statutory 2.8%/month — no paperwork, no branch visit.",
    accent: "from-emerald-500 to-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
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
      className="relative py-20 md:py-28 bg-gray-50 dark:bg-slate-900"
    >
      <div className="container mx-auto px-4 md:px-8 max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-blue-600 dark:text-blue-400 mb-3">
            Why gPawa
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Built for communities that{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              share power
            </span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            From Soroti to every campus grid — gPawa makes peer-to-peer electricity
            sharing simple, transparent, and fair.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.12 }}
              viewport={{ once: true }}
              className="group bg-white dark:bg-slate-800/60 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all border border-gray-100 dark:border-slate-700/60 hover:border-blue-200 dark:hover:border-blue-800/60"
            >
              <div className={`w-11 h-11 bg-gradient-to-br ${item.accent} rounded-xl flex items-center justify-center text-white shadow-md mb-5 group-hover:scale-105 transition-transform`}>
                <item.icon className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                {item.title}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
