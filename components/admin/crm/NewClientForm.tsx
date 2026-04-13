"use client";

import { useState } from "react";
import type { NewPortalClientInput } from "@/lib/admin/crm/types";

const inp =
  "mt-1 w-full rounded-lg border border-slate-600/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/40";

const empty: NewPortalClientInput = {
  contact_name: "",
  company_name: "",
  email: "",
  phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  zip: "",
  industry: "",
};

type Phase = "idle" | "submitting" | "success" | "error";

type CreateClientApiOk = {
  ok: true;
  inviteEmailSent: boolean;
  inviteStatus: string;
  inviteError: string | null;
};

export function NewClientForm() {
  const [form, setForm] = useState<NewPortalClientInput>(empty);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [caution, setCaution] = useState<string | null>(null);

  function patch<K extends keyof NewPortalClientInput>(key: K, value: NewPortalClientInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setMessage(null);
    setCaution(null);
    setPhase("submitting");
    try {
      const res = await fetch("/api/admin/crm/portal-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        if (json.fieldErrors && typeof json.fieldErrors === "object") {
          setFieldErrors(json.fieldErrors as Record<string, string>);
        }
        setMessage(
          typeof json.error === "string" && json.error.trim()
            ? json.error
            : "Request failed. Check server logs if the message above is empty."
        );
        setPhase("error");
        return;
      }

      const okBody = json as CreateClientApiOk;
      setPhase("success");
      setForm(empty);

      setMessage(
        "Portal registration, organization, and auth user were created successfully."
      );

      if (okBody.inviteEmailSent) {
        setCaution(
          "Welcome email was sent. The client should use Forgot password on first login to set a password."
        );
      } else {
        setCaution(
          okBody.inviteError?.trim()
            ? `Welcome email was not sent (${okBody.inviteStatus}). ${okBody.inviteError}`
            : `Welcome email was not sent (status: ${okBody.inviteStatus}). You can fix configuration and contact the client manually.`
        );
      }
    } catch {
      setMessage("Network error. Try again.");
      setPhase("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-300">
          Contact name
          <input className={inp} value={form.contact_name} onChange={(e) => patch("contact_name", e.target.value)} />
          {fieldErrors.contact_name ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.contact_name}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Company name
          <input className={inp} value={form.company_name} onChange={(e) => patch("company_name", e.target.value)} />
          {fieldErrors.company_name ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.company_name}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Email
          <input className={inp} type="email" autoComplete="off" value={form.email} onChange={(e) => patch("email", e.target.value)} />
          {fieldErrors.email ? <p className="mt-1 text-xs text-rose-400">{fieldErrors.email}</p> : null}
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Phone
          <input className={inp} value={form.phone} onChange={(e) => patch("phone", e.target.value)} />
          {fieldErrors.phone ? <p className="mt-1 text-xs text-rose-400">{fieldErrors.phone}</p> : null}
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          Address line 1
          <input className={inp} value={form.address_line_1} onChange={(e) => patch("address_line_1", e.target.value)} />
          {fieldErrors.address_line_1 ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.address_line_1}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          Address line 2 (optional)
          <input className={inp} value={form.address_line_2} onChange={(e) => patch("address_line_2", e.target.value)} />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          City
          <input className={inp} value={form.city} onChange={(e) => patch("city", e.target.value)} />
          {fieldErrors.city ? <p className="mt-1 text-xs text-rose-400">{fieldErrors.city}</p> : null}
        </label>
        <label className="block text-xs font-medium text-slate-300">
          State
          <input className={inp} value={form.state} onChange={(e) => patch("state", e.target.value)} />
          {fieldErrors.state ? <p className="mt-1 text-xs text-rose-400">{fieldErrors.state}</p> : null}
        </label>
        <label className="block text-xs font-medium text-slate-300">
          ZIP
          <input className={inp} inputMode="numeric" maxLength={5} value={form.zip} onChange={(e) => patch("zip", e.target.value)} />
          {fieldErrors.zip ? <p className="mt-1 text-xs text-rose-400">{fieldErrors.zip}</p> : null}
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Industry
          <input className={inp} value={form.industry} onChange={(e) => patch("industry", e.target.value)} />
          {fieldErrors.industry ? <p className="mt-1 text-xs text-rose-400">{fieldErrors.industry}</p> : null}
        </label>
      </div>

      {message ? (
        <p
          className={`text-sm ${phase === "success" ? "text-emerald-300/90" : "text-rose-300/90"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      {caution && phase === "success" ? (
        <p
          className={`text-sm ${caution.includes("not sent") ? "text-amber-200/90" : "text-slate-300/90"}`}
          role="status"
        >
          {caution}
        </p>
      ) : null}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={phase === "submitting"}
          className="rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/25 disabled:opacity-50"
        >
          {phase === "submitting" ? "Creating…" : "Create client & send invite"}
        </button>
      </div>
    </form>
  );
}
