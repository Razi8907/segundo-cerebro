"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "../components/ThemeToggle";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  can_download: boolean;
  active: boolean;
  access_start_hour: number;
  access_end_hour: number;
  access_comercial: boolean;
  access_operaciones: boolean;
  access_finanzas: boolean;
  created_at: string;
}

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "viewer",
  can_download: false,
  access_start_hour: 0,
  access_end_hour: 24,
  access_comercial: true,
  access_operaciones: true,
  access_finanzas: true,
};

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<User & { password?: string }>>({});

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!res.ok || data.user?.role !== "admin") {
        router.push("/login");
        return;
      }
      fetchUsers();
    } catch {
      router.push("/login");
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setUsers((prev) => [...prev, data.user]);
      setForm(emptyForm);
      setSuccess("Usuario creado exitosamente");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Error al crear usuario");
    }
  }

  async function handleToggle(id: string, field: "active" | "can_download" | "access_comercial" | "access_operaciones" | "access_finanzas", value: boolean) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: !value }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, [field]: !value } : u))
        );
      }
    } catch {
      setError("Error al actualizar");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar al usuario "${name}"? Esta acción no se puede deshacer.`)) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        setSuccess("Usuario eliminado");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Error al eliminar usuario");
    }
  }

  function startEdit(user: User) {
    setEditingId(user.id);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      access_start_hour: user.access_start_hour,
      access_end_hour: user.access_end_hour,
      password: "",
    });
  }

  async function handleEditSave(id: string) {
    setError("");
    const updates: Record<string, unknown> = { id };
    if (editForm.name) updates.name = editForm.name;
    if (editForm.email) updates.email = editForm.email;
    if (editForm.role) updates.role = editForm.role;
    if (editForm.password) updates.password = editForm.password;
    if (editForm.access_start_hour !== undefined) updates.access_start_hour = editForm.access_start_hour;
    if (editForm.access_end_hour !== undefined) updates.access_end_hour = editForm.access_end_hour;

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === id ? data.user : u)));
        setEditingId(null);
        setSuccess("Usuario actualizado");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Error al actualizar");
    }
  }

  const hours = Array.from({ length: 25 }, (_, i) => i);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-page)" }}
      >
        <p style={{ color: "var(--text-secondary)" }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between"
        style={{
          background: "var(--bg-header)",
          borderBottom: "1px solid var(--border-header)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="text-sm px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
            style={{
              color: "var(--text-secondary)",
              border: "1px solid var(--bg-card-border)",
            }}
          >
            ← Dashboard
          </a>
          <h1 className="text-lg font-bold gradient-text">
            Admin - Usuarios
          </h1>
        </div>
        <ThemeToggle />
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Messages */}
        {error && (
          <div
            className="p-3 rounded-lg text-sm text-red-400 border border-red-500/30"
            style={{ background: "rgba(239, 68, 68, 0.1)" }}
          >
            {error}
            <button onClick={() => setError("")} className="ml-2 underline">
              cerrar
            </button>
          </div>
        )}
        {success && (
          <div
            className="p-3 rounded-lg text-sm text-green-400 border border-green-500/30"
            style={{ background: "rgba(34, 197, 94, 0.1)" }}
          >
            {success}
          </div>
        )}

        {/* Create User Form */}
        <div className="glass-card p-6">
          <h2
            className="text-base font-semibold mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            Agregar Usuario
          </h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--bg-input-border)",
                color: "var(--text-primary)",
              }}
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--bg-input-border)",
                color: "var(--text-primary)",
              }}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--bg-input-border)",
                color: "var(--text-primary)",
              }}
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--bg-input-border)",
                color: "var(--text-primary)",
              }}
            >
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>

            <div className="flex items-center gap-2">
              <label className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Puede descargar:
              </label>
              <button
                type="button"
                onClick={() => setForm({ ...form, can_download: !form.can_download })}
                className="w-10 h-5 rounded-full transition-colors relative"
                style={{
                  background: form.can_download ? "#F97316" : "var(--bg-input)",
                  border: "1px solid var(--bg-input-border)",
                }}
              >
                <span
                  className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform"
                  style={{
                    left: form.can_download ? "calc(100% - 18px)" : "2px",
                  }}
                />
              </button>
            </div>

            {/* Sector permissions */}
            <div className="flex flex-wrap gap-4">
              {([
                { key: "access_comercial", label: "📊 Comercial" },
                { key: "access_operaciones", label: "🏭 Operaciones" },
                { key: "access_finanzas", label: "💰 Finanzas" },
              ] as const).map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <label className="text-sm" style={{ color: "var(--text-secondary)" }}>{s.label}:</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, [s.key]: !(form as any)[s.key] })}
                    className="w-10 h-5 rounded-full transition-colors relative"
                    style={{
                      background: (form as any)[s.key] ? "#16a34a" : "var(--bg-input)",
                      border: "1px solid var(--bg-input-border)",
                    }}
                  >
                    <span
                      className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform"
                      style={{ left: (form as any)[s.key] ? "calc(100% - 18px)" : "2px" }}
                    />
                  </button>
                </div>
              ))}
            </div>

            <select
              value={form.access_start_hour}
              onChange={(e) => setForm({ ...form, access_start_hour: Number(e.target.value) })}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--bg-input-border)",
                color: "var(--text-primary)",
              }}
            >
              {hours.slice(0, 24).map((h) => (
                <option key={h} value={h}>
                  Desde: {h}:00
                </option>
              ))}
            </select>

            <select
              value={form.access_end_hour}
              onChange={(e) => setForm({ ...form, access_end_hour: Number(e.target.value) })}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--bg-input-border)",
                color: "var(--text-primary)",
              }}
            >
              {hours.map((h) => (
                <option key={h} value={h}>
                  Hasta: {h === 24 ? "24 (todo el día)" : `${h}:00`}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white dropi-gradient hover:opacity-90 transition-opacity cursor-pointer"
            >
              Crear Usuario
            </button>
          </form>
        </div>

        {/* Users Table */}
        <div className="glass-card p-6">
          <h2
            className="text-base font-semibold mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            Usuarios ({users.length})
          </h2>
          <div className="table-container overflow-x-auto">
            <table className="w-full text-sm">
              <thead
                style={{
                  background: "var(--bg-table-header)",
                }}
              >
                <tr
                  style={{
                    borderBottom: "1px solid var(--bg-card-border)",
                  }}
                >
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>Nombre</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>Email</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>Rol</th>
                  <th className="text-center px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>Descarga</th>
                  <th className="text-center px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>Comercial</th>
                  <th className="text-center px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>Operaciones</th>
                  <th className="text-center px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>Finanzas</th>
                  <th className="text-center px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>Horario</th>
                  <th className="text-center px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>Activo</th>
                  <th className="text-right px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: "1px solid var(--border-section)",
                    }}
                  >
                    {editingId === user.id ? (
                      <>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editForm.name || ""}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="px-2 py-1 rounded text-sm w-full"
                            style={{
                              background: "var(--bg-input)",
                              border: "1px solid var(--bg-input-border)",
                              color: "var(--text-primary)",
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="email"
                            value={editForm.email || ""}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            className="px-2 py-1 rounded text-sm w-full"
                            style={{
                              background: "var(--bg-input)",
                              border: "1px solid var(--bg-input-border)",
                              color: "var(--text-primary)",
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editForm.role || "viewer"}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                            className="px-2 py-1 rounded text-sm"
                            style={{
                              background: "var(--bg-input)",
                              border: "1px solid var(--bg-input-border)",
                              color: "var(--text-primary)",
                            }}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center" style={{ color: "var(--text-secondary)" }}>
                          -
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-center">
                            <select
                              value={editForm.access_start_hour ?? 0}
                              onChange={(e) => setEditForm({ ...editForm, access_start_hour: Number(e.target.value) })}
                              className="px-1 py-1 rounded text-xs"
                              style={{
                                background: "var(--bg-input)",
                                border: "1px solid var(--bg-input-border)",
                                color: "var(--text-primary)",
                              }}
                            >
                              {hours.slice(0, 24).map((h) => (
                                <option key={h} value={h}>{h}:00</option>
                              ))}
                            </select>
                            <span style={{ color: "var(--text-muted)" }}>-</span>
                            <select
                              value={editForm.access_end_hour ?? 24}
                              onChange={(e) => setEditForm({ ...editForm, access_end_hour: Number(e.target.value) })}
                              className="px-1 py-1 rounded text-xs"
                              style={{
                                background: "var(--bg-input)",
                                border: "1px solid var(--bg-input-border)",
                                color: "var(--text-primary)",
                              }}
                            >
                              {hours.map((h) => (
                                <option key={h} value={h}>{h === 24 ? "24" : `${h}:00`}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center" style={{ color: "var(--text-secondary)" }}>
                          -
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <input
                              type="password"
                              placeholder="Nueva pass"
                              value={editForm.password || ""}
                              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                              className="px-2 py-1 rounded text-xs w-24"
                              style={{
                                background: "var(--bg-input)",
                                border: "1px solid var(--bg-input-border)",
                                color: "var(--text-primary)",
                              }}
                            />
                            <button
                              onClick={() => handleEditSave(user.id)}
                              className="px-2 py-1 rounded text-xs font-semibold text-white dropi-gradient hover:opacity-90 cursor-pointer"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 rounded text-xs cursor-pointer"
                              style={{
                                color: "var(--text-secondary)",
                                border: "1px solid var(--bg-card-border)",
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                          {user.name}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                          {user.email}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              background:
                                user.role === "admin"
                                  ? "rgba(249, 115, 22, 0.15)"
                                  : "rgba(100, 116, 139, 0.15)",
                              color:
                                user.role === "admin" ? "#F97316" : "var(--text-secondary)",
                            }}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggle(user.id, "can_download", user.can_download)}
                            className="w-9 h-5 rounded-full transition-colors relative cursor-pointer"
                            style={{
                              background: user.can_download ? "#F97316" : "var(--bg-input)",
                              border: "1px solid var(--bg-input-border)",
                            }}
                          >
                            <span
                              className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all"
                              style={{
                                left: user.can_download ? "calc(100% - 18px)" : "2px",
                              }}
                            />
                          </button>
                        </td>
                        {(["access_comercial", "access_operaciones", "access_finanzas"] as const).map((field) => (
                          <td key={field} className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggle(user.id, field as any, (user as any)[field])}
                              className="w-9 h-5 rounded-full transition-colors relative cursor-pointer"
                              style={{
                                background: (user as any)[field] ? "#16a34a" : "var(--bg-input)",
                                border: "1px solid var(--bg-input-border)",
                              }}
                            >
                              <span
                                className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all"
                                style={{ left: (user as any)[field] ? "calc(100% - 18px)" : "2px" }}
                              />
                            </button>
                          </td>
                        ))}
                        <td
                          className="px-4 py-3 text-center text-xs"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {user.access_start_hour}:00 - {user.access_end_hour}:00
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggle(user.id, "active", user.active)}
                            className="w-9 h-5 rounded-full transition-colors relative cursor-pointer"
                            style={{
                              background: user.active ? "#22c55e" : "var(--bg-input)",
                              border: "1px solid var(--bg-input-border)",
                            }}
                          >
                            <span
                              className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all"
                              style={{
                                left: user.active ? "calc(100% - 18px)" : "2px",
                              }}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => startEdit(user)}
                              className="px-2 py-1 rounded text-xs cursor-pointer transition-colors"
                              style={{
                                color: "#F97316",
                                border: "1px solid rgba(249, 115, 22, 0.3)",
                              }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(user.id, user.name)}
                              className="px-2 py-1 rounded text-xs cursor-pointer transition-colors"
                              style={{
                                color: "#ef4444",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
