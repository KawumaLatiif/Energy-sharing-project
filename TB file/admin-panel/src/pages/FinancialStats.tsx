import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { api, formatUGX } from "../lib/api";

type Period = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: "daily",     label: "Daily (30 days)" },
  { key: "weekly",    label: "Weekly (12 weeks)" },
  { key: "monthly",   label: "Monthly (24 months)" },
  { key: "quarterly", label: "Quarterly" },
  { key: "yearly",    label: "Yearly" },
];

export default function FinancialStats() {
  const [period, setPeriod]   = useState<Period>("monthly");
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/financial-stats?period=${period}`)
      .then(({ data: d }) => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [period]);

  const summary = data?.summary;
  const periods = data?.periods ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-title">Financial Statistics</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Profit from loan fees and late penalties over time
        </p>
      </div>

      {/* All-time summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Profit (All Time)"
            value={formatUGX(summary.total_profit)}
            sub="fees + penalties"
            bg="linear-gradient(135deg,#16A34A 0%,#15803D 100%)"
            icon="💰"
            large
          />
          <SummaryCard
            label="Fees Collected"
            value={formatUGX(summary.fees_collected)}
            sub="from repaid loans"
            bg="linear-gradient(135deg,#0D2657 0%,#1A7BD4 100%)"
            icon="✅"
          />
          <SummaryCard
            label="Fees Pending"
            value={formatUGX(summary.fees_pending)}
            sub="from active loans"
            bg="linear-gradient(135deg,#D97706 0%,#F59E0B 100%)"
            icon="⏳"
          />
          <SummaryCard
            label="Penalties Collected"
            value={formatUGX(summary.total_penalties)}
            sub="late repayment charges"
            bg="linear-gradient(135deg,#DC2626 0%,#EF4444 100%)"
            icon="⚠️"
          />
          <SummaryCard
            label="Total Loans Issued"
            value={summary.total_loans_issued.toLocaleString()}
            sub="all time"
            bg="#374151"
            icon="🏦"
          />
          <SummaryCard
            label="Avg Profit per Loan"
            value={formatUGX(summary.avg_profit_per_loan)}
            sub="fee + penalty average"
            bg="#4B5563"
            icon="📊"
          />
          <SummaryCard
            label="Total Fees Earned"
            value={formatUGX(summary.total_fees_earned)}
            sub="10% on every loan"
            bg="#1E3A5F"
            icon="🎯"
          />
          <div className="rounded-xl p-5 bg-blue-50 border border-blue-200 text-blue-900 flex flex-col justify-center">
            <p className="text-xs font-semibold text-blue-700 mb-1">How profit works</p>
            <p className="text-[11px] leading-relaxed text-blue-800">
              gPawa earns <strong>10% fee</strong> on every loan. Late repayments add a
              <strong> 5% weekly penalty</strong>. Fees are earned at loan creation;
              collected when repaid.
            </p>
          </div>
        </div>
      )}

      {/* Period selector */}
      <div className="flex flex-wrap gap-2">
        {PERIOD_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setPeriod(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              period === t.key
                ? "bg-gpawa-navy text-white border-gpawa-navy"
                : "bg-white text-gray-600 border-gray-200 hover:border-gpawa-blue hover:text-gpawa-blue"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : periods.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">No financial data for this period yet.</p>
          <p className="text-sm mt-1">Data will appear here once loans are issued.</p>
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Profit per period (stacked bars) */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-700 mb-1">Profit per Period</h2>
              <p className="text-xs text-gray-400 mb-4">Loan fees and penalties stacked</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={periods} barGap={2}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, name: string) => [`UGX ${v.toLocaleString()}`, name]} />
                  <Legend />
                  <Bar dataKey="fees_earned" name="Loan Fees"  fill="#16A34A" stackId="a" radius={[0,0,0,0]} />
                  <Bar dataKey="penalties"   name="Penalties"  fill="#EF4444" stackId="a" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cumulative profit line */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-700 mb-1">Cumulative Profit Over Time</h2>
              <p className="text-xs text-gray-400 mb-4">Running total of all profit earned</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={periods}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`UGX ${v.toLocaleString()}`, "Cumulative Profit"]} />
                  <Line
                    type="monotone"
                    dataKey="cumulative_profit"
                    name="Cumulative Profit"
                    stroke="#16A34A"
                    strokeWidth={2.5}
                    dot={{ fill: "#16A34A", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Loans issued per period */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-700 mb-1">Loans Issued per Period</h2>
              <p className="text-xs text-gray-400 mb-4">Number of credit loans approved</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={periods}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={d => `Period: ${d}`} />
                  <Bar dataKey="loans_issued" name="Loans Issued" fill="#0D2657" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Principal issued per period */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-700 mb-1">Principal Issued per Period</h2>
              <p className="text-xs text-gray-400 mb-4">Total credit lent out (you expect this back)</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={periods}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `UGX ${v.toLocaleString()}`} />
                  <Bar dataKey="principal_issued" name="Principal Issued" fill="#1A7BD4" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>

          {/* Detail table */}
          <div className="table-card">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Period Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-3">Period</th>
                    <th className="text-right px-5 py-3">Loans</th>
                    <th className="text-right px-5 py-3">Principal Issued</th>
                    <th className="text-right px-5 py-3">Fees Earned</th>
                    <th className="text-right px-5 py-3">Penalties</th>
                    <th className="text-right px-5 py-3 text-green-700">Profit</th>
                    <th className="text-right px-5 py-3 text-green-700">Running Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...periods].reverse().map((r: any) => (
                    <tr key={r.period_key} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-800">{r.label}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{r.loans_issued}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{formatUGX(r.principal_issued)}</td>
                      <td className="px-5 py-3 text-right text-green-700 font-medium">{formatUGX(r.fees_earned)}</td>
                      <td className="px-5 py-3 text-right text-red-600">{r.penalties > 0 ? formatUGX(r.penalties) : "-"}</td>
                      <td className="px-5 py-3 text-right font-bold text-green-700">{formatUGX(r.profit)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gpawa-navy">{formatUGX(r.cumulative_profit)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="px-5 py-3 font-bold text-gray-800">Total</td>
                    <td className="px-5 py-3 text-right font-bold">{summary?.total_loans_issued ?? 0}</td>
                    <td className="px-5 py-3 text-right font-bold text-gray-700">
                      {formatUGX(periods.reduce((a: number, r: any) => a + r.principal_issued, 0))}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-green-700">
                      {formatUGX(periods.reduce((a: number, r: any) => a + r.fees_earned, 0))}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">
                      {formatUGX(periods.reduce((a: number, r: any) => a + r.penalties, 0))}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-green-700">
                      {formatUGX(periods.reduce((a: number, r: any) => a + r.profit, 0))}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-gpawa-navy">
                      {periods.length > 0 ? formatUGX(periods[periods.length - 1].cumulative_profit) : "-"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, bg, icon, large }: {
  label: string; value: string; sub: string; bg: string; icon: string; large?: boolean;
}) {
  return (
    <div className="rounded-xl p-5 text-white" style={{ background: bg }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium opacity-75">{label}</p>
          <p className={`font-bold mt-1 leading-tight ${large ? "text-2xl" : "text-xl"}`}>{value}</p>
          <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}
