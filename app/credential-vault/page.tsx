"use client";

import AdminGuard from "@/components/auth/AdminGuard";
import Sidebar from "@/components/ui/Sidebar";
import Navbar from "@/components/ui/Navbar";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

type VaultAccessType = "api_key" | "user_role";
type VaultSeverity = "low" | "medium" | "high" | "critical";
type VaultStatus = "active" | "rotated" | "revoked" | "expired";

interface UserRef {
  _id: string;
  name?: string;
  email: string;
  role?: "admin" | "user";
}

interface VaultItem {
  _id: string;
  accessType: VaultAccessType;
  severity: VaultSeverity;
  status: VaultStatus;
  name: string;
  description?: string;
  websiteLink?: string;
  userRole?: string;
  apiKey?: string;
  apiSecret?: string;
  createdBy?: UserRef;
  sharedWithUsers?: UserRef[];
  createdAt: string;
  updatedAt: string;
}

export default function CredentialVaultPage() {
  const { data: session } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [items, setItems] = useState<VaultItem[]>([]);
  const [users, setUsers] = useState<UserRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [revealIds, setRevealIds] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<{
    accessType: VaultAccessType;
    severity: VaultSeverity;
    status: VaultStatus;
    name: string;
    description: string;
    websiteLink: string;
    userRole: string;
    apiKey: string;
    apiSecret: string;
    sharedWithUsers: string[];
  }>({
    accessType: "api_key",
    severity: "medium",
    status: "active",
    name: "",
    description: "",
    websiteLink: "",
    userRole: "",
    apiKey: "",
    apiSecret: "",
    sharedWithUsers: [],
  });

  const isAdmin = (session?.user as any)?.role === "admin";

  const severityBadge = (severity: VaultSeverity) => {
    if (severity === "critical") return "bg-red-500/10 text-red-400 border border-red-500/20";
    if (severity === "high") return "bg-orange-500/10 text-orange-400 border border-orange-500/20";
    if (severity === "medium") return "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20";
    return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
  };

  const statusBadge = (status: VaultStatus) => {
    if (status === "active") return "bg-green-500/10 text-green-400 border border-green-500/20";
    if (status === "rotated") return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    if (status === "revoked") return "bg-red-500/10 text-red-400 border border-red-500/20";
    return "bg-gray-500/10 text-gray-300 border border-gray-500/20";
  };

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [vaultRes, usersRes] = await Promise.all([
        fetch("/api/admin/credential-vault"),
        fetch("/api/admin/users"),
      ]);

      const vaultData = await vaultRes.json();
      const usersData = await usersRes.json();

      if (!vaultRes.ok) throw new Error(vaultData?.error || "Failed to load vault items");
      if (!usersRes.ok) throw new Error(usersData?.error || "Failed to load users");

      setItems(Array.isArray(vaultData) ? vaultData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const resetForm = () => {
    setForm({
      accessType: "api_key",
      severity: "medium",
      status: "active",
      name: "",
      description: "",
      websiteLink: "",
      userRole: "",
      apiKey: "",
      apiSecret: "",
      sharedWithUsers: [],
    });
  };

  const openCreate = () => {
    setError("");
    setEditingId(null);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (it: VaultItem) => {
    setError("");
    setEditingId(it._id);
    setForm({
      accessType: it.accessType,
      severity: it.severity,
      status: it.status,
      name: it.name || "",
      description: it.description || "",
      websiteLink: it.websiteLink || "",
      userRole: it.userRole || "",
      apiKey: it.apiKey || "",
      apiSecret: it.apiSecret || "",
      sharedWithUsers: Array.isArray(it.sharedWithUsers)
        ? it.sharedWithUsers.map((u) => u._id).filter(Boolean)
        : [],
    });
    setShowModal(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const isEditing = Boolean(editingId);
      const url = isEditing
        ? `/api/admin/credential-vault/${editingId}`
        : "/api/admin/credential-vault";
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || (isEditing ? "Failed to update item" : "Failed to create item"));
      setShowModal(false);
      setEditingId(null);
      resetForm();
      fetchAll();
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this credential entry?")) return;
    try {
      const res = await fetch(`/api/admin/credential-vault/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete");
      fetchAll();
    } catch (e: any) {
      alert(e?.message || "Failed to delete");
    }
  };

  const toggleReveal = (id: string) => {
    setRevealIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const userOptions = useMemo(() => {
    return users
      .slice()
      .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
      .map((u) => ({
        id: u._id,
        label: `${u.name ? `${u.name} — ` : ""}${u.email}`,
      }));
  }, [users]);

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#050505] flex">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} isAdmin={isAdmin} />

        <div className="flex-1 flex flex-col min-w-0">
          <Navbar setSidebarOpen={setIsSidebarOpen} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                    <KeyRound className="text-orange-500" size={24} />
                    Credential Vault
                  </h1>
                  <p className="text-gray-400 mt-1 text-sm sm:text-base">
                    Store shared API keys and role-based access details so you can rotate or delete
                    them when someone leaves.
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={openCreate}
                  className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-700 text-white rounded-lg hover:from-orange-500 hover:to-amber-600 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                >
                  <Plus size={18} />
                  Add Secret
                </motion.button>
              </motion.div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[900px]">
                    <thead>
                      <tr className="border-b border-white/5 text-gray-400 text-sm">
                        <th className="p-4 pl-6">Name</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Severity</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Details</th>
                        <th className="p-4 text-right pr-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-500">
                            Loading vault...
                          </td>
                        </tr>
                      ) : items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-500">
                            No credentials stored yet
                          </td>
                        </tr>
                      ) : (
                        items.map((it) => {
                          const revealed = Boolean(revealIds[it._id]);
                          const isApi = it.accessType === "api_key";
                          return (
                            <tr key={it._id} className="hover:bg-white/5 transition-colors group">
                              <td className="p-4 pl-6">
                                <div className="space-y-0.5">
                                  <p className="text-white font-medium">{it.name}</p>
                                  <p className="text-xs text-gray-500">
                                    Updated {new Date(it.updatedAt).toLocaleString()}
                                  </p>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-gray-200 border border-white/10">
                                  {isApi ? <KeyRound size={12} /> : <ShieldCheck size={12} />}
                                  {isApi ? "API key" : "Role access"}
                                </span>
                              </td>
                              <td className="p-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${severityBadge(
                                    it.severity
                                  )}`}
                                >
                                  {it.severity}
                                </span>
                              </td>
                              <td className="p-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(
                                    it.status
                                  )}`}
                                >
                                  {it.status}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-gray-300 space-y-1">
                                  {it.websiteLink ? (
                                    <a
                                      href={it.websiteLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-orange-400 hover:text-orange-300 underline underline-offset-4"
                                    >
                                      {it.websiteLink}
                                    </a>
                                  ) : (
                                    <span className="text-gray-500">—</span>
                                  )}

                                  {it.description ? (
                                    <p className="text-gray-400 text-xs line-clamp-2">
                                      {it.description}
                                    </p>
                                  ) : null}

                                  {isApi ? (
                                    <div className="text-xs text-gray-400">
                                      <div>
                                        <span className="text-gray-500">Key:</span>{" "}
                                        <span className="font-mono">
                                          {revealed ? it.apiKey : "••••••••••••"}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Secret:</span>{" "}
                                        <span className="font-mono">
                                          {revealed ? it.apiSecret : "••••••••••••"}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-400">
                                      <span className="text-gray-500">Role:</span>{" "}
                                      <span className="font-mono">{it.userRole || "—"}</span>
                                    </div>
                                  )}

                                  <div className="text-xs text-gray-400">
                                    <span className="text-gray-500">Shared with:</span>{" "}
                                    {Array.isArray(it.sharedWithUsers) && it.sharedWithUsers.length > 0 ? (
                                      <span className="text-gray-300">
                                        {it.sharedWithUsers
                                          .map((u) => u?.email || u?.name || "")
                                          .filter(Boolean)
                                          .join(", ")}
                                      </span>
                                    ) : (
                                      <span className="text-gray-500">—</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-right pr-6">
                                <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                  {isApi && (
                                    <button
                                      onClick={() => toggleReveal(it._id)}
                                      className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                      title={revealed ? "Hide secrets" : "Reveal secrets"}
                                    >
                                      {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openEdit(it)}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => remove(it._id)}
                                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <AnimatePresence>
                {showModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowModal(false)}
                      className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="relative w-full max-w-xl bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl"
                    >
                      <h3 className="text-xl font-bold text-white mb-4">
                        {editingId ? "Edit credential entry" : "Add credential entry"}
                      </h3>

                      <form onSubmit={submit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">
                              Access Type
                            </label>
                            <select
                              value={form.accessType}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  accessType: e.target.value as VaultAccessType,
                                }))
                              }
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                            >
                              <option value="api_key">API key</option>
                              <option value="user_role">User role access</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">
                              Severity
                            </label>
                            <select
                              value={form.severity}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  severity: e.target.value as VaultSeverity,
                                }))
                              }
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                            >
                              <option value="low">low</option>
                              <option value="medium">medium</option>
                              <option value="high">high</option>
                              <option value="critical">critical</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">
                              Status
                            </label>
                            <select
                              value={form.status}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, status: e.target.value as VaultStatus }))
                              }
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                            >
                              <option value="active">active</option>
                              <option value="rotated">rotated</option>
                              <option value="revoked">revoked</option>
                              <option value="expired">expired</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">
                              Name
                            </label>
                            <input
                              required
                              value={form.name}
                              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                              placeholder="e.g. Stripe API (prod)"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">
                            Website Link
                          </label>
                          <input
                            value={form.websiteLink}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, websiteLink: e.target.value }))
                            }
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                            placeholder="https://..."
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">
                            Description
                          </label>
                          <textarea
                            value={form.description}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, description: e.target.value }))
                            }
                            className="w-full px-4 py-2 min-h-[90px] bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                            placeholder="What this credential is used for..."
                          />
                        </div>

                        {form.accessType === "user_role" ? (
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">
                              User Role
                            </label>
                            <input
                              required
                              value={form.userRole}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, userRole: e.target.value }))
                              }
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                              placeholder="e.g. Admin / Editor / Owner"
                            />
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">
                                API Key
                              </label>
                              <input
                                required
                                value={form.apiKey}
                                onChange={(e) =>
                                  setForm((p) => ({ ...p, apiKey: e.target.value }))
                                }
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50 font-mono"
                                placeholder="key..."
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">
                                API Secret
                              </label>
                              <input
                                required
                                value={form.apiSecret}
                                onChange={(e) =>
                                  setForm((p) => ({ ...p, apiSecret: e.target.value }))
                                }
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50 font-mono"
                                placeholder="secret..."
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-2 ml-1 uppercase">
                            Shared with users (optional)
                          </label>
                          <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                            {userOptions.length === 0 ? (
                              <p className="text-sm text-gray-500">No users found</p>
                            ) : (
                              userOptions.map((u) => (
                                <label key={u.id} className="flex items-center gap-3 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={form.sharedWithUsers.includes(u.id)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setForm((p) => ({
                                        ...p,
                                        sharedWithUsers: checked
                                          ? Array.from(new Set([...p.sharedWithUsers, u.id]))
                                          : p.sharedWithUsers.filter((x) => x !== u.id),
                                      }));
                                    }}
                                    className="h-4 w-4 rounded border-white/20 bg-transparent text-orange-500 focus:ring-orange-500/50"
                                  />
                                  <span className="text-gray-200">{u.label}</span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                          <button
                            type="button"
                            onClick={() => {
                              setShowModal(false);
                              setEditingId(null);
                              resetForm();
                            }}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                          >
                            {editingId ? "Save changes" : "Save"}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </AdminGuard>
  );
}

