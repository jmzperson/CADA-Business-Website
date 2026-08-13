"use client";

import { useEffect, useState } from "react";

type AdminRow = {
  email: string;
  auth_user_id: string | null;
  granted_by: string | null;
  granted_at: string | null;
  disabled: boolean;
  source: "roster" | "env";
  status: "active" | "revoked";
};

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError("");
    fetch("/api/admin/users", { credentials: "include" })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (r.status === 401) {
          window.location.assign(`/login?next=${encodeURIComponent("/admin/users")}`);
          return;
        }
        if (!r.ok || json.error) {
          setError(json.error || "Failed to load admins");
          return;
        }
        setAdmins((json.admins || []) as AdminRow[]);
      })
      .catch(() => setError("Failed to load admins"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Failed to add admin");
        return;
      }
      setEmail("");
      setMessage(json.message || "Admin added.");
      load();
    } catch {
      setError("Failed to add admin");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(target: string) {
    setRevoking(target);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Failed to revoke admin");
        return;
      }
      setMessage(json.message || "Admin access revoked.");
      load();
    } catch {
      setError("Failed to revoke admin");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="portal-main">
      <p className="font-display text-xs font-extrabold uppercase tracking-wide text-teal">Admin</p>
      <h1 className="font-display text-3xl font-extrabold text-ink">CADA admins</h1>
      <p className="mt-1 font-medium text-ink-light">
        These accounts can approve or reject partner challenges before they go live in the app.
      </p>

      {error && (
        <div className="alert-error mt-4">
          {error}
          <button type="button" className="ml-3 underline" onClick={load}>
            Retry
          </button>
        </div>
      )}
      {message && <div className="alert-success mt-4">{message}</div>}

      <form onSubmit={addAdmin} className="card mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="admin-email">
            Add admin by email
          </label>
          <input
            id="admin-email"
            type="email"
            className="input"
            placeholder="name@cadaapp.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary sm:mb-0" disabled={busy}>
          {busy ? "Adding…" : "Grant admin"}
        </button>
      </form>

      <div className="table-shell mt-6 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm font-medium text-ink-light">Loading…</p>
        ) : admins.length === 0 ? (
          <p className="p-8 text-center text-sm font-medium text-ink-light">
            No admins yet. Add an email above.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 font-display font-extrabold">Email</th>
                <th className="px-4 py-3 font-display font-extrabold">Status</th>
                <th className="px-4 py-3 font-display font-extrabold">Granted</th>
                <th className="px-4 py-3 font-display font-extrabold">By</th>
                <th className="px-4 py-3 font-display font-extrabold" />
              </tr>
            </thead>
            <tbody>
              {admins.map((row) => (
                <tr key={row.email} className="border-t border-border">
                  <td className="px-4 py-3 font-display font-extrabold text-ink">{row.email}</td>
                  <td className="px-4 py-3 font-medium text-ink-light">
                    {row.status === "active" ? "Active" : "Revoked"}
                    {row.source === "env" ? " · env allowlist" : ""}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink-light">
                    {formatWhen(row.granted_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink-light">{row.granted_by || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {row.status === "active" ? (
                      <button
                        type="button"
                        className="text-xs font-display font-extrabold text-ink-light hover:text-teal"
                        disabled={revoking === row.email}
                        onClick={() => revoke(row.email)}
                      >
                        {revoking === row.email ? "Revoking…" : "Revoke"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
