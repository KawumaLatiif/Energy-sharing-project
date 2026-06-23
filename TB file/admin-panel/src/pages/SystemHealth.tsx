import { useState, useEffect } from "react";

export default function SystemHealth() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: "error", db: "unreachable", redis: "unreachable", sts_engine: "unknown" }))
      .finally(() => setLoading(false));
  }, []);

  function statusBadge(val: string) {
    return (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
        val === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}>
        {val}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System Health</h1>
      {loading ? (
        <div className="text-gray-400">Checking...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {[
            ["Overall Status", health?.status],
            ["PostgreSQL", health?.db],
            ["Redis", health?.redis],
            ["STS Engine", health?.sts_engine],
            ["API Version", health?.version],
          ].map(([label, val]) => (
            <div key={label} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm text-gray-700 font-medium">{label}</span>
              {statusBadge(String(val ?? "unknown"))}
            </div>
          ))}
          <button
            onClick={() => { setLoading(true); fetch("/api/health").then(r => r.json()).then(setHealth).finally(() => setLoading(false)); }}
            className="text-sm text-gpawa-blue hover:underline"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
