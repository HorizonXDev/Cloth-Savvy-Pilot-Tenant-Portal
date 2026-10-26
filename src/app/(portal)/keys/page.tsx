"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, portalFetch } from "@/lib/api";
import type { PortalKey, PortalKeyIssued, PortalKeyList } from "@/lib/types";
import { Badge, Button, Card, Notice, PageTitle, TableWrap } from "@/components/ui";
import Modal from "@/components/modal";

/** API keys: issue, revoke, and ROTATE — a guided two-step that mints a
 *  replacement first and only revokes the old key once the new plaintext is
 *  on screen, so nobody locks their own integration out mid-deploy. */
export default function KeysPage() {
    const [keys, setKeys] = useState<PortalKey[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [issued, setIssued] = useState<(PortalKeyIssued & { replacing?: string }) | null>(null);
    const [busy, setBusy] = useState(false);
    const [environment, setEnvironment] = useState<"sandbox" | "live">("sandbox");
    const [label, setLabel] = useState("");
    const [revoking, setRevoking] = useState<PortalKey | null>(null);

    const load = useCallback(() => {
        portalFetch<PortalKeyList>("/tenant_keys")
            .then((d) => {
                setKeys(d.keys);
                setError(null);
            })
            .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    }, []);

    useEffect(load, [load]);

    async function issue(
        env: "sandbox" | "live",
        keyLabel: string,
        replacing?: string,
    ) {
        setBusy(true);
        setError(null);
        try {
            const res = await portalFetch<PortalKeyIssued>("/tenant_keys", {
                method: "POST",
                body: { environment: env, ...(keyLabel ? { label: keyLabel } : {}) },
            });
            setIssued({ ...res, replacing });
            setLabel("");
            load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    }

    function submitIssue(e: React.FormEvent) {
        e.preventDefault();
        void issue(environment, label.trim());
    }

    async function revoke(keyId: string) {
        setBusy(true);
        setError(null);
        try {
            await portalFetch("/tenant_keys", {
                method: "PATCH",
                body: { key_id: keyId },
            });
            setRevoking(null);
            load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    }

    function rotate(k: PortalKey) {
        void issue(k.environment, k.label ?? "", k.id);
    }

    return (
        <div className="grid gap-6">
            <PageTitle eyebrow="credentials" title="API keys" />

            {error && <Notice tone="error">{error}</Notice>}

            {/* Show-once panel — the plaintext lives only in this component's state. */}
            {issued && (
                <div className="card card-pad border-gold/50">
                    <p className="mb-2 text-sm font-medium text-gold">
                        New key created — copy it now, it is shown once
                    </p>
                    <code className="mono block break-all rounded-lg bg-sunken p-3 text-sm">
                        {issued.plaintext}
                    </code>
                    <p className="mt-2 text-xs text-muted">{issued.warning}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                                navigator.clipboard?.writeText(issued.plaintext).catch(() => {});
                            }}
                        >
                            Copy to clipboard
                        </Button>
                        {issued.replacing && (
                            <Button
                                size="sm"
                                variant="danger"
                                busy={busy}
                                onClick={() => revoke(issued.replacing!)}
                            >
                                Step 2 — revoke the old key
                            </Button>
                        )}
                        <Button size="sm" onClick={() => setIssued(null)}>
                            {issued.replacing ? "Done" : "I saved it — dismiss"}
                        </Button>
                    </div>
                    {issued.replacing && (
                        <p className="mt-2 text-xs text-muted">
                            Until you revoke the old key both keys work — deploy the new one first,
                            then come back here.
                        </p>
                    )}
                </div>
            )}

            <Card title="Create a key">
                <form onSubmit={submitIssue} className="flex flex-wrap items-end gap-3">
                    <label className="block">
                        <span className="label">Environment</span>
                        <select
                            value={environment}
                            onChange={(e) => setEnvironment(e.target.value as "sandbox" | "live")}
                            className="input w-auto"
                        >
                            <option value="sandbox">sandbox (sk_test_)</option>
                            <option value="live">live (sk_live_)</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="label">Label</span>
                        <input
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="storefront, mobile app…"
                            maxLength={100}
                            className="input w-56"
                        />
                    </label>
                    <Button type="submit" variant="primary" busy={busy}>
                        Create key
                    </Button>
                </form>
            </Card>

            <TableWrap>
                <thead>
                    <tr>
                        <th>Prefix</th>
                        <th>Env</th>
                        <th>Label</th>
                        <th>Last used</th>
                        <th>Status</th>
                        <th />
                    </tr>
                </thead>
                <tbody>
                    {keys.length === 0 && (
                        <tr>
                            <td colSpan={6} className="text-muted">
                                no keys yet — create one above
                            </td>
                        </tr>
                    )}
                    {keys.map((k) => (
                        <tr key={k.id}>
                            <td className="mono">{k.key_prefix}…</td>
                            <td>{k.environment}</td>
                            <td className="text-muted">{k.label ?? "—"}</td>
                            <td className="text-muted">
                                {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                            </td>
                            <td>
                                <Badge tone={k.revoked_at ? "danger" : "ok"}>
                                    {k.revoked_at ? "revoked" : "active"}
                                </Badge>
                            </td>
                            <td className="whitespace-nowrap text-right">
                                {!k.revoked_at && (
                                    <>
                                        <Button size="sm" onClick={() => rotate(k)}>
                                            Rotate
                                        </Button>{" "}
                                        <Button size="sm" variant="danger" onClick={() => setRevoking(k)}>
                                            Revoke
                                        </Button>
                                    </>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </TableWrap>

            {revoking && (
                <Modal title="Revoke this key?" onClose={() => setRevoking(null)}>
                    <div className="grid gap-4">
                        <p className="text-sm text-muted">
                            <span className="mono">{revoking.key_prefix}…</span>{" "}
                            {revoking.label ? `(${revoking.label})` : ""} stops working immediately —
                            every request signed with it will get 401. Usage already recorded against
                            it stays in your billing.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="danger" busy={busy} onClick={() => revoke(revoking.id)}>
                                Revoke now
                            </Button>
                            <Button onClick={() => setRevoking(null)} disabled={busy}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
