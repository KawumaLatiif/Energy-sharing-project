import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { getAdminRole } from "../lib/auth";

type SettingsMap = Record<string, number>;

const FIELDS: { key: keyof SettingsMap; label: string; step?: number }[] = [
  { key: "MIN_TOPUP_UGX", label: "Min top-up (UGX)" },
  { key: "MAX_TOPUP_UGX", label: "Max top-up (UGX)" },
  { key: "DAILY_TOPUP_LIMIT_UGX", label: "Daily top-up limit (UGX)" },
  { key: "UNVERIFIED_TOPUP_LIMIT_UGX", label: "Unverified account top-up cap (UGX)" },
  { key: "MAX_LOAN_UGX", label: "Max loan (UGX)" },
  { key: "LOAN_FEE_PERCENT", label: "Loan fee (%)", step: 0.1 },
  { key: "LOAN_REPAYMENT_DAYS", label: "Loan repayment period (days)" },
  { key: "LOAN_GRACE_PERIOD_DAYS", label: "Grace period (days)" },
  { key: "LOAN_LATE_PENALTY_PERCENT_PER_WEEK", label: "Late penalty (%/week)", step: 0.1 },
  { key: "MIN_CREDIT_SCORE_FOR_LOAN", label: "Min credit score for loan" },
  { key: "MIN_ACCOUNT_AGE_DAYS_FOR_CREDIT", label: "Min account age for credit (days)" },
  { key: "PIN_MAX_ATTEMPTS", label: "PIN max attempts" },
  { key: "PIN_LOCK_MINUTES", label: "PIN lock duration (minutes)" },
  { key: "USSD_SESSION_TTL_SECONDS", label: "USSD session timeout (seconds)" },
];

export default function Settings() {
  const role = getAdminRole();
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (role !== "ADMIN") { setLoading(false); return; }
    api.get("/admin/settings")
      .then(r => setSettings(r.data.settings))
      .catch(() => setErr("Could not load settings"))
      .finally(() => setLoading(false));
  }, [role]);

  async function save() {
    setSaving(true); setMsg(""); setErr("");
    try {
      const res = await api.patch("/admin/settings", settings);
      setSettings(res.data.settings);
      setMsg("Business rules saved. USSD and wallet use these limits immediately.");
    } catch (e: any) {
      setErr(e.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  }

  if (role !== "ADMIN") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700">
          Settings are accessible to ADMIN accounts only.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gpawa-navy">Business Rules</h1>
        <p className="text-sm text-gray-500 mt-1">
          These limits apply to USSD, web portal, and mobile app. Stored in the database; env vars are fallbacks only.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading settings…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {FIELDS.map(({ key, label, step }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <label className="text-sm text-gray-700 flex-1">{label}</label>
              <input
                type="number"
                step={step ?? 1}
                value={settings[key] ?? ""}
                onChange={e => setSettings(s => ({
                  ...s,
                  [key]: step ? parseFloat(e.target.value) : parseInt(e.target.value, 10),
                }))}
                className="w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right"
              />
            </div>
          ))}
          {msg && <p className="text-sm text-green-700">{msg}</p>}
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-gpawa-blue text-white font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save business rules"}
          </button>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 text-sm text-gray-600 space-y-2">
        <p className="font-semibold text-gray-800">Other configuration</p>
        <p>Support contacts: <code>SUPPORT_*</code> environment variables</p>
        <p>SMS inbound webhook: <code>POST /sms/inbound</code></p>
        <p>Integrations (Africa&apos;s Talking, MoMo, Firebase): environment variables in <code>.env</code></p>
      </div>
    </div>
  );
}
