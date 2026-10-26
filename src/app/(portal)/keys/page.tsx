"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, portalFetch } from "@/lib/api";
import type { PortalKey, PortalKeyIssued, PortalKeyList } from "@/lib/types";

export default function KeysPage() {
    const [keys, setKeys] = useState<PortalKey[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [issued, setIssued] = useState<PortalKeyIssued | null>(null);
    const [busy, setBusy] = useState(false);
    const [environment, setEnvironment] = useState<"sandbox" | "live">("sandbox");
    const [label, setLabel] = useState("");

    const load = useCallback(() => {
        portalFetch<PortalKeyList>("/tenant_keys")
            .then((d) => {
                setKeys(d.keys);
                setError(null);
            })
            .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    }, []);

    useEffect(load, [load]);

    async function issue(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const res = await portalFetch<PortalKeyIssued>("/tenant_keys", {
                method: "POST",
                body: { environment, ...(label.trim() ? { label: label.trim() } : {}) },
            });
            setIssued(res);
            setLabel("");
            load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    }

    async function revoke(keyId: string) {
        if (!confirm("Revoke this key? Requests using it will start failing immediately.")) return;
        setError(null);
        try {
            await portalFetch("/tenant_keys", { method: "PATCH", body: { key_id: keyId } });
            load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : String(err));
        }
    }

    return (
        <div className="grid max-w-4xl gap-5">
            <h1 className="text-xl font-semibold">API keys</h1>

            {error && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            {/* Show-once modal — the plaintext lives only in this component's state. */}
            {issued && (
                <div className="rounded border border-amber-300 bg-amber-50 p-4">
                    <p className="mb-2 text-sm font-medium text-amber-900">New key created — copy it now</p>
                    <code className="block break-all rounded bg-white p-3 font-mono text-sm">
                        {issued.plaintext}
                    </code>
                    <p className="mt-2 text-xs text-amber-800">{issued.warning}</p>
                    <button
                        onClick={() => {
                            navigator.clipboard?.writeText(issued.plaintext).catch(() => {});
                        }}
                        className="mt-3 rounded bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
                    >
                        Copy to clipboard
                    </button>
                    <button
                        onClick={() => setIssued(null)}
                        className="ml-2 rounded border border-amber-700 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100"
                    >
                        I saved it — dismiss
                    </button>
                </div>
            )}

            <form onSubmit={issue} className="flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-white p-4">
                <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value as "sandbox" | "live")}
                    className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                >
                    <option value="sandbox">sandbox (sk_test_)</option>
                    <option value="live">live (sk_live_)</option>
                </select>
                <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="label (optional)"
                    maxLength={100}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button
                    type="submit"
                    disabled={busy}
                    className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                    {busy ? "Creating…" : "Create key"}
                </button>
            </form>

            <section className="rounded border border-slate-200 bg-white">
                <h2 className="border-b border-slate-200 px-4 py-3 font-medium">Your keys</h2>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase text-slate-500">
                            <th className="px-4 py-2">Prefix</th>
                            <th className="px-4 py-2">Env</th>
                            <th className="px-4 py-2">Label</th>
                            <th className="px-4 py-2">Last used</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {keys.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-4 text-slate-400">
                                    no keys yet — create one above
                                </td>
                            </tr>
                        )}
                        {keys.map((k) => (
                            <tr key={k.id} className="border-t border-slate-100">
                                <td className="px-4 py-2 font-mono text-xs">{k.key_prefix}…</td>
                                <td className="px-4 py-2">{k.environment}</td>
                                <td className="px-4 py-2 text-slate-500">{k.label ?? "—"}</td>
                                <td className="px-4 py-2 text-slate-500">
                                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                                </td>
                                <td className="px-4 py-2">
                                    {k.revoked_at ? (
                                        <span className="text-xs text-red-600">revoked</span>
                                    ) : (
                                        <span className="text-xs text-green-700">active</span>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-right">
                                    {!k.revoked_at && (
                                        <button
                                            onClick={() => revoke(k.id)}
                                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                                        >
                                            Revoke
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
