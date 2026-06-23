import { useState, useEffect, useCallback } from "react";
import { api, formatUGX, openPdf } from "../lib/api";
import { getAdminRole } from "../lib/auth";

const VER_COLORS: Record<string, string> = {
  verified:   "bg-green-100 text-green-700",
  unverified: "bg-yellow-100 text-yellow-700",
  flagged:    "bg-red-100 text-red-700",
};

const VER_LABELS: Record<string, string> = {
  verified:   "Verified",
  unverified: "Not Verified",
  flagged:    "Flagged",
};

function loanStatusColor(status: string): string {
  switch (status) {
    case "ACTIVE":
    case "DISBURSED":
      return "bg-amber-100 text-amber-700";
    case "REPAID":
    case "COMPLETED":
      return "bg-green-100 text-green-700";
    case "APPROVED":
      return "bg-purple-100 text-purple-700";
    case "PARTIALLY_REPAID":
      return "bg-blue-100 text-blue-700";
    case "OVERDUE":
    case "DEFAULTED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

type Tab = "users" | "verifications";

export default function Users() {
  const [tab, setTab]             = useState<Tab>("users");
  const [users, setUsers]         = useState<any[]>([]);
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<any>(null);
  const [detail, setDetail]       = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving]       = useState("");
  const [verFilter, setVerFilter] = useState("PENDING");
  const [verRequests, setVerRequests] = useState<any[]>([]);
  const [verLoading, setVerLoading] = useState(false);
  const [kycEdit, setKycEdit]     = useState("");
  const [scoreEdit, setScoreEdit] = useState(0);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState<string | null>(null);
  const role = getAdminRole();
  const canEdit = role === "OPERATOR" || role === "ADMIN";

  const loadUsers = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/users?search=${encodeURIComponent(q)}&limit=100`);
      setUsers(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const loadVerifications = useCallback(async (status: string) => {
    setVerLoading(true);
    try {
      const res = await api.get(`/verification/admin/requests?status=${status}`);
      setVerRequests(res.data);
    } catch { /* ignore */ } finally { setVerLoading(false); }
  }, []);

  useEffect(() => { loadUsers(""); }, [loadUsers]);

  useEffect(() => {
    const t = setTimeout(() => loadUsers(search), 350);
    return () => clearTimeout(t);
  }, [search, loadUsers]);

  useEffect(() => {
    if (tab === "verifications") loadVerifications(verFilter);
  }, [tab, verFilter, loadVerifications]);

  async function openUser(u: any) {
    if (selected?.id === u.id) { setSelected(null); setDetail(null); return; }
    setSelected(u);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/users/${u.id}`);
      setDetail(res.data);
      setKycEdit(res.data.kyc_status);
      setScoreEdit(res.data.credit_score);
    } catch { /* ignore */ } finally { setDetailLoading(false); }
  }

  async function toggleSuspend() {
    if (!detail) return;
    setSaving("suspend");
    try {
      const res = await api.patch(`/admin/users/${detail.id}/suspend`, { suspend: !detail.is_suspended });
      setDetail((d: any) => ({ ...d, is_suspended: res.data.is_suspended }));
      setUsers(us => us.map(u => u.id === detail.id ? { ...u, is_suspended: res.data.is_suspended } : u));
    } catch { /* ignore */ } finally { setSaving(""); }
  }

  async function saveKyc() {
    if (!detail) return;
    setSaving("kyc");
    try {
      await api.patch(`/admin/users/${detail.id}/kyc`, { kyc_status: kycEdit });
      setDetail((d: any) => ({ ...d, kyc_status: kycEdit }));
      setUsers(us => us.map(u => u.id === detail.id ? { ...u, kyc_status: kycEdit } : u));
    } catch { /* ignore */ } finally { setSaving(""); }
  }

  async function saveScore() {
    if (!detail) return;
    setSaving("score");
    try {
      await api.patch(`/admin/users/${detail.id}/credit-score`, { credit_score: scoreEdit });
      setDetail((d: any) => ({ ...d, credit_score: scoreEdit }));
      setUsers(us => us.map(u => u.id === detail.id ? { ...u, credit_score: scoreEdit } : u));
    } catch { /* ignore */ } finally { setSaving(""); }
  }

  async function reviewVerification(requestId: string, decision: "APPROVED" | "REJECTED") {
    setReviewing(requestId);
    try {
      await api.patch(`/verification/admin/requests/${requestId}/review`, {
        decision,
        review_note: reviewNote || null,
      });
      setReviewNote("");
      loadVerifications(verFilter);
    } catch { /* ignore */ } finally { setReviewing(null); }
  }

  async function viewIdDocument(requestId: string) {
    setDocLoading(requestId);
    try {
      await openPdf(`/verification/admin/requests/${requestId}/id-document`);
    } catch {
      alert("Could not open National ID document.");
    } finally {
      setDocLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setTab("users")}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              tab === "users" ? "bg-gpawa-navy text-white border-gpawa-navy" : "bg-white text-gray-600 border-gray-200 hover:border-gpawa-navy"
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setTab("verifications")}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              tab === "verifications" ? "bg-gpawa-navy text-white border-gpawa-navy" : "bg-white text-gray-600 border-gray-200 hover:border-gpawa-navy"
            }`}
          >
            Verification Requests
            {verRequests.length > 0 && tab !== "verifications" && (
              <span className="ml-1.5 bg-gpawa-amber text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {verRequests.length}
              </span>
            )}
          </button>
        </div>

        {tab === "users" && (
          <input
            type="search" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-gpawa-blue shrink-0"
          />
        )}
      </div>

      {/* ─── Users tab ─── */}
      {tab === "users" && (
        loading ? (
          <div className="text-center py-16 text-gray-400">Loading users...</div>
        ) : (
          <div className="table-card">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Verification</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Score</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Balance</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <>
                    <tr
                      key={u.id}
                      onClick={() => openUser(u)}
                      className={`cursor-pointer hover:bg-blue-50/40 transition-colors ${selected?.id === u.id ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-gpawa-dark">{u.full_name}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.phone_number}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${VER_COLORS[u.kyc_status] ?? "bg-gray-100 text-gray-600"}`}>
                          {VER_LABELS[u.kyc_status] ?? u.kyc_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-gpawa-blue rounded-full" style={{ width: `${u.credit_score}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{u.credit_score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-700 font-medium">
                        {formatUGX(u.wallet_balance_ugx)}
                      </td>
                      <td className="px-4 py-3">
                        {u.is_suspended
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Suspended</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Active</span>
                        }
                      </td>
                    </tr>

                    {selected?.id === u.id && (
                      <tr key={`${u.id}-detail`}>
                        <td colSpan={6} className="px-4 pb-4 bg-blue-50/30">
                          {detailLoading ? (
                            <div className="py-6 text-center text-gray-400 text-sm">Loading...</div>
                          ) : detail ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
                              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2 text-xs">
                                <p className="font-semibold text-sm text-gpawa-navy mb-2">Account Info</p>
                                <Row label="ID"          val={detail.id?.slice(0, 8) + "…"} />
                                <Row label="NIN"         val={detail.national_id ?? "-"} />
                                <Row label="Currency"    val={detail.currency} />
                                <Row label="Joined"      val={detail.created_at?.slice(0, 10)} />
                                <Row label="Last Login"  val={detail.last_login?.slice(0, 10) ?? "Never"} />
                                <Row label="Meters"      val={detail.meters?.length ?? 0} />
                              </div>

                              {canEdit && (
                                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4 text-sm">
                                  <p className="font-semibold text-gpawa-navy">Actions</p>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Verification Status</p>
                                    <div className="flex gap-2">
                                      <select value={kycEdit} onChange={e => setKycEdit(e.target.value)}
                                        className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5">
                                        <option value="unverified">Not Verified</option>
                                        <option value="verified">Verified</option>
                                        <option value="flagged">Flagged</option>
                                      </select>
                                      <button onClick={saveKyc} disabled={saving === "kyc"}
                                        className="text-xs px-3 py-1.5 bg-gpawa-blue text-white rounded disabled:opacity-60">
                                        {saving === "kyc" ? "…" : "Save"}
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Credit Score: {scoreEdit}</p>
                                    <input type="range" min={0} max={100} value={scoreEdit}
                                      onChange={e => setScoreEdit(Number(e.target.value))} className="w-full mb-1" />
                                    <button onClick={saveScore} disabled={saving === "score"}
                                      className="w-full text-xs py-1.5 bg-gpawa-blue text-white rounded disabled:opacity-60">
                                      {saving === "score" ? "Saving…" : "Update Score"}
                                    </button>
                                  </div>
                                  <button onClick={toggleSuspend} disabled={saving === "suspend"}
                                    className={`w-full text-xs py-2 rounded font-medium disabled:opacity-60 ${
                                      detail.is_suspended ? "bg-green-600 text-white" : "bg-red-600 text-white"
                                    }`}>
                                    {saving === "suspend" ? "…" : detail.is_suspended ? "Unsuspend Account" : "Suspend Account"}
                                  </button>
                                </div>
                              )}

                              <div className="bg-white rounded-lg border border-gray-200 p-4 text-xs">
                                <p className="font-semibold text-sm text-gpawa-navy mb-2">Recent Loans</p>
                                {detail.loans?.length === 0 ? (
                                  <p className="text-gray-400">No loans</p>
                                ) : detail.loans?.map((l: any) => (
                                  <div key={l.id} className="flex justify-between border-b border-gray-50 py-1.5 last:border-0">
                                    <div>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${loanStatusColor(l.status)}`}>{l.status.replace(/_/g, " ")}</span>
                                      <span className="ml-1 text-gray-500">{l.due_date?.slice(0, 10)}</span>
                                    </div>
                                    <span className="font-medium">{formatUGX(l.total_owed_ugx)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
            {users.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-3xl mb-2">👥</p>
                <p>{search ? "No users match your search" : "No users yet"}</p>
              </div>
            )}
            <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">{users.length} users shown</div>
          </div>
        )
      )}

      {/* ─── Verification Requests tab ─── */}
      {tab === "verifications" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <strong>Note:</strong> For large-scale verification operations, consider deploying a trained AI agent that can review National ID documents, cross-check details, and approve accounts 24/7 without manual intervention.
          </div>

          <div className="flex gap-2">
            {["PENDING", "APPROVED", "REJECTED"].map(s => (
              <button key={s} onClick={() => setVerFilter(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  verFilter === s ? "bg-gpawa-blue text-white border-gpawa-blue" : "bg-white text-gray-600 border-gray-200"
                }`}>
                {s}
              </button>
            ))}
          </div>

          {verLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : verRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
              <p className="text-3xl mb-2">📋</p>
              <p>No {verFilter.toLowerCase()} verification requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {verRequests.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-semibold text-gpawa-navy">{r.full_name}</p>
                      <p className="text-sm text-gray-500">{r.phone_number} · Submitted {r.submitted_at?.slice(0, 10)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status === "APPROVED" ? "bg-green-100 text-green-700"
                      : r.status === "REJECTED" ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                    }`}>{r.status}</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <InfoBox label="National ID"   val={r.national_id} />
                    <InfoBox label="Address"       val={r.address} />
                    <InfoBox label="Next of Kin"   val={`${r.next_of_kin_name} (${r.next_of_kin_relationship})`} />
                    <InfoBox label="NOK Phone"     val={r.next_of_kin_phone} />
                    {r.review_note && <InfoBox label="Review Note" val={r.review_note} />}
                  </div>

                  {r.has_id_document && (
                    <button
                      type="button"
                      onClick={() => viewIdDocument(r.id)}
                      disabled={docLoading === r.id}
                      className="text-sm font-medium text-gpawa-blue hover:underline disabled:opacity-60"
                    >
                      {docLoading === r.id ? "Opening…" : "View National ID (PDF)"}
                    </button>
                  )}

                  {r.status === "PENDING" && canEdit && (
                    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
                      <input
                        type="text" value={reviewNote}
                        onChange={e => setReviewNote(e.target.value)}
                        placeholder="Optional review note..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => reviewVerification(r.id, "APPROVED")}
                          disabled={reviewing === r.id}
                          className="flex-1 py-2 bg-green-600 text-white text-sm font-medium rounded-lg disabled:opacity-60"
                        >
                          {reviewing === r.id ? "…" : "Approve"}
                        </button>
                        <button
                          onClick={() => reviewVerification(r.id, "REJECTED")}
                          disabled={reviewing === r.id}
                          className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg disabled:opacity-60"
                        >
                          {reviewing === r.id ? "…" : "Reject"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, val }: { label: string; val: any }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{String(val)}</span>
    </div>
  );
}

function InfoBox({ label, val }: { label: string; val: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5">
      <p className="text-gray-400 text-[10px] mb-0.5">{label}</p>
      <p className="font-medium text-gray-800 break-words">{val}</p>
    </div>
  );
}
