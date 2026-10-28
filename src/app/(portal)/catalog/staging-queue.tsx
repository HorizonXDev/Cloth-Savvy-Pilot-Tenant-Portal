"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, portalFetch } from "@/lib/api";
import type { PortalStaging, PortalStagingRow } from "@/lib/types";
import { Badge, Button, Empty, Notice } from "@/components/ui";
import CatalogForm, { toFormValues } from "./catalog-form";
import Modal from "@/components/modal";

const FILTERS = ["pending", "failed", "merged"] as const;
type Filter = (typeof FILTERS)[number] | "";

/**
 * The import queue: rows this tenant uploaded that the owner's embedding
 * pipeline has not merged yet. Pending/failed rows can be fixed or removed
 * here — merged rows are live products and must be edited on the product
 * table instead (the server enforces that too).
 */
export default function StagingQueue({
    refreshToken,
    onChanged,
}: {
    refreshToken: number;
    onChanged: () => void;
}) {
    const [filter, setFilter] = useState<Filter>("pending");
    const [rows, setRows] = useState<PortalStagingRow[] | null>(null);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<PortalStagingRow | null>(null);
    const [removing, setRemoving] = useState<PortalStagingRow | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        const params = new URLSearchParams({ op: "staging", limit: "200" });
        if (filter) params.set("status", filter);
        portalFetch<PortalStaging>(`/tenant_catalog?${params}`)
            .then((d) => {
                setRows(d.rows);
                setTotal(d.total);
                setError(null);
            })
            .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    }, [filter]);

    useEffect(() => {
        load();
    }, [load, refreshToken]);

    async function saveStage(payload: Record<string, unknown>) {
        if (!editing) return;
        await portalFetch("/tenant_catalog", {
            method: "POST",
            body: { op: "stage_update", stage_id: editing.id, ...payload },
        });
        setEditing(null);
        setActionError(null);
        load();
        onChanged();
    }

    async function confirmRemove() {
        if (!removing) return;
        setBusy(true);
        setActionError(null);
        try {
            await portalFetch("/tenant_catalog", {
                method: "POST",
                body: { op: "stage_delete", stage_id: removing.id },
            });
            setRemoving(null);
            load();
            onChanged();
        } catch (e) {
            setActionError(e instanceof ApiError ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    {(["", ...FILTERS] as Filter[]).map((f) => (
                        <button
                            key={f || "all"}
                            onClick={() => setFilter(f)}
                            className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`}
                        >
                            {f === "" ? "all" : f}
                        </button>
                    ))}
                </div>
                <span className="text-xs text-muted">
                    {total} row{total === 1 ? "" : "s"} in the queue
                </span>
            </div>

            {error && <Notice tone="error">{error}</Notice>}
            {actionError && <Notice tone="error">{actionError}</Notice>}

            {rows === null ? (
                <p className="py-6 text-sm text-muted">loading…</p>
            ) : rows.length === 0 ? (
                <Empty
                    title="Queue is empty"
                    hint={
                        filter === "pending"
                            ? "No CSV rows are waiting for the pipeline. Upload one above."
                            : `No rows with status “${filter}”.`
                    }
                />
            ) : (
                <div className="overflow-x-auto rounded-xl border border-line bg-panel">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>SKU</th>
                                <th>Title</th>
                                <th>Section</th>
                                <th>Status</th>
                                <th>Queued</th>
                                <th>Reason</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td className="mono">{r.external_id}</td>
                                    <td>{r.payload?.title ?? "—"}</td>
                                    <td>{r.payload?.section ?? "—"}</td>
                                    <td>
                                        <Badge
                                            tone={
                                                r.status === "merged"
                                                    ? "ok"
                                                    : r.status === "failed"
                                                      ? "danger"
                                                      : "warn"
                                            }
                                        >
                                            {r.status}
                                        </Badge>
                                        {r.status !== "merged" && !r.payload?.image_url && (
                                            <span className="ml-2 rounded-full bg-warn/15 px-2 py-0.5 text-xs text-warn">
                                                no image
                                            </span>
                                        )}
                                    </td>
                                    <td className="text-xs text-muted">
                                        {new Date(r.created_at).toLocaleString()}
                                    </td>
                                    <td className="max-w-64 truncate text-xs text-danger">
                                        {r.error ?? ""}
                                    </td>
                                    <td className="whitespace-nowrap text-right">
                                        {r.status === "merged" ? (
                                            <span className="text-xs text-muted">live product</span>
                                        ) : (
                                            <>
                                                <Button
                                                    size="sm"
                                                    onClick={() => {
                                                        setActionError(null);
                                                        setEditing(r);
                                                    }}
                                                >
                                                    Edit
                                                </Button>{" "}
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={() => {
                                                        setActionError(null);
                                                        setRemoving(r);
                                                    }}
                                                >
                                                    Remove
                                                </Button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {editing && (
                <Modal title={`Edit queued row · ${editing.external_id}`} onClose={() => setEditing(null)}>
                    <CatalogForm
                        initial={toFormValues(editing.payload ?? {})}
                        submitLabel="Save & re-queue"
                        onSubmit={saveStage}
                        onCancel={() => setEditing(null)}
                        extraNote="Saving puts this row back into the pending queue — it is embedded from its image URL when the owner's pipeline runs."
                    />
                </Modal>
            )}

            {removing && (
                <Modal title="Remove queued row?" onClose={() => setRemoving(null)}>
                    <div className="grid gap-4">
                        <p className="text-sm text-muted">
                            <span className="mono">{removing.external_id}</span> —{" "}
                            {removing.payload?.title ?? "(no title)"} will be dropped from the queue.
                            Nothing in your live catalogue changes, and this cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="danger" busy={busy} onClick={confirmRemove}>
                                Remove from queue
                            </Button>
                            <Button onClick={() => setRemoving(null)} disabled={busy}>
                                Keep it
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
