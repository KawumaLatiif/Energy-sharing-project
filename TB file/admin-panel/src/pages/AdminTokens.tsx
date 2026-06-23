import { useState, useEffect } from "react";
import { api, formatUGX } from "../lib/api";
import { connectAdminSocket, getAdminSocket } from "../lib/socket";

const STATUS_COLORS: Record<string, string> = {
  GENERATED: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-cyan-100 text-cyan-700",
  VIEWED:    "bg-purple-100 text-purple-700",
  USED:      "bg-green-100 text-green-700",
};

function fmtToken(code: string) {
  return code?.match(/.{1,4}/g)?.join(" ") ?? code;
}

export default function AdminTokens() {
  const [tokens, setTokens]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    api.get("/admin/tokens?limit=100")
      .then(r => setTokens(r.data))
      .catch(() => null)
      .finally(() => setLoading(false));

    const socket = connectAdminSocket();
    socket.on("admin:transaction", (txn: any) => {
      if (txn.type === "PURCHASE") {
        setTokens(prev => [
          { ...txn, token_code: "-", status: "GENERATED", full_name: txn.user_id?.slice(0,8) },
          ...prev,
        ].slice(0, 200));
      }
    });
    return () => { getAdminSocket().off("admin:transaction"); };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Tokens</h1>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading tokens...</div>
      ) : (
        <div className="table-card">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Token Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Owner</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Meter No.</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tokens.map((t, i) => (
                <>
                  <tr
                    key={`${t.id}-${i}`}
                    onClick={() => setSelected(selected?.id === t.id ? null : t)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${selected?.id === t.id ? "bg-blue-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-bold tracking-widest text-gpawa-dark">
                      {fmtToken(t.token_code)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.full_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{t.phone_number}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 hidden md:table-cell">
                      {t.meter_number}
                    </td>
                    <td className="px-4 py-3 font-bold">{formatUGX(t.amount_ugx)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell whitespace-nowrap">
                      {t.created_at?.slice(0, 16)?.replace("T", " ")}
                    </td>
                  </tr>

                  {selected?.id === t.id && (
                    <tr key={`${t.id}-detail`}>
                      <td colSpan={6} className="px-6 pb-4 bg-blue-50/30">
                        <div className="pt-3 bg-white rounded-lg border border-gray-200 p-4 text-sm max-w-md">
                          <p className="font-semibold text-gpawa-navy mb-3">Token Details</p>
                          <div className="bg-gpawa-dark text-white rounded-xl p-4 text-center mb-3">
                            <p className="text-xs text-gray-400 mb-1">Electricity Token</p>
                            <p className="font-mono text-xl font-bold tracking-widest">{fmtToken(t.token_code)}</p>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            <D label="Owner" val={t.full_name} />
                            <D label="Phone" val={t.phone_number} />
                            <D label="Meter" val={t.meter_number} />
                            <D label="Amount" val={formatUGX(t.amount_ugx)} />
                            <D label="Status" val={t.status} />
                            <D label="Created" val={t.created_at?.slice(0,16)?.replace("T"," ")} />
                            {t.sent_to && <D label="SMS Sent To" val={t.sent_to} />}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {tokens.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🎟️</p>
              <p>No tokens generated yet</p>
            </div>
          )}
          <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
            {tokens.length} tokens shown
          </div>
        </div>
      )}
    </div>
  );
}

function D({ label, val }: { label: string; val: any }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{String(val ?? "-")}</span>
    </div>
  );
}
