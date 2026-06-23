import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { connectAdminSocket, getAdminSocket } from "../lib/socket";
import { api, formatUGX } from "../lib/api";
import UssdSimulator from "../components/UssdSimulator";

interface Stats {
  totalUsers: number;
  activeLoans: number;
  tokensToday: number;
  revenueToday: number;
}

function StatCard({ label, value, icon, color, style }: {
  label: string; value: string; icon: string; color: string; style?: CSSProperties;
}) {
  return (
    <div className={`${color} rounded-xl p-5`} style={style}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [health, setHealth]           = useState<any>(null);
  const [stats, setStats]             = useState<Stats>({ totalUsers: 0, activeLoans: 0, tokensToday: 0, revenueToday: 0 });
  const [chartData, setChartData]     = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [connected, setConnected]     = useState(false);
  const [ussdOpen, setUssdOpen]       = useState(false);
  const [ussdPhone, setUssdPhone]     = useState("+256764123306");
  const feedRef = useRef<any[]>([]);

  useEffect(() => {
    // Health : no auth needed
    fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => null);

    // Stats : uses api helper so expired token redirects to login
    api.get("/admin/stats")
      .then(({ data: d }) => {
        setStats({
          totalUsers:   d.total_users   ?? 0,
          activeLoans:  d.active_loans  ?? 0,
          tokensToday:  d.tokens_today  ?? 0,
          revenueToday: d.revenue_today ?? 0,
        });
      })
      .catch(() => null);

    // Weekly chart : real data
    api.get("/admin/reports/weekly")
      .then(({ data: w }) => {
        setChartData(
          (w.transactions ?? []).map((r: any) => ({
            day:       r.day?.slice(5),   // "2026-05-14" → "05-14"
            topups:    r.topups,
            purchases: r.purchases,
          }))
        );
      })
      .catch(() => null);

    // Socket
    const socket = connectAdminSocket();
    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("admin:transaction", (txn: any) => {
      if (txn.type === "CREDIT") {
        setStats(s => ({ ...s, activeLoans: s.activeLoans + 1, revenueToday: s.revenueToday + Math.round(txn.amount_ugx * 0.1) }));
      }
      if (txn.type === "PURCHASE") {
        setStats(s => ({ ...s, tokensToday: s.tokensToday + 1 }));
      }
      if (txn.type === "REPAYMENT_DIRECT" || txn.type === "REPAYMENT_AUTO") {
        setStats(s => ({ ...s, activeLoans: Math.max(0, s.activeLoans - 1) }));
      }

      const entry = { ...txn, receivedAt: Date.now() };
      feedRef.current = [entry, ...feedRef.current].slice(0, 20);
      setActivityFeed([...feedRef.current]);
    });

    return () => {
      getAdminSocket().off("admin:transaction");
      getAdminSocket().off("connect");
      getAdminSocket().off("disconnect");
    };
  }, []);

  const TYPE_COLORS: Record<string, string> = {
    TOP_UP:           "text-green-700 bg-green-50",
    PURCHASE:         "text-blue-700 bg-blue-50",
    CREDIT:           "text-amber-700 bg-amber-50",
    REPAYMENT_AUTO:   "text-purple-700 bg-purple-50",
    REPAYMENT_DIRECT: "text-purple-700 bg-purple-50",
    SHARE:            "text-teal-700 bg-teal-50",
    PENALTY:          "text-red-700 bg-red-50",
    REFUND:           "text-gray-700 bg-gray-50",
  };

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            {new Date().toLocaleDateString("en-UG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="toolbar shrink-0">
          <button
            onClick={() => setUssdOpen(true)}
            className="flex items-center gap-2 text-sm font-semibold px-3 sm:px-4 py-2 rounded-xl text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #1A7BD4, #0D2657)" }}
          >
            <span>📱</span>
            <span className="sm:hidden">USSD</span>
            <span className="hidden sm:inline">USSD Simulator</span>
          </button>
          <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${
          connected ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"
        }`}>
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          {connected ? "Live" : "Connecting..."}
        </div>
        </div>
      </div>

      <UssdSimulator
        open={ussdOpen}
        onClose={() => setUssdOpen(false)}
        phoneNumber={ussdPhone}
        editablePhone
        onPhoneChange={setUssdPhone}
      />

      {/* System health banner */}
      {health && (
        <div className={`rounded-xl px-4 sm:px-5 py-3 text-xs sm:text-sm font-medium flex flex-wrap items-center gap-x-2 gap-y-1 ${
          health.status === "ok"
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          <span>{health.status === "ok" ? "✅" : "⚠️"}</span>
          System: {health.status.toUpperCase()} · DB: {health.db} · Redis: {health.redis} · STS: {health.sts_engine}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users"   value={stats.totalUsers.toLocaleString()}  icon="👥" color="bg-gpawa-navy text-white" />
        <StatCard label="Active Loans"  value={stats.activeLoans.toLocaleString()} icon="🏦" color="bg-gpawa-amber text-white" />
        <StatCard label="Tokens Today"  value={stats.tokensToday.toLocaleString()} icon="🎟️" color="bg-gpawa-blue text-white" />
        <StatCard
          label="Fees Today"
          value={formatUGX(stats.revenueToday)}
          icon="💰"
          color="text-white"
          style={{ background: "linear-gradient(135deg, #16A34A 0%, #15803D 100%)" }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly chart : real data */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-700 mb-1">Weekly Transaction Volume (UGX)</h2>
          <p className="text-xs text-gray-400 mb-4">Top-ups vs electricity purchases, last 7 days</p>
          {chartData.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
              <span className="text-3xl">📊</span>
              No transaction data in the last 7 days yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={2}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `UGX ${v.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="topups"    name="Top-ups"   fill="#1A7BD4" radius={[3, 3, 0, 0]} />
                <Bar dataKey="purchases" name="Purchases" fill="#17C5EC" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Live activity feed */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-700">Live Activity</h2>
            <span className="text-xs text-gray-400">{activityFeed.length} events</span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto max-h-64">
            {activityFeed.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <div className="text-3xl mb-2">📡</div>
                Waiting for transactions...
              </div>
            ) : (
              activityFeed.map((e, i) => (
                <div key={`${e.id}-${i}`} className="flex items-center gap-2 text-xs border-b border-gray-50 pb-2">
                  <span className={`px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[e.type] ?? "bg-gray-100 text-gray-600"}`}>
                    {e.type?.replace(/_/g, " ")}
                  </span>
                  <span className="text-gray-700 font-medium">UGX {e.amount_ugx?.toLocaleString()}</span>
                  <span className="text-gray-400 ml-auto">{new Date(e.timestamp ?? e.receivedAt).toLocaleTimeString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
