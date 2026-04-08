"use client";

import AdminGuard from "@/components/auth/AdminGuard";
import Sidebar from "@/components/ui/Sidebar";
import Navbar from "@/components/ui/Navbar";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus,
  Trash2,
  Edit2,
  Shield,
  User as UserIcon,
  RefreshCw,
  Download
} from "lucide-react";

// Types
interface User {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  youtubeAccess?: boolean;
  linkedinAccess?: boolean;
  xAccess?: boolean;
  createdAt: string;
}

export default function TeamPage() {
  const { data: session } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
    youtubeAccess: false,
    linkedinAccess: false,
    xAccess: false,
  });
  const [error, setError] = useState("");
  const [lastCreatedUser, setLastCreatedUser] = useState<{ name: string; email: string; password: string; role: string } | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      const url = editingUser ? `/api/admin/users/${editingUser._id}` : "/api/admin/users";
      const method = editingUser ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }
      
      // Store user data for CSV download (only if password was provided)
      if (formData.password) {
        const userData = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role
        };
        setLastCreatedUser(userData);
        // Trigger CSV download
        downloadCredentialsCSV(userData);
        
        // Keep modal open for a moment to show success message, then close
        setTimeout(() => {
          setShowModal(false);
          setEditingUser(null);
          setFormData({ name: "", email: "", password: "", role: "user", youtubeAccess: false, linkedinAccess: false, xAccess: false });
          setLastCreatedUser(null);
          fetchUsers();
        }, 2000);
      } else {
        setShowModal(false);
        setEditingUser(null);
        setFormData({ name: "", email: "", password: "", role: "user", youtubeAccess: false, linkedinAccess: false, xAccess: false });
        setLastCreatedUser(null);
        fetchUsers();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({ 
      name: user.name || "", 
      email: user.email, 
      password: "", 
      role: user.role,
      youtubeAccess: Boolean(user.youtubeAccess),
      linkedinAccess: Boolean(user.linkedinAccess),
      xAccess: Boolean(user.xAccess),
    });
    setLastCreatedUser(null);
    setShowModal(true);
  };

  const generateRandomPassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData({ ...formData, password });
  };

  const downloadCredentialsCSV = (userData: { name: string; email: string; password: string; role: string }) => {
    // Create CSV content
    const headers = ["Name", "Email", "Password", "Role"];
    const row = [
      userData.name || "",
      userData.email,
      userData.password,
      userData.role === "admin" ? "Admin" : "Member"
    ];

    // Escape values that might contain commas or quotes
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.map(escapeCSV).join(","),
      row.map(escapeCSV).join(",")
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `user_credentials_${userData.email.replace("@", "_at_")}_${Date.now()}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ name: "", email: "", password: "", role: "user", youtubeAccess: false, linkedinAccess: false, xAccess: false });
    setLastCreatedUser(null);
    setShowModal(true);
  };

  const isAdmin = (session?.user as any)?.role === "admin";

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#050505] flex">
        {/* Sidebar */}
        <Sidebar 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
          isAdmin={isAdmin}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar setSidebarOpen={setIsSidebarOpen} />

          {/* Team Management Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Team Management</h1>
                  <p className="text-gray-400 mt-1 text-sm sm:text-base">Manage your team members and their roles.</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={openCreateModal}
                  className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-700 text-white rounded-lg hover:from-orange-500 hover:to-amber-600 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                >
                  <Plus size={18} />
                  Add Member
                </motion.button>
              </motion.div>

              <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[600px]">
                    <thead>
                      <tr className="border-b border-white/5 text-gray-400 text-sm">
                        <th className="p-4 pl-6">Name</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Joined</th>
                        <th className="p-4 text-right pr-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-500">Loading users...</td>
                        </tr>
                      ) : users.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-500">No users found</td>
                        </tr>
                      ) : (
                        users.map((user) => (
                          <tr key={user._id} className="hover:bg-white/5 transition-colors group">
                            <td className="p-4 pl-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xs font-bold text-white">
                                  {user.name?.[0] || user.email[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-white font-medium">{user.name || "No Name"}</p>
                                  <p className="text-xs text-gray-500">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                user.role === 'admin' 
                                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              }`}>
                                {user.role === 'admin' ? <Shield size={12} /> : <UserIcon size={12} />}
                                {user.role === 'admin' ? 'Admin' : 'Member'}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
                                Active
                              </span>
                            </td>
                            <td className="p-4 text-sm text-gray-500">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right pr-6">
                              <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => openEditModal(user)}
                                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDelete(user._id)}
                                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
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
                      className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl"
                    >
                      <h3 className="text-xl font-bold text-white mb-4">
                        {editingUser ? "Edit Member" : "Add New Member"}
                      </h3>
                      
                      {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                          {error}
                        </div>
                      )}

                      {lastCreatedUser && (
                        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm flex items-center justify-between">
                          <span>✓ Credentials CSV downloaded successfully!</span>
                          <button
                            type="button"
                            onClick={() => downloadCredentialsCSV(lastCreatedUser)}
                            className="flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors px-2 py-1 hover:bg-green-500/10 rounded"
                            title="Download CSV again"
                          >
                            <Download size={16} />
                            Download Again
                          </button>
                        </div>
                      )}

                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">Full Name</label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">Email Address</label>
                          <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                            placeholder="john@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">
                            {editingUser ? "New Password (Optional)" : "Password"}
                          </label>
                          <div className="relative">
                            <input
                              type="password"
                              required={!editingUser}
                              value={formData.password}
                              onChange={(e) => setFormData({...formData, password: e.target.value})}
                              className="w-full px-4 py-2 pr-12 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                              placeholder="••••••••"
                            />
                            <button
                              type="button"
                              onClick={generateRandomPassword}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-orange-500 hover:bg-white/5 rounded-lg transition-all"
                              title="Generate random password"
                            >
                              <RefreshCw size={18} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">Role</label>
                          <select
                            value={formData.role}
                            onChange={(e) => setFormData({...formData, role: e.target.value})}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                          >
                            <option value="user">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">
                            YouTube Access
                          </label>
                          <label className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white">
                            <input
                              type="checkbox"
                              checked={Boolean(formData.youtubeAccess)}
                              onChange={(e) => setFormData({ ...formData, youtubeAccess: e.target.checked })}
                              className="h-4 w-4 rounded border-white/20 bg-transparent text-orange-500 focus:ring-orange-500/50"
                            />
                            <span className="text-sm text-gray-200">Allow access to YouTube tools</span>
                          </label>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">
                            LinkedIn Access
                          </label>
                          <label className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white">
                            <input
                              type="checkbox"
                              checked={Boolean(formData.linkedinAccess)}
                              onChange={(e) =>
                                setFormData({ ...formData, linkedinAccess: e.target.checked })
                              }
                              className="h-4 w-4 rounded border-white/20 bg-transparent text-orange-500 focus:ring-orange-500/50"
                            />
                            <span className="text-sm text-gray-200">Allow access to LinkedIn tools</span>
                          </label>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1 ml-1 uppercase">
                            X Access
                          </label>
                          <label className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white">
                            <input
                              type="checkbox"
                              checked={Boolean(formData.xAccess)}
                              onChange={(e) => setFormData({ ...formData, xAccess: e.target.checked })}
                              className="h-4 w-4 rounded border-white/20 bg-transparent text-orange-500 focus:ring-orange-500/50"
                            />
                            <span className="text-sm text-gray-200">Allow access to X tools</span>
                          </label>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                          <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                          >
                            {editingUser ? "Save Changes" : "Create Account"}
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

