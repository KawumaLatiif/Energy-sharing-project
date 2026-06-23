import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { getAdminRole } from "../lib/auth";

const ACTION_COLORS: Record<string, string> = {
  USER_SUSPEND:        "bg-red-100 text-red-700",
  USER_UNSUSPEND:      "bg-green-100 text-green-700",
  VERIFICATION_UPDATE: "bg-blue-100 text-blue-700",
  CREDIT_SCORE_UPDATE: "bg-purple-100 text-purple-700",
  STAFF_DEACTIVATE:    "bg-gray-100 text-gray-600",
};

export default function AuditLog() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const role = getAdminRole();

  useEffect(() => {
    if (role !== "ADMIN") { setLoading(false); return; }
    api.get("/admin/audit-log?limit=200")
      .then(r => setEntries(r.data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [role]);

  if (role !== "ADMIN") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700">
          <p className="font-semibold">Access Restricted</p>
          <p className="text-sm mt-1">The audit log is accessible to ADMIN accounts only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gpawa-navy">Audit Log</h1>
      <p className="text-sm text-gray-500">
        Immutable record of all staff actions. Entries cannot be edited or deleted.
      </p>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading audit log...</div>
      ) : (
        <div className="table-card">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Staff</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Action</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Target</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(e => (
                <>
                  <tr
                    key={e.id}
                    onClick={() => setSelected(selected?.id === e.id ? null : e)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${selected?.id === e.id ? "bg-blue-50" : ""}`}
                  >
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {e.timestamp?.slice(0, 16)?.replace("T", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-xs">{e.staff_name ?? "System"}</div>
                      <div className="text-[10px] text-gray-400">{e.staff_email ?? ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[e.action_type] ?? "bg-gray-100 text-gray-600"}`}>
                        {e.action_type?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                      <span className="font-medium">{e.target_type}</span>
                      {e.target_id && (
                        <span className="ml-1 font-mono text-[10px] text-gray-400">{e.target_id?.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400 font-mono">
                      {e.detail ? JSON.stringify(e.detail) : "-"}
                    </td>
                  </tr>

                  {selected?.id === e.id && (
                    <tr key={`${e.id}-detail`}>
                      <td colSpan={5} className="px-4 pb-4 bg-blue-50/30">
                        <div className="pt-3 bg-white rounded-lg border border-gray-200 p-4 text-xs max-w-md space-y-2">
                          <p className="font-semibold text-sm text-gpawa-navy">Audit Entry Detail</p>
                          <D label="Entry ID"    val={e.id} />
                          <D label="Timestamp"   val={e.timestamp?.replace("T", " ").slice(0, 19)} />
                          <D label="Staff"       val={`${e.staff_name ?? "System"} (${e.staff_email ?? "-"})`} />
                          <D label="Action"      val={e.action_type} />
                          <D label="Target Type" val={e.target_type} />
                          <D label="Target ID"   val={e.target_id ?? "-"} />
                          <div>
                            <span className="text-gray-500">Payload: </span>
                            <code className="bg-gray-50 px-1 rounded">{JSON.stringify(e.detail ?? {})}</code>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🔍</p>
              <p>No audit entries yet</p>
            </div>
          )}
          <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
            {entries.length} entries shown (max 200 most recent)
          </div>
        </div>
      )}
    </div>
  );
}

function D({ label, val }: { label: string; val: any }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 shrink-0 w-24">{label}:</span>
      <span className="font-medium break-all">{String(val ?? "-")}</span>
    </div>
  );
}
