import { Fragment, useState, useEffect } from "react";
import { api, formatUGX } from "../lib/api";
import { getAdminRole } from "../lib/auth";

const STATUS_TABS = [
  "ALL",
  "APPROVED",
  "DISBURSED",
  "ACTIVE",
  "PARTIALLY_REPAID",
  "OVERDUE",
  "COMPLETED",
  "REPAID",
  "REJECTED",
] as const;

const STATUS_COLORS: Record<string, string> = {
  PENDING:          "bg-gray-100 text-gray-600",
  APPROVED:         "bg-purple-100 text-purple-700",
  DISBURSED:        "bg-amber-100 text-amber-700",
  ACTIVE:           "bg-amber-100 text-amber-700",
  OVERDUE:          "bg-red-100 text-red-700",
  REPAID:           "bg-green-100 text-green-700",
  COMPLETED:        "bg-green-100 text-green-700",
  PARTIALLY_REPAID: "bg-blue-100 text-blue-700",
  REJECTED:         "bg-gray-100 text-gray-500",
  DEFAULTED:        "bg-red-100 text-red-800",
};

const OPEN_LOAN_STATUSES = new Set(["ACTIVE", "DISBURSED", "PARTIALLY_REPAID", "OVERDUE"]);

export default function CreditLoans() {
  const [loans, setLoans]       = useState<any[]>([]);
  const [filter, setFilter]     = useState<string>("ALL");
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [scoreVal, setScoreVal] = useState(50);
  const [saving, setSaving]     = useState(false);
  const role = getAdminRole();
  const canEdit = role === "OPERATOR" || role === "ADMIN";

  async function load(status: string) {
    setLoading(true);
    try {
      const q = status === "ALL" ? "" : `?status=${status}`;
      const res = await api.get(`/admin/loans${q}&limit=100`);
      setLoans(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(filter); }, [filter]);

  function selectLoan(l: any) {
    if (selected?.id === l.id) { setSelected(null); return; }
    setSelected(l);
    setScoreVal(50);
  }

  async function saveScore() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/admin/users/${selected.user_id}/credit-score`, { credit_score: scoreVal });
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function markOverdue(loanId: string) {
    setSaving(true);
    try {
      await api.patch(`/admin/loans/${loanId}`, { status: "OVERDUE" });
      load(filter);
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function applyPenalty(loanId: string) {
    setSaving(true);
    try {
      await api.patch(`/admin/loans/${loanId}`, { apply_penalty: true });
      load(filter);
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  const daysLeft = (due: string) => {
    const diff = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
    return diff;
  };

  return (
    <div className="space-y-6">
      <h1 className="page-title">Credit &amp; Loans</h1>

      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(s => (
          <button
            key={s}
            onClick={() => { setFilter(s); setSelected(null); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === s
                ? "bg-gpawa-blue text-white border-gpawa-blue"
                : "bg-white text-gray-600 border-gray-200 hover:border-gpawa-blue hover:text-gpawa-blue"
            }`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading loans...</div>
      ) : (
        <div className="table-card">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Borrower</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Principal</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Interest</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Total Owed</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loans.map(l => {
                const days = daysLeft(l.due_date);
                const isOpen = OPEN_LOAN_STATUSES.has(l.status);
                return (
                  <Fragment key={l.id}>
                    <tr
                      onClick={() => selectLoan(l)}
                      className={`cursor-pointer hover:bg-blue-50/40 transition-colors ${selected?.id === l.id ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-gpawa-dark">{l.full_name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden md:table-cell">{l.phone_number}</td>
                      <td className="px-4 py-3 font-medium">{formatUGX(l.principal_ugx)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-600">
                        {formatUGX(l.interest_ugx ?? 0)}
                        {l.loan_tier && (
                          <span className="ml-1 text-xs text-gray-400 capitalize">({l.loan_tier})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell font-bold text-gpawa-dark">{formatUGX(l.total_owed_ugx)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {l.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`text-xs font-medium ${
                          isOpen && days < 0 ? "text-red-600"
                          : isOpen && days <= 3 ? "text-amber-600"
                          : "text-gray-500"
                        }`}>
                          {l.due_date?.slice(0, 10)}
                          {isOpen && l.due_date && (
                            <span className="ml-1">
                              ({days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`})
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>

                    {selected?.id === l.id && canEdit && (
                      <tr>
                        <td colSpan={7} className="px-4 pb-4 bg-blue-50/30">
                          <div className="pt-3 max-w-sm">
                            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 text-sm">
                              <p className="font-semibold text-gpawa-navy">Override Credit Score</p>
                              <p className="text-xs text-gray-500">
                                Borrower: <strong>{l.full_name}</strong>
                              </p>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">New score: <strong>{scoreVal}</strong></p>
                                <input type="range" min={0} max={100} value={scoreVal}
                                  onChange={e => setScoreVal(Number(e.target.value))}
                                  className="w-full"
                                />
                              </div>
                              <button onClick={saveScore} disabled={saving}
                                className="w-full py-2 bg-gpawa-blue text-white text-sm rounded-lg font-medium disabled:opacity-60">
                                {saving ? "Saving…" : "Update Score"}
                              </button>
                              {(l.status === "ACTIVE" || l.status === "DISBURSED" || l.status === "OVERDUE") && (
                                <div className="flex gap-2 pt-2 border-t border-gray-100">
                                  <button onClick={() => markOverdue(l.id)} disabled={saving}
                                    className="flex-1 py-2 text-xs rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50">
                                    Mark overdue
                                  </button>
                                  <button onClick={() => applyPenalty(l.id)} disabled={saving}
                                    className="flex-1 py-2 text-xs rounded-lg border border-red-300 text-red-700 hover:bg-red-50">
                                    Apply penalty
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {loans.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🏦</p>
              <p>No loans {filter !== "ALL" ? `with status ${filter.replace(/_/g, " ")}` : ""}</p>
            </div>
          )}
          <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
            {loans.length} loans shown
          </div>
        </div>
      )}
    </div>
  );
}
