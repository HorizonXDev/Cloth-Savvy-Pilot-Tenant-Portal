"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, portalFetch } from "@/lib/api";
import type { PortalProduct, PortalProducts, PortalRun, PortalRuns } from "@/lib/types";
import { Badge, Button, Empty, Notice, PageTitle, TableWrap } from "@/components/ui";
import UploadWizard from "./upload-wizard";
import StagingQueue from "./staging-queue";
import CatalogForm, { toFormValues } from "./catalog-form";
import Modal from "@/components/modal";

const SECTIONS = [
    "", "top", "bottom", "dress", "saree", "blouse", "dupatta", "outerwear",
    "footwear", "bag", "jewellery", "accessory",
];

type Tab = "products" | "queue" | "upload" | "history";
const TABS: Array<{ id: Tab; label: string }> = [
    { id: "products", label: "Products" },
    { id: "queue", label: "Import queue" },
    { id: "upload", label: "Upload CSV" },
    { id: "history", label: "Upload history" },
];

/**
 * The tenant's whole catalogue surface. This is the ONLY place products are
 * created, changed or deleted — the admin console reads this data and can
 * re-key it, but it never hand-edits a tenant's rows.
 */
export default function CatalogPage() {
    const [tab, setTab] = useState<Tab>("products");

    const [products, setProducts] = useState<PortalProducts | null>(null);
    const [runs, setRuns] = useState<PortalRun[]>([]);
    const [queueToken, setQueueToken] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const [page, setPage] = useState(0);
    const [section, setSection] = useState("");
    const [status, setStatus] = useState("");
    const [q, setQ] = useState("");
    const [submittedQ, setSubmittedQ] = useState("");

    const [editing, setEditing] = useState<PortalProduct | null>(null);
    const [removing, setRemoving] = useState<PortalProduct | null>(null);
    const [flash, setFlash] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        const params = new URLSearchParams({ page: String(page), page_size: "25" });
        if (section) params.set("section", section);
        if (status) params.set("status", status);
        if (submittedQ) params.set("q", submittedQ);
        portalFetch<PortalProducts>(`/tenant_catalog?${params}`)
            .then((d) => {
                setProducts(d);
                setError(null);
            })
            .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    }, [page, section, status, submittedQ]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        portalFetch<PortalRuns>("/tenant_catalog?op=runs")
            .then((d) => setRuns(d.runs))
            .catch(() => setRuns([])); // history is supplementary — never block the browse view
    }, []);

    const pageSize = products?.page_size ?? 25;
    const totalPages = products ? Math.max(1, Math.ceil(products.total / pageSize)) : 1;

    function afterMutation(message: string) {
        setFlash(message);
        setActionError(null);
        window.setTimeout(() => setFlash(null), 5000);
        load();
        setRuns((r) => r); // runs only change on upload
        setQueueToken((t) => t + 1);
    }

    async function saveProduct(payload: Record<string, unknown>) {
        if (!editing) return;
        const d = await portalFetch<{ image_changed: boolean; needs_reembed: boolean }>(
            "/tenant_catalog",
            {
                method: "POST",
                body: { op: "product_update", product_id: editing.id, ...payload },
            },
        );
        setEditing(null);
        afterMutation(
            d.image_changed
                ? `${editing.external_id} saved — a new picture needs its own vector, so it is flagged for re-embedding and appears in the owner's next export.`
                : `${editing.external_id} saved — text and price act as filters; the image vector is untouched.`,
        );
    }

    async function archive(p: PortalProduct) {
        try {
            const next = p.status === "active" ? "archived" : "active";
            await portalFetch("/tenant_catalog", {
                method: "POST",
                body: { op: "product_update", product_id: p.id, status: next },
            });
            afterMutation(`${p.external_id} is now ${next}.`);
        } catch (e) {
            setActionError(e instanceof ApiError ? e.message : String(e));
        }
    }

    async function confirmRemove() {
        if (!removing) return;
        setBusy(true);
        try {
            await portalFetch("/tenant_catalog", {
                method: "POST",
                body: { op: "product_delete", product_id: removing.id },
            });
            const label = removing.external_id;
            setRemoving(null);
            afterMutation(`${label} deleted — it is gone from search immediately.`);
        } catch (e) {
            setActionError(e instanceof ApiError ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="grid gap-6">
            <PageTitle
                eyebrow="catalog"
                title="Products & imports"
                actions={
                    <span className="text-sm text-muted">
                        {products ? `${products.total} product${products.total === 1 ? "" : "s"}` : ""}
                    </span>
                }
            />

            {error && <Notice tone="error">{error}</Notice>}
            {actionError && <Notice tone="error">{actionError}</Notice>}
            {flash && <Notice tone="ok">{flash}</Notice>}

            {/* tabs */}
            <nav className="flex flex-wrap gap-2 border-b border-line pb-3">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-ghost"}`}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>

            {tab === "queue" && (
                <StagingQueue
                    refreshToken={queueToken}
                    onChanged={() => setQueueToken((t) => t + 1)}
                />
            )}

            {tab === "upload" && (
                <div className="card card-pad">
                    <UploadWizard
                        onUploaded={() => {
                            setQueueToken((t) => t + 1);
                            portalFetch<PortalRuns>("/tenant_catalog?op=runs")
                                .then((d) => setRuns(d.runs))
                                .catch(() => undefined);
                        }}
                    />
                </div>
            )}

            {tab === "history" && (
                <TableWrap>
                    <thead>
                        <tr>
                            <th>Started</th>
                            <th>Status</th>
                            <th>Rows</th>
                            <th>File / notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {runs.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-muted">
                                    no uploads yet
                                </td>
                            </tr>
                        )}
                        {runs.map((r) => (
                            <tr key={r.id}>
                                <td className="text-xs text-muted">
                                    {new Date(r.started_at).toLocaleString()}
                                </td>
                                <td>
                                    <Badge tone={r.status === "failed" ? "danger" : r.status === "done" ? "ok" : "warn"}>
                                        {r.status}
                                    </Badge>
                                </td>
                                <td>
                                    {r.rows_ok} queued / {r.rows_failed} failed / {r.rows_total} total
                                </td>
                                <td className="max-w-64 truncate text-xs text-muted">{r.notes ?? "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </TableWrap>
            )}

            {tab === "products" && (
                <div className="grid gap-4">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            setPage(0);
                            setSubmittedQ(q.trim());
                        }}
                        className="flex flex-wrap items-center gap-3"
                    >
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="search titles…"
                            className="input w-56"
                        />
                        <select
                            value={section}
                            onChange={(e) => {
                                setPage(0);
                                setSection(e.target.value);
                            }}
                            className="input w-auto"
                        >
                            {SECTIONS.map((s) => (
                                <option key={s} value={s}>
                                    {s === "" ? "all sections" : s}
                                </option>
                            ))}
                        </select>
                        <select
                            value={status}
                            onChange={(e) => {
                                setPage(0);
                                setStatus(e.target.value);
                            }}
                            className="input w-auto"
                        >
                            <option value="">all statuses</option>
                            <option value="active">active</option>
                            <option value="archived">archived</option>
                        </select>
                        <Button type="submit" variant="primary" size="sm">
                            Search
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                                setQ("");
                                setSubmittedQ("");
                                setSection("");
                                setStatus("");
                                setPage(0);
                            }}
                        >
                            Reset
                        </Button>
                    </form>

                    {products === null ? (
                        <p className="py-6 text-sm text-muted">loading…</p>
                    ) : products.products.length === 0 ? (
                        <Empty
                            title="No products match"
                            hint="Clear the filters, or upload a CSV to fill your catalogue."
                            action={
                                <Button variant="primary" onClick={() => setTab("upload")}>
                                    Upload a CSV
                                </Button>
                            }
                        />
                    ) : (
                        <>
                            <TableWrap>
                                <thead>
                                    <tr>
                                        <th>SKU</th>
                                        <th>Title</th>
                                        <th>Section</th>
                                        <th>Price</th>
                                        <th>Stock</th>
                                        <th>Status</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.products.map((p) => (
                                        <tr key={p.id}>
                                            <td className="mono">{p.external_id}</td>
                                            <td>
                                                {p.title}
                                                {p.colors && p.colors.length > 0 && (
                                                    <span className="ml-2 text-xs text-muted">
                                                        {p.colors.join(", ")}
                                                    </span>
                                                )}
                                            </td>
                                            <td>{p.section}</td>
                                            <td>{p.price === null ? "—" : Number(p.price)}</td>
                                            <td>{p.in_stock ? "in stock" : "out"}</td>
                                            <td>
                                                <Badge tone={p.status === "active" ? "ok" : "plain"}>
                                                    {p.status}
                                                </Badge>
                                                {p.needs_reembed && (
                                                    <span className="ml-2 rounded-full bg-warn/15 px-2 py-0.5 text-xs text-warn">
                                                        image changed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap text-right">
                                                <Button
                                                    size="sm"
                                                    onClick={() => {
                                                        setActionError(null);
                                                        setEditing(p);
                                                    }}
                                                >
                                                    Edit
                                                </Button>{" "}
                                                <Button size="sm" onClick={() => archive(p)}>
                                                    {p.status === "active" ? "Archive" : "Restore"}
                                                </Button>{" "}
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={() => {
                                                        setActionError(null);
                                                        setRemoving(p);
                                                    }}
                                                >
                                                    Delete
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </TableWrap>

                            {products.total > pageSize && (
                                <div className="flex items-center justify-between text-sm">
                                    <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                                        ← Previous
                                    </Button>
                                    <span className="text-xs text-muted">
                                        page {page + 1} of {totalPages}
                                    </span>
                                    <Button
                                        size="sm"
                                        disabled={page + 1 >= totalPages}
                                        onClick={() => setPage(page + 1)}
                                    >
                                        Next →
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {editing && (
                <Modal title={`Edit ${editing.external_id}`} onClose={() => setEditing(null)} wide>
                    <CatalogForm
                        initial={toFormValues(editing)}
                        submitLabel="Save changes"
                        onSubmit={saveProduct}
                        onCancel={() => setEditing(null)}
                        extraNote="Text, price and status changes apply to filters as soon as you save. Changing the image flags the product for re-embedding — the owner's pipeline replaces its vector on the next run."
                    />
                </Modal>
            )}

            {removing && (
                <Modal title="Delete this product?" onClose={() => setRemoving(null)}>
                    <div className="grid gap-4">
                        <p className="text-sm text-muted">
                            <span className="mono">{removing.external_id}</span> — {removing.title} will be
                            deleted permanently: it disappears from search results straight away and
                            the usage history already recorded against it stays. This cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="danger" busy={busy} onClick={confirmRemove}>
                                Delete permanently
                            </Button>
                            <Button onClick={() => setRemoving(null)} disabled={busy}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
