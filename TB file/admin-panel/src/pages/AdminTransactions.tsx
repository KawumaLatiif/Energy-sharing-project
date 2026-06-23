import { useState, useEffect } from "react";
import { connectAdminSocket, getAdminSocket } from "../lib/socket";

const TYPE_COLORS: Record<string, string> = {
  TOP_UP:            "bg-green-100 text-green-700",
  PURCHASE:          "bg-blue-100 text-blue-700",
  CREDIT:            "bg-amber-100 text-amber-700",
  REPAYMENT_AUTO:    "bg-purple-100 text-purple-700",
  REPAYMENT_DIRECT:  "bg-purple-100 text-purple-700",
  PENALTY:           "bg-red-100 text-red-700",
  REFUND:            "bg-gray-100 text-gray-700",
  SHARE:             "bg-teal-100 text-teal-700",
};

const TYPE_ICONS: Record<string, string> = {
  TOP_UP:            "💳",
  PURCHASE:          "⚡",
  CREDIT:            "🏦",
  REPAYMENT_AUTO:    "🔄",
  REPAYMENT_DIRECT:  "✅",
  PENALTY:           "⚠️",
  REFUND:            "↩️",
  SHARE:             "📤",
};

const ALL_TYPES = ["TOP_UP", "PURCHASE", "SHARE", "CREDIT", "REPAYMENT_AUTO", "REPAYMENT_DIRECT", "PENALTY", "REFUND"];

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    const socket = connectAdminSocket();

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("admin:transaction", (txn: any) => {
      if (paused) return;
      setTransactions(prev => {
        const updated = [{ ...txn, _new: true }, ...prev].slice(0, 200);
        return updated;
      });
      setNewCount(n => n + 1);
      setTimeout(() => setNewCount(n => Math.max(0, n - 1)), 5000);
    });

    return () => {
      getAdminSocket().off("admin:transaction");
      getAdminSocket().off("connect");
      getAdminSocket().off("disconnect");
    };
  }, [paused]);

  const visible = filter ? transactions.filter(t => t.type === filter) : transactions;

  const totals = transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.type] = (acc[t.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="toolbar">
          <h1 className="page-title">Transactions</h1>
          {newCount > 0 && (
            <span className="bg-gpawa-blue text-white text-xs font-bold px-2 py-0.5 rounded-full animate-bounce">
              +{newCount}
            </span>
          )}
        </div>

        <div className="toolbar">
          <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${
            connected ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"
          }`}>
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
            {connected ? "Live" : "Offline"}
          </div>

          <button
            onClick={() => setPaused(p => !p)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              paused ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {paused ? "⏸ Paused" : "▶ Live"}
          </button>

          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
          >
            <option value="">All types</option>
            {ALL_TYPES.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>

          {transactions.length > 0 && (
            <button
              onClick={() => setTransactions([])}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary chips */}
      {Object.keys(totals).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(totals).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setFilter(f => f === type ? "" : type)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                filter === type
                  ? "bg-gpawa-blue text-white border-gpawa-blue"
                  : `${TYPE_COLORS[type] ?? "bg-gray-100 text-gray-600"} border-transparent`
              }`}
            >
              {TYPE_ICONS[type]} {type.replace(/_/g, " ")} ({count})
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📡</p>
          <p className="font-medium">Waiting for transactions</p>
          <p className="text-sm mt-1">New transactions will appear here in real time via Socket.IO</p>
          {paused && (
            <p className="text-xs mt-3 text-amber-600 font-medium">
              Stream is paused. Click Live to resume.
            </p>
          )}
        </div>
      ) : (
        <div className="table-card">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Channel</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">User ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((t, i) => (
                <tr
                  key={`${t.id}-${i}`}
                  className={`hover:bg-gray-50 transition-colors ${t._new ? "bg-blue-50/40" : ""}`}
                >
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[t.type] ?? "bg-gray-100 text-gray-600"}`}>
                      {TYPE_ICONS[t.type]} {t.type?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-gpawa-dark">
                    {t.currency ?? "UGX"} {t.amount_ugx?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{t.channel}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400 hidden lg:table-cell truncate max-w-[120px]">
                    {t.user_id?.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(t.timestamp ?? t.receivedAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
            Showing {visible.length} of {transactions.length} total · Last 200 events retained
          </div>
        </div>
      )}
    </div>
  );
}
