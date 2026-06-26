"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/auth-shell";
import { PageHeader } from "@/components/page-header";

type StaffMember = {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
};

export default function StaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "scanner">("scanner");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  function loadStaff() {
    fetch("/api/brands/staff")
      .then(async (r) => {
        if (r.status === 403) {
          setForbidden(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data?.staff) setStaff(data.staff);
      });
  }

  useEffect(() => {
    loadStaff();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setInviteUrl("");
    setLoading(true);

    try {
      const res = await fetch("/api/brands/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invite failed");
        return;
      }

      setMessage(data.message);
      setInviteUrl(data.invite_url);
      setEmail("");
      loadStaff();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (forbidden) {
    return (
      <div>
        <PageHeader eyebrow="Settings" title="Team" />
        <div className="mt-4">
          <Alert type="info">
            Team management is available to admins only.{" "}
            <button
              type="button"
              className="font-medium text-teal underline"
              onClick={() => router.push("/dashboard")}
            >
              Back to dashboard
            </button>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Settings"
        title="Team"
        description="Invite staff to scan QR codes and view dashboard metrics."
      />

      {error && (
        <div className="mt-4">
          <Alert type="error">{error}</Alert>
        </div>
      )}
      {message && (
        <div className="mt-4">
          <Alert type="success">{message}</Alert>
        </div>
      )}
      {inviteUrl && (
        <div className="mt-4">
          <Alert type="info">
            <span className="font-medium">Invite link (dev):</span>
            <br />
            <a href={inviteUrl} className="break-all text-teal underline">
              {inviteUrl}
            </a>
          </Alert>
        </div>
      )}

      <form onSubmit={handleInvite} className="card mt-6">
        <h2 className="font-display text-lg font-semibold text-ink">Invite team member</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="invite_email">
              Email
            </label>
            <input
              id="invite_email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="invite_role">
              Role
            </label>
            <select
              id="invite_role"
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "scanner")}
            >
              <option value="scanner">Scanner — scan QR + view dashboard</option>
              <option value="admin">Admin — full access</option>
            </select>
          </div>
        </div>
        <button type="submit" className="btn-primary mt-4" disabled={loading}>
          {loading ? "Sending…" : "Send invite"}
        </button>
      </form>

      <div className="card mt-6 overflow-x-auto">
        <h2 className="font-display text-lg font-semibold text-ink">Team members</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-border text-ink-muted">
              <th className="pb-2 pr-4 font-medium">Email</th>
              <th className="pb-2 pr-4 font-medium">Role</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id} className="border-b border-surface-border/60">
                <td className="py-3 pr-4 text-ink">{member.email}</td>
                <td className="py-3 pr-4 capitalize text-ink">{member.role}</td>
                <td className="py-3 pr-4">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      member.status === "active"
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {member.status}
                  </span>
                </td>
                <td className="py-3 text-ink-muted">
                  {member.accepted_at
                    ? new Date(member.accepted_at).toLocaleDateString()
                    : "Pending"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
