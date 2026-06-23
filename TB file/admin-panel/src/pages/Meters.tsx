import { useState, useEffect, useCallback } from "react";
import { api, formatUGX } from "../lib/api";
import { getAdminRole } from "../lib/auth";

type Tab = "active" | "archived";

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-green-100 text-green-700",
  inactive:  "bg-gray-100 text-gray-500",
  suspended: "bg-red-100 text-red-700",
};

const EMPTY_FORM = {
  user_id: "",
  meter_number: "",
  label: "",
  architecture: "STS" as "STS" | "AMI",
  iot_device_token: "",
  static_ip: "",
  status: "active",
};

export default function Meters() {
  const [tab, setTab]               = useState<Tab>("active");
  const [meters, setMeters]         = useState<any[]>([]);
  const [archives, setArchives]     = useState<any[]>([]);
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState<string | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [deleteErr, setDeleteErr]   = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [createErr, setCreateErr]   = useState("");
  const [creating, setCreating]     = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerResults, setOwnerResults] = useState<any[]>([]);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<any | null>(null);
  const [archiveDetail, setArchiveDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingMeter, setEditingMeter] = useState<any | null>(null);
  const [editToken, setEditToken] = useState("");
  const [editDeviceId, setEditDeviceId] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const role = getAdminRole();
  const canEdit = role === "OPERATOR" || role === "ADMIN";

  const loadActive = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/meters?search=${encodeURIComponent(q)}&limit=100`);
      setMeters(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const loadArchived = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/meter-archives?search=${encodeURIComponent(q)}&limit=100`);
      setArchives(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "active") loadActive("");
    else loadArchived("");
  }, [tab, loadActive, loadArchived]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (tab === "active") loadActive(search);
      else loadArchived(search);
    }, 350);
    return () => clearTimeout(t);
  }, [search, tab, loadActive, loadArchived]);

  useEffect(() => {
    if (!showForm) return;
    if (!ownerSearch.trim()) {
      setOwnerResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setOwnerLoading(true);
      try {
        const res = await api.get(
          `/admin/users?search=${encodeURIComponent(ownerSearch.trim())}&limit=20`
        );
        setOwnerResults(res.data);
      } catch {
        setOwnerResults([]);
      } finally {
        setOwnerLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [ownerSearch, showForm]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setOwnerSearch("");
    setOwnerResults([]);
    setSelectedOwner(null);
    setCreateErr("");
  }

  async function changeStatus(meterId: string, status: string) {
    setSaving(meterId);
    try {
      await api.patch(`/admin/meters/${meterId}/status`, { status });
      loadActive(search);
    } catch { /* ignore */ } finally { setSaving(null); }
  }

  function openEditAmi(m: any) {
    setEditingMeter(m);
    setEditToken(m.iot_device_token || "");
    setEditDeviceId(m.thingsboard_device_id || "");
    setEditErr("");
  }

  async function saveAmiCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMeter) return;
    setEditSaving(true);
    setEditErr("");
    try {
      await api.patch(`/admin/meters/${editingMeter.id}/ami-credentials`, {
        iot_device_token: editToken.trim(),
        thingsboard_device_id: editDeviceId.trim() || undefined,
      });
      setEditingMeter(null);
      loadActive(search);
    } catch (err: any) {
      setEditErr(err.response?.data?.detail || "Failed to update device token");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteMeter(m: { id: string; meter_number: string; full_name: string; token_count?: number }) {
    setDeleteErr("");
    const tokens = m.token_count ?? 0;
    const ok = confirm(
      `Delete meter ${m.meter_number} (${m.full_name})?\n\n` +
      "The registration will be removed so the number can be added again. " +
      (tokens > 0
        ? `${tokens} token(s) will be saved in the deleted-meters archive.`
        : "No tokens on record; a minimal archive entry will still be created.")
    );
    if (!ok) return;

    setDeleting(m.id);
    try {
      await api.delete(`/admin/meters/${m.id}`);
      await loadActive(search);
    } catch (err: any) {
      setDeleteErr(err.response?.data?.detail || "Failed to delete meter");
    } finally {
      setDeleting(null);
    }
  }

  async function openArchive(id: string) {
    setDetailLoading(true);
    setArchiveDetail(null);
    try {
      const res = await api.get(`/admin/meter-archives/${id}`);
      setArchiveDetail(res.data);
    } catch { /* ignore */ } finally {
      setDetailLoading(false);
    }
  }

  function selectOwner(user: any) {
    setSelectedOwner(user);
    setForm(f => ({ ...f, user_id: user.id }));
    setOwnerSearch(`${user.full_name} (${user.phone_number})`);
    setOwnerResults([]);
  }

  async function createMeter(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr("");
    if (!form.user_id) {
      setCreateErr("Select an owner from the search results.");
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, string> = {
        user_id: form.user_id,
        meter_number: form.meter_number.trim(),
        architecture: form.architecture,
        status: form.status,
      };
      if (form.label.trim()) payload.label = form.label.trim();
      if (form.architecture === "AMI") {
        payload.iot_device_token = form.iot_device_token.trim();
        if (form.static_ip.trim()) payload.static_ip = form.static_ip.trim();
      }
      await api.post("/admin/meters", payload);
      resetForm();
      setShowForm(false);
      await loadActive(search);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setCreateErr(detail.map((d: any) => d.msg).join("; "));
      } else {
        setCreateErr(detail || "Failed to create meter");
      }
    } finally {
      setCreating(false);
    }
  }

  const searchPlaceholder =
    tab === "active" ? "Search by meter number..." : "Search deleted meters...";

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Meters</h1>
        <div className="toolbar">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
          />
          {canEdit && tab === "active" && (
            <button
              type="button"
              onClick={() => {
                if (showForm) resetForm();
                setShowForm(f => !f);
              }}
              className="px-4 py-2 bg-gpawa-blue text-white text-sm font-medium rounded-lg hover:bg-gpawa-navy transition-colors whitespace-nowrap"
            >
              {showForm ? "Cancel" : "+ Add New meter"}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(["active", "archived"] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setSearch(""); setArchiveDetail(null); setShowForm(false); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-gpawa-blue text-gpawa-blue"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "active" ? "Active Meters" : "Deleted Archive"}
          </button>
        ))}
      </div>

      {showForm && canEdit && tab === "active" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gpawa-navy mb-4">Register New Meter</h2>
          <form onSubmit={createMeter} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                <input
                  type="text"
                  required
                  value={ownerSearch}
                  onChange={e => {
                    setOwnerSearch(e.target.value);
                    setSelectedOwner(null);
                    setForm(f => ({ ...f, user_id: "" }));
                  }}
                  placeholder="Search by name or phone number..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                />
                {ownerLoading && (
                  <p className="text-xs text-gray-400 mt-1">Searching users...</p>
                )}
                {ownerResults.length > 0 && !selectedOwner && (
                  <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {ownerResults.map(u => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => selectOwner(u)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          <span className="font-medium">{u.full_name}</span>
                          <span className="text-gray-400 ml-2 font-mono text-xs">{u.phone_number}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meter Number</label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="\d{11}"
                  maxLength={11}
                  value={form.meter_number}
                  onChange={e => setForm(f => ({ ...f, meter_number: e.target.value.replace(/\D/g, "") }))}
                  placeholder="11-digit meter number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Home, Shop"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meter Type</label>
                <select
                  value={form.architecture}
                  onChange={e => setForm(f => ({
                    ...f,
                    architecture: e.target.value as "STS" | "AMI",
                    iot_device_token: "",
                    static_ip: "",
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                >
                  <option value="STS">STS: Token keypad</option>
                  <option value="AMI">AMI: Networked (ThingsBoard)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="suspended">suspended</option>
                </select>
              </div>

              {form.architecture === "AMI" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ThingsBoard Device Token
                    </label>
                    <input
                      type="text"
                      required
                      value={form.iot_device_token}
                      onChange={e => setForm(f => ({ ...f, iot_device_token: e.target.value }))}
                      placeholder="Required for AMI meters"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Static IP <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={form.static_ip}
                      onChange={e => setForm(f => ({ ...f, static_ip: e.target.value }))}
                      placeholder="e.g. 192.168.1.10"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                    />
                  </div>
                </>
              )}
            </div>

            {createErr && <p className="text-sm text-red-600">{createErr}</p>}

            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2 bg-gpawa-blue text-white text-sm font-semibold rounded-lg disabled:opacity-60"
            >
              {creating ? "Saving…" : "Save Meter"}
            </button>
          </form>
        </div>
      )}

      {deleteErr && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {deleteErr}
        </div>
      )}

      {editingMeter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveAmiCredentials} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-900">Edit AMI device token</h3>
            <p className="text-sm text-gray-500 font-mono">{editingMeter.meter_number}</p>
            <label className="block text-sm">
              <span className="text-gray-700 font-medium">ThingsBoard access token</span>
              <input
                required
                value={editToken}
                onChange={e => setEditToken(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-700 font-medium">ThingsBoard device UUID <span className="text-gray-400">(optional)</span></span>
              <input
                value={editDeviceId}
                onChange={e => setEditDeviceId(e.target.value)}
                placeholder="For tenant telemetry reads"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs"
              />
            </label>
            {editErr && <p className="text-sm text-red-600">{editErr}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditingMeter(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" disabled={editSaving} className="px-4 py-2 bg-gpawa-blue text-white text-sm font-semibold rounded-lg disabled:opacity-60">
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : tab === "active" ? (
        <div className="table-card">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Meter Number</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Label</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Owner</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Tokens</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Registered</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden xl:table-cell">Device token</th>
                {canEdit && <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {meters.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gpawa-dark tracking-wider">{m.meter_number}</td>
                  <td className="px-4 py-3 text-gray-500">{m.label || <span className="text-gray-300 italic">No label</span>}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        m.architecture === "AMI"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {m.architecture ?? "STS"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{m.full_name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden md:table-cell">{m.phone_number}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[m.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{m.token_count ?? 0}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                    {m.registered_at?.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-gray-500 hidden xl:table-cell max-w-[140px] truncate">
                    {m.architecture === "AMI" ? (m.iot_device_token || "—") : "—"}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {m.architecture === "AMI" && (
                          <button
                            type="button"
                            onClick={() => openEditAmi(m)}
                            className="text-xs text-gpawa-blue hover:underline"
                          >
                            Edit token
                          </button>
                        )}
                        <select
                          value={m.status}
                          disabled={saving === m.id}
                          onChange={e => changeStatus(m.id, e.target.value)}
                          className="text-xs border border-gray-300 rounded-lg px-2 py-1"
                        >
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                          <option value="suspended">suspended</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => deleteMeter(m)}
                          disabled={deleting === m.id}
                          title="Archive and remove so this number can be registered again"
                          className="text-xs text-red-600 hover:underline disabled:opacity-40"
                        >
                          {deleting === m.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {meters.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🔌</p>
              <p>{search ? "No meters match your search" : "No meters registered yet"}</p>
            </div>
          )}
          <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
            {meters.length} meters shown
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="table-card">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Meter Number</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Owner</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Tokens</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Deleted</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">By</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {archives.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-gpawa-dark">{a.meter_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.owner_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{a.owner_phone}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {a.architecture ?? "STS"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.token_count}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                      {a.deleted_at?.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                      {a.deleted_by_name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openArchive(a.id)}
                        className="text-xs text-gpawa-blue hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {archives.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-3xl mb-2">📦</p>
                <p>{search ? "No archived meters match your search" : "No deleted meters archived yet"}</p>
              </div>
            )}
            <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
              {archives.length} archived records
            </div>
          </div>

          {(archiveDetail || detailLoading) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-semibold text-gpawa-navy">Archive Detail</h2>
                  {archiveDetail && (
                    <p className="text-sm text-gray-500 mt-1 font-mono">{archiveDetail.meter_number}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setArchiveDetail(null)}
                  className="text-sm text-gray-500 hover:text-gray-800"
                >
                  Close
                </button>
              </div>
              {detailLoading ? (
                <p className="text-gray-400 text-sm">Loading...</p>
              ) : archiveDetail && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-gray-400 block text-xs">Owner</span>{archiveDetail.owner_name}</div>
                    <div><span className="text-gray-400 block text-xs">Phone</span>{archiveDetail.owner_phone}</div>
                    <div><span className="text-gray-400 block text-xs">Registered</span>{archiveDetail.registered_at?.slice(0, 10)}</div>
                    <div><span className="text-gray-400 block text-xs">Deleted</span>{archiveDetail.deleted_at?.slice(0, 16).replace("T", " ")}</div>
                    <div><span className="text-gray-400 block text-xs">Type</span>{archiveDetail.architecture}</div>
                    <div><span className="text-gray-400 block text-xs">Status at deletion</span>{archiveDetail.status}</div>
                    <div><span className="text-gray-400 block text-xs">Label</span>{archiveDetail.label || "-"}</div>
                    <div><span className="text-gray-400 block text-xs">Deleted by</span>{archiveDetail.deleted_by_name || "-"}</div>
                  </div>
                  {Array.isArray(archiveDetail.tokens) && archiveDetail.tokens.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Token history ({archiveDetail.tokens.length})
                      </h3>
                      <div className="overflow-x-auto border border-gray-100 rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-3 py-2">Token</th>
                              <th className="text-left px-3 py-2">Amount</th>
                              <th className="text-left px-3 py-2">Status</th>
                              <th className="text-left px-3 py-2">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {archiveDetail.tokens.map((t: any) => (
                              <tr key={t.id}>
                                <td className="px-3 py-2 font-mono">{t.token_code}</td>
                                <td className="px-3 py-2">{formatUGX(t.amount_ugx)}</td>
                                <td className="px-3 py-2">{t.status}</td>
                                <td className="px-3 py-2 text-gray-400">{t.created_at?.slice(0, 10)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No tokens were recorded for this meter.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
