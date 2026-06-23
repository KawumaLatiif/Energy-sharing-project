import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { getAdminRole } from "../lib/auth";

const ROLES = ["CUSTOMER_SERVICE", "OPERATOR", "ADMIN"] as const;
const ROLE_COLORS: Record<string, string> = {
  ADMIN:            "bg-gpawa-blue text-white",
  OPERATOR:         "bg-cyan-100 text-cyan-700",
  CUSTOMER_SERVICE: "bg-gray-100 text-gray-600",
};

export default function StaffAccounts() {
  const [staff, setStaff]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ email: "", full_name: "", password: "", role: "CUSTOMER_SERVICE" });
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const role = getAdminRole();

  async function loadStaff() {
    setLoading(true);
    try {
      const res = await api.get("/admin/staff");
      setStaff(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { loadStaff(); }, []);

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr(""); setCreating(true);
    try {
      await api.post("/admin/staff", form);
      setForm({ email: "", full_name: "", password: "", role: "CUSTOMER_SERVICE" });
      setShowForm(false);
      await loadStaff();
    } catch (err: any) {
      setCreateErr(err.response?.data?.detail || "Failed to create staff account");
    } finally { setCreating(false); }
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this staff account? They will no longer be able to log in.")) return;
    setDeactivating(id);
    try {
      await api.patch(`/admin/staff/${id}/deactivate`);
      setStaff(s => s.map(m => m.id === id ? { ...m, is_active: false } : m));
    } catch { /* ignore */ } finally { setDeactivating(null); }
  }

  if (role !== "ADMIN") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Staff Accounts</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700">
          <p className="font-semibold">Access Restricted</p>
          <p className="text-sm mt-1">Staff account management requires the ADMIN role.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gpawa-navy">Staff Accounts</h1>
        <button
          onClick={() => { setShowForm(f => !f); setCreateErr(""); }}
          className="px-4 py-2 bg-gpawa-blue text-white text-sm font-medium rounded-lg hover:bg-gpawa-navy transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Staff"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gpawa-navy mb-4">New Staff Account</h2>
          <form onSubmit={createStaff} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text" required
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email" required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
                <input
                  type="text" required minLength={6}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            {createErr && <p className="text-sm text-red-600">{createErr}</p>}
            <button type="submit" disabled={creating}
              className="px-6 py-2 bg-gpawa-blue text-white text-sm font-semibold rounded-lg disabled:opacity-60">
              {creating ? "Creating…" : "Create Account"}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading staff...</div>
      ) : (
        <div className="table-card">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Last Login</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gpawa-dark">{s.full_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[s.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {s.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                    {s.last_login ? s.last_login.slice(0, 16).replace("T", " ") : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.is_active && (
                      <button
                        onClick={() => deactivate(s.id)}
                        disabled={deactivating === s.id}
                        className="text-xs text-red-600 hover:underline disabled:opacity-60"
                      >
                        {deactivating === s.id ? "…" : "Deactivate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {staff.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🛡️</p>
              <p>No staff accounts found</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <p className="font-semibold text-gpawa-navy text-sm">Role Permissions</p>
        {[
          { role: "CUSTOMER_SERVICE", desc: "Read-only: view users, transactions, meters, and tokens." },
          { role: "OPERATOR", desc: "Customer Service permissions plus: manage loans, update verification status and credit scores, generate reports." },
          { role: "ADMIN", desc: "Full access: all of the above plus staff management, audit log, and system settings." },
        ].map(({ role: r, desc }) => (
          <div key={r} className="flex items-start gap-3 text-sm">
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[r]}`}>{r}</span>
            <span className="text-gray-500">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
