import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { api, formatUGX, downloadCsv } from "../lib/api";

export default function Reports() {
  const [stats, setStats]   = useState<any>(null);
  const [weekly, setWeekly] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exportType, setExportType] = useState("weekly");
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, w] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/reports/weekly"),
      ]);
      setStats(s.data);
      setWeekly(w.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function exportCsv() {
    setExporting(true);
    try {
      const names: Record<string, string> = {
        weekly: "gpawa_weekly_report.csv",
        transactions: "gpawa_transactions.csv",
        loans: "gpawa_loans.csv",
      };
      await downloadCsv(`/admin/reports/export?report=${exportType}`, names[exportType]);
    } catch { /* ignore */ } finally { setExporting(false); }
  }

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <div className="toolbar">
          <select
            value={exportType}
            onChange={e => setExportType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="weekly">Weekly summary</option>
            <option value="transactions">All transactions</option>
            <option value="loans">All loans</option>
          </select>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="text-sm px-4 py-1.5 rounded-lg bg-gpawa-navy text-white hover:bg-gpawa-blue disabled:opacity-60"
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <button onClick={load} className="text-sm text-gpawa-blue hover:underline">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading reports...</div>
      ) : (
        <>
          {/* ── Profit Summary ── */}
          {stats && (
            <section>
              <h2 className="text-base font-semibold text-gray-700 mb-3">Profit Summary</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Fees Earned"
                  value={formatUGX(stats.fees_total)}
                  sub="all loan fees issued"
                  icon="💰"
                  bg="linear-gradient(135deg,#16A34A 0%,#15803D 100%)"
                />
                <StatCard
                  label="Fees Collected"
                  value={formatUGX(stats.fees_collected)}
                  sub="from fully repaid loans"
                  icon="✅"
                  bg="linear-gradient(135deg,#0D2657 0%,#1A7BD4 100%)"
                />
                <StatCard
                  label="Outstanding Loans"
                  value={formatUGX(stats.outstanding_ugx)}
                  sub="active + overdue balance"
                  icon="⏳"
                  bg="linear-gradient(135deg,#D97706 0%,#F59E0B 100%)"
                />
                <StatCard
                  label="Penalties Collected"
                  value={formatUGX(stats.penalties_ugx)}
                  sub="late repayment charges"
                  icon="⚠️"
                  bg="linear-gradient(135deg,#DC2626 0%,#EF4444 100%)"
                />
              </div>

              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
                <strong>How profit is calculated:</strong> gPawa earns a <strong>10% fee</strong> on every credit loan issued.
                Example: a UGX 10,000 loan generates UGX 1,000 in fees.
                Fees are earned at the time the loan is issued and collected when the user repays.
                Late repayments incur an additional 5% penalty per week.
              </div>
            </section>
          )}

          {/* ── Today's numbers ── */}
          {stats && (
            <section>
              <h2 className="text-base font-semibold text-gray-700 mb-3">Today</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Users"   value={stats.total_users?.toLocaleString()}  sub="registered accounts"     icon="👥" bg="#0D2657" />
                <StatCard label="Active Loans"  value={stats.active_loans?.toLocaleString()} sub="outstanding right now"    icon="🏦" bg="#D97706" />
                <StatCard label="Tokens Today"  value={stats.tokens_today?.toLocaleString()} sub="electricity tokens sold"  icon="🎟️" bg="#1A7BD4" />
                <StatCard label="Fees Today"    value={formatUGX(stats.revenue_today)}       sub="loan fees issued today"   icon="📈" bg="#16A34A" />
              </div>
            </section>
          )}

          {/* ── Weekly charts ── */}
          {weekly && (
            <section className="space-y-6">
              <h2 className="text-base font-semibold text-gray-700">Last 7 Days</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Loan fees per day */}
                <ChartCard title="Loan Fees Earned per Day (UGX)" empty={weekly.fees?.length === 0}>
                  <BarChart data={weekly.fees ?? []}>
                    <XAxis dataKey="day" tickFormatter={d => d.slice(5)} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number, name: string) => [`UGX ${v.toLocaleString()}`, name]}
                      labelFormatter={d => `Date: ${d}`}
                    />
                    <Legend />
                    <Bar dataKey="fees_earned"      name="Fees Earned"      fill="#16A34A" radius={[3,3,0,0]} />
                    <Bar dataKey="principal_issued" name="Principal Issued"  fill="#86EFAC" radius={[3,3,0,0]} />
                  </BarChart>
                </ChartCard>

                {/* Loans issued per day (count) */}
                <ChartCard title="Loans Issued per Day" empty={weekly.fees?.length === 0}>
                  <BarChart data={weekly.fees ?? []}>
                    <XAxis dataKey="day" tickFormatter={d => d.slice(5)} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={d => `Date: ${d}`} />
                    <Bar dataKey="loans_issued" name="Loans Issued" fill="#0D2657" radius={[3,3,0,0]} />
                  </BarChart>
                </ChartCard>

                {/* Top-ups vs Purchases */}
                <ChartCard title="Transaction Volume: Top-ups vs Purchases (UGX)" empty={weekly.transactions?.length === 0}>
                  <BarChart data={weekly.transactions ?? []} barGap={2}>
                    <XAxis dataKey="day" tickFormatter={d => d.slice(5)} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `UGX ${v.toLocaleString()}`} labelFormatter={d => `Date: ${d}`} />
                    <Legend />
                    <Bar dataKey="topups"    name="Top-ups"   fill="#1A7BD4" radius={[3,3,0,0]} />
                    <Bar dataKey="purchases" name="Purchases" fill="#17C5EC" radius={[3,3,0,0]} />
                  </BarChart>
                </ChartCard>

                {/* Tokens sold per day */}
                <ChartCard title="Tokens Sold per Day" empty={weekly.transactions?.length === 0}>
                  <BarChart data={weekly.transactions ?? []}>
                    <XAxis dataKey="day" tickFormatter={d => d.slice(5)} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={d => `Date: ${d}`} />
                    <Bar dataKey="tokens_sold" name="Tokens Sold" fill="#071A3E" radius={[3,3,0,0]} />
                  </BarChart>
                </ChartCard>

                {/* New registrations */}
                <ChartCard title="New User Registrations (7 days)" empty={weekly.registrations?.length === 0}>
                  <LineChart data={weekly.registrations ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tickFormatter={d => d.slice(5)} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={d => `Date: ${d}`} />
                    <Line type="monotone" dataKey="registrations" name="New Users" stroke="#0D2657" strokeWidth={2} dot={{ fill: "#0D2657", r: 4 }} />
                  </LineChart>
                </ChartCard>

              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon, bg }: {
  label: string; value: string; sub: string; icon: string; bg: string;
}) {
  return (
    <div className="rounded-xl p-5 text-white" style={{ background: bg }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium opacity-80">{label}</p>
          <p className="text-xl font-bold mt-1 leading-tight">{value}</p>
          <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

function ChartCard({ title, empty, children }: {
  title: string; empty: boolean; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-700 mb-4 text-sm">{title}</h3>
      {empty ? (
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data for last 7 days</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          {children as any}
        </ResponsiveContainer>
      )}
    </div>
  );
}
