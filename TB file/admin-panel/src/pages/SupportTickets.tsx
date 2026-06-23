import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

const TYPE_COLORS: Record<string, string> = {
  FRAUD:     "bg-red-100 text-red-700",
  CHAT:      "bg-blue-100 text-blue-700",
  SMS_HELP:  "bg-gray-100 text-gray-700",
  SMS_AGENT: "bg-purple-100 text-purple-700",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN:         "bg-amber-100 text-amber-700",
  IN_PROGRESS:  "bg-blue-100 text-blue-700",
  ESCALATED:    "bg-red-100 text-red-700",
  RESOLVED:     "bg-green-100 text-green-700",
};

export default function SupportTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("OPEN");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const q = status === "ALL" ? "" : `?status=${status}`;
      const res = await api.get(`/admin/support/tickets${q}&limit=100`);
      setTickets(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  async function openTicket(id: string) {
    try {
      const res = await api.get(`/admin/support/tickets/${id}`);
      setSelected(res.data);
    } catch { /* ignore */ }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    setSaving(true);
    try {
      await api.post(`/admin/support/tickets/${selected.id}/reply`, { body: reply.trim() });
      setReply("");
      await openTicket(selected.id);
      load(filter);
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function updateStatus(status: string) {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/admin/support/tickets/${selected.id}`, { status });
      await openTicket(selected.id);
      load(filter);
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Support Queue</h1>
        <p className="text-sm text-gray-500 mt-1">
          Chat, inbound SMS (HELP/AGENT), and fraud escalations. Fraud reports are auto-escalated; do not delay.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["ALL", "OPEN", "ESCALATED", "IN_PROGRESS", "RESOLVED"].map(s => (
          <button
            key={s}
            onClick={() => { setFilter(s); setSelected(null); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === s ? "bg-gpawa-blue text-white border-gpawa-blue"
                : "bg-white text-gray-600 border-gray-200 hover:border-gpawa-blue"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="table-card">
          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Contact</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => openTicket(t.id)}
                    className={`cursor-pointer hover:bg-blue-50/40 ${selected?.id === t.id ? "bg-blue-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[t.ticket_type] ?? "bg-gray-100"}`}>
                        {t.ticket_type?.replace("_", " ")}
                      </span>
                      {t.priority >= 3 && <span className="ml-1 text-xs text-red-600 font-bold">!</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.user_name ?? "Unknown"}</div>
                      <div className="text-xs text-gray-400 font-mono">{t.phone_number}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] ?? ""}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && tickets.length === 0 && (
            <div className="text-center py-12 text-gray-400">No tickets in this queue.</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 min-h-[400px]">
          {!selected ? (
            <div className="text-center py-20 text-gray-400">Select a ticket to view messages.</div>
          ) : (
            <div className="flex flex-col h-full space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gpawa-navy">{selected.subject ?? selected.ticket_type}</p>
                  <p className="text-xs text-gray-500">{selected.user_name} · {selected.phone_number}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {selected.status !== "RESOLVED" && (
                    <>
                      <button onClick={() => updateStatus("IN_PROGRESS")} disabled={saving}
                        className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">In progress</button>
                      {selected.ticket_type === "FRAUD" && (
                        <button onClick={() => updateStatus("ESCALATED")} disabled={saving}
                          className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Escalate</button>
                      )}
                      <button onClick={() => updateStatus("RESOLVED")} disabled={saving}
                        className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Resolve</button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 max-h-64 border rounded-lg p-3 bg-gray-50">
                {(selected.messages ?? []).map((m: any) => (
                  <div key={m.id} className={`text-sm rounded-lg px-3 py-2 ${
                    m.sender_type === "staff" ? "bg-green-100 text-green-900 ml-4"
                    : m.sender_type === "user" ? "bg-white border mr-4"
                    : "bg-gray-200 text-gray-600 text-xs italic"
                  }`}>
                    {m.body}
                  </div>
                ))}
              </div>

              {selected.status !== "RESOLVED" && (
                <form onSubmit={sendReply} className="flex gap-2">
                  <input
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Reply to customer…"
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                  />
                  <button type="submit" disabled={saving || !reply.trim()}
                    className="px-4 py-2 rounded-lg text-sm text-white bg-gpawa-blue disabled:opacity-50">
                    Send
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
