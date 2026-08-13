"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Lead = {
  id: string;
  company_name: string;
  email: string;
  message: string | null;
  status: string;
  created_at: string;
};

function AdminLeadsInner() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fromUrl = searchParams.get("token");
    const stored =
      typeof window !== "undefined" ? sessionStorage.getItem("leads_admin_token") : null;
    const t = fromUrl || stored || "";
    if (fromUrl) sessionStorage.setItem("leads_admin_token", fromUrl);
    setToken(t || null);
    setAuthReady(true);
  }, [searchParams]);

  function leadsUrl() {
    if (!token) return "/api/admin/leads";
    return `/api/admin/leads?token=${encodeURIComponent(token)}`;
  }

  function loadLeads() {
    if (!authReady) return;
    setLoading(true);
    setError("");
    fetch(leadsUrl(), { credentials: "include" })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (r.status === 401) {
          window.location.assign(`/login?next=${encodeURIComponent("/admin/leads")}`);
          return;
        }
        if (!r.ok || json.error) {
          setError(json.error || "Failed to load leads");
          return;
        }
        setLeads(json.leads || []);
      })
      .catch(() => setError("Failed to load leads"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, token]);

  async function updateStatus(id: string, status: string) {
    const res = await fetch(leadsUrl(), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const json = await res.json();
    if (json.lead) {
      setLeads((prev) => prev.map((l) => (l.id === id ? json.lead : l)));
    }
  }

  return (
    <div className="portal-main">
      <p className="font-display text-xs font-extrabold uppercase tracking-wide text-teal">Admin</p>
      <h1 className="font-display text-3xl font-extrabold text-ink">Partnership leads</h1>
      <p className="mt-1 font-medium text-ink-light">{leads.length} lead(s)</p>

      {error && (
        <div className="alert-error mt-4">
          {error}
          <button type="button" className="ml-3 underline" onClick={loadLeads}>
            Retry
          </button>
        </div>
      )}

      <div className="table-shell mt-6">
        {loading ? (
          <p className="p-6 text-sm font-medium text-ink-light">Loading…</p>
        ) : leads.length === 0 ? (
          <p className="p-8 text-center text-sm font-medium text-ink-light">No leads yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 font-display font-extrabold">Company</th>
                <th className="px-4 py-3 font-display font-extrabold">Email</th>
                <th className="px-4 py-3 font-display font-extrabold">Message</th>
                <th className="px-4 py-3 font-display font-extrabold">Status</th>
                <th className="px-4 py-3 font-display font-extrabold">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-4 py-3 font-display font-extrabold text-ink">
                    {lead.company_name}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink-light">{lead.email}</td>
                  <td className="max-w-xs px-4 py-3 font-medium text-ink-light">
                    {lead.message || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="input py-2 text-xs"
                      value={lead.status}
                      onChange={(e) => updateStatus(lead.id, e.target.value)}
                    >
                      <option value="new">new</option>
                      <option value="contacted">contacted</option>
                      <option value="signed_up">signed_up</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink-light">
                    {new Date(lead.created_at).toLocaleString()}
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

export default function AdminLeadsPage() {
  return (
    <Suspense fallback={<p className="portal-main text-sm font-medium text-ink-light">Loading…</p>}>
      <AdminLeadsInner />
    </Suspense>
  );
}
