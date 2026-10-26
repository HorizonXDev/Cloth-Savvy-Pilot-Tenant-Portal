"use client";

import { useEffect, useState } from "react";
import { ApiError, portalFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { PortalAccount } from "@/lib/types";
import { Badge, Button, Card, Notice, PageTitle } from "@/components/ui";

/** Read-only plan configuration (owned by the account manager) + the one
 *  thing a tenant can change themselves: their own password. */
export default function SettingsPage() {
    const [account, setAccount] = useState<PortalAccount | null>(null);
    const [error, setError] = useState<string | null>(null);

    // password change goes straight to GoTrue — the function layer has no
    // user session to modify (see tenant_account's header).
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
        setPwMsg("password updated — other sessions keep working until they expire");
    }

    const settings = account?.settings;

    return (
        <div className="grid max-w-4xl gap-6">
            <PageTitle eyebrow="account" title="Settings" />

            {error && <Notice tone="error">{error}</Notice>}

            {account && (
                <Card title="Account">
                    <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                        <Row label="Brand" value={account.tenant.name} />
                        <Row label="Tenant slug" value={<span className="mono">{account.tenant.slug}</span>} />
                        <Row label="Signed in as" value={account.user.email} />
                        <Row
                            label="Status"
                            value={
                                <Badge tone={account.tenant.status === "active" ? "ok" : "danger"}>
                                    {account.tenant.status}
                                </Badge>
                            }
                        />
                        <Row label="Embedding model" value={<span className="mono">{account.embedding_model}</span>} />
                    </dl>
                </Card>
            )}

            <Card
                title="Plan configuration"
                actions={<Badge tone="plain">read-only</Badge>}
            >
                <p className="mb-4 text-xs text-muted">
                    Managed by your Cloth Savvy account manager — these values control how the API
                    behaves for your keys.
                </p>
                {settings && (
                    <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                        <Row label="Currency" value={settings.currency ?? "not set"} />
                        <Row label="Min similarity" value={settings.min_similarity} />
                        <Row label="Default result limit" value={settings.default_limit} />
                        <Row label="Rate limit" value={`${settings.rate_limit_per_min}/min per key`} />
                    </dl>
                )}
            </Card>

            <Card title="Combo recipes">
                <p className="mb-4 text-xs text-muted">
                    Occasions your keys can request from{" "}
                    <code className="mono">POST /combos</code>. The API owns this list — a typo
                    comes back as 422 with the valid names.
                </p>
                {settings && Object.keys(settings.combos).length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {Object.entries(settings.combos).map(([occasion, sections]) => (
                            <div key={occasion} className="rounded-xl border border-line bg-sunken/60 p-3">
                                <p className="display text-lg">{occasion}</p>
                                <p className="mono mt-1 text-xs text-muted">{sections.join(" → ")}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted">
                        no custom recipes — the API uses its demo defaults
                    </p>
                )}
            </Card>

            <Card title="Change your password">
                <form onSubmit={changePassword} className="flex flex-wrap items-end gap-3">
                    <label className="block">
                        <span className="label">New password</span>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="min 8 characters"
                            autoComplete="new-password"
                            className="input w-72"
                        />
                    </label>
                    <Button type="submit" variant="primary" busy={pwBusy}>
                        Update password
                    </Button>
                    {pwMsg && <span className="text-xs text-ok">{pwMsg}</span>}
                </form>
                {pwErr && (
                    <div className="mt-3">
                        <Notice tone="error">{pwErr}</Notice>
                    </div>
                )}
            </Card>
        </div>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 border-b border-line/60 py-1.5">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
        </div>
    );
}
