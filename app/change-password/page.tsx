"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (newPassword.length < 12) {
      setError("New password must contain at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setError(payload.message ?? "Unable to update password.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="change-password-title">
        <div className="auth-brand">
          <span className="auth-brand-mark">PHM</span>
          <div><strong>PHM / INTELLIGENCE</strong><small>ASSET INTEGRITY PLATFORM</small></div>
        </div>
        <div className="auth-heading">
          <span className="auth-eyebrow">ACCOUNT SECURITY</span>
          <h1 id="change-password-title">Create a new password</h1>
          <p>Your temporary password must be replaced before you can continue.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="current-password">Current / temporary password</label>
          <input id="current-password" type="password" autoComplete="current-password" required maxLength={72}
            value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={72}
            value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <label htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={72}
            value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          <p className="auth-hint">Use at least 12 characters. Passwords are stored as bcrypt hashes.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>
    </main>
  );
}
