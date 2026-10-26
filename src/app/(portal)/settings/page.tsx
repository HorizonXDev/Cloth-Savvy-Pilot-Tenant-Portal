"use client";

import { useEffect, useState } from "react";
import { ApiError, portalFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { PortalAccount } from "@/lib/types";

export default function SettingsPage() {
    const [account, setAccount] = useState<PortalAccount | null>(null);
    const [error, setError] = useState<string | null>(null);

    // password change state — handled via GoTrue directly (the function
    // layer has no user session to modify; see tenant_account header)
    const [newPassword, setNewPassword] = useState("");
    const [pwBusy, setPwBusy] = useState(false);
    const [pwMsg, setPwMsg] = useState<string | null>(null);
    const [pwErr, setPwErr] = useState<string | null>(null);

    useEffect(() => {
        portalFetch<PortalAccount>("/tenant_account")
            .then(setAccount)
            .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    }, []);

    async function changePassword(e: React.FormEvent) {
        e.preventDefault();
        if (newPassword.length < 8) {
            setPwErr("password must be at least 8 characters");
            return;
        }
        setPwBusy(true);
        setPwErr(null);
        setPwMsg(null);
        const { error: err } = await supabase().auth.updateUser({ password: newPassword });
        setPwBusy(false);
        if (err) {
            setPwErr(err.message);
            return;
        }
        setNewPassword("");
        setPwMsg("password updated");
    }

    const settings = account?.settings;

    return (
        <div className="grid max-w-4xl gap-5">
            <h1 className="text-xl font-semibold">Settings</h1>

            {error && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <section className="rounded border border-slate-200 bg-white p-4">
                <h2 className="mb-3 font-medium">Your plan configuration</h2>
                <p className="mb-3 text-xs text-slate-500">
                    Read-only: these values are managed by your Cloth Savvy account manager and
                    control how the API behaves for your keys.
                </p>
                {settings && (
                    <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                        <div className="flex justify-between border-b border-slate-100 py-1">
                            <dt className="text-slate-500">Currency</dt>
                            <dd className="font-medium">{settings.currency ?? "—"}</dd>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 py-1">
                            <dt className="text-slate-500">Min similarity</dt>
                            <dd className="font-medium">{settings.min_similarity}</dd>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 py-1">
                            <dt className="text-slate-500">Default result limit</dt>
                            <dd className="font-medium">{settings.default_limit}</dd>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 py-1">
                            <dt className="text-slate-500">Rate limit</dt>
                            <dd className="font-medium">{settings.rate_limit_per_min}/min per key</dd>
                        </div>
                    </dl>
                )}
            </section>

            <section className="rounded border border-slate-200 bg-white p-4">
                <h2 className="mb-3 font-medium">Combo recipes</h2>
                <p className="mb-3 text-xs text-slate-500">
                    Occasions your keys can request from <code className="rounded bg-slate-100 px-1">POST /combos</code>.
                </p>
                {settings && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {Object.entries(settings.combos).map(([occasion, sections]) => (
                            <div key={occasion} className="rounded border border-slate-100 p-3">
                                <p className="text-sm font-medium">{occasion}</p>
                                <p className="mt-1 text-xs text-slate-500">{sections.join(" → ")}</p>
                            </div>
                        ))}
                        {Object.keys(settings.combos).length === 0 && (
                            <p className="text-sm text-slate-400">
                                no custom recipes — the API uses demo defaults
                            </p>
                        )}
                    </div>
                )}
            </section>

            <section className="rounded border border-slate-200 bg-white p-4">
                <h2 className="mb-1 font-medium">Change your password</h2>
                <form onSubmit={changePassword} className="mt-3 flex flex-wrap items-center gap-3">
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password (min 8 chars)"
                        autoComplete="new-password"
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={pwBusy}
                        className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                        {pwBusy ? "Updating…" : "Update password"}
                    </button>
                    {pwMsg && <span className="text-xs text-green-700">{pwMsg}</span>}
                </form>
                {pwErr && (
                    <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {pwErr}
                    </p>
                )}
            </section>
        </div>
    );
}
