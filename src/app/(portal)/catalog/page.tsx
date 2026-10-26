"use client";

import { useEffect, useState } from "react";
import { ApiError, portalFetch } from "@/lib/api";
import type { PortalProducts, PortalRun, PortalRuns } from "@/lib/types";

const SECTIONS = [
    "", "top", "bottom", "dress", "saree", "blouse", "dupatta", "outerwear",
    "footwear", "bag", "jewellery", "accessory",
];

export default function CatalogPage() {
    const [products, setProducts] = useState<PortalProducts | null>(null);
    const [runs, setRuns] = useState<PortalRun[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [section, setSection] = useState("");
    const [q, setQ] = useState("");
    const [submittedQ, setSubmittedQ] = useState("");

    useEffect(() => {
        const params = new URLSearchParams({ page: String(page), page_size: "25" });
        if (section) params.set("section", section);
        if (submittedQ) params.set("q", submittedQ);
        portalFetch<PortalProducts>(`/tenant_catalog?${params}`)
            .then((d) => {
                setProducts(d);
                setError(null);
            })
            .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    }, [page, section, submittedQ]);

    useEffect(() => {
        portalFetch<PortalRuns>("/tenant_catalog?op=runs")
            .then((d) => setRuns(d.runs))
            .catch(() => setRuns([])); // runs are supplementary; never block the browse view
    }, []);

    const pageSize = products?.page_size ?? 25;
    const totalPages = products ? Math.max(1, Math.ceil(products.total / pageSize)) : 1;

    return (
        <div className="grid gap-5">
            <h1 className="text-xl font-semibold">Catalog</h1>

            {error && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

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
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
                <select
                    value={section}
                    onChange={(e) => {
                        setPage(0);
                        setSection(e.target.value);
                    }}
                    className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                >
                    {SECTIONS.map((s) => (
                        <option key={s} value={s}>
                            {s === "" ? "all sections" : s}
                        </option>
                    ))}
                </select>
                <button
                    type="submit"
                    className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                >
                    Search
                </button>
                {products && (
                    <span className="text-xs text-slate-500">{products.total} products</span>
                )}
            </form>

            <section className="rounded border border-slate-200 bg-white">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                            <th className="px-4 py-2">External ID</th>
                            <th className="px-4 py-2">Title</th>
                            <th className="px-4 py-2">Section</th>
                            <th className="px-4 py-2">Price</th>
                            <th className="px-4 py-2">Stock</th>
                            <th className="px-4 py-2">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!products && !error && (
                            <tr>
                                <td colSpan={6} className="px-4 py-4 text-slate-400">
                                    loading…
                                </td>
                            </tr>
                        )}
                        {products?.products.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-4 text-slate-400">
                                    no products match
                                </td>
                            </tr>
                        )}
                        {products?.products.map((p) => (
                            <tr key={p.id} className="border-t border-slate-100">
                                <td className="px-4 py-2 font-mono text-xs">{p.external_id}</td>
                                <td className="px-4 py-2">{p.title}</td>
                                <td className="px-4 py-2">{p.section}</td>
                                <td className="px-4 py-2">{p.price ?? "—"}</td>
                                <td className="px-4 py-2">{p.in_stock ? "in stock" : "out"}</td>
                                <td className="px-4 py-2 text-slate-500">{p.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {products && products.total > pageSize && (
                    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-sm">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(page - 1)}
                            className="rounded border border-slate-300 px-3 py-1 text-xs disabled:opacity-40"
                        >
                            ← Previous
                        </button>
                        <span className="text-xs text-slate-500">
                            page {page + 1} of {totalPages}
                        </span>
                        <button
                            disabled={page + 1 >= totalPages}
                            onClick={() => setPage(page + 1)}
                            className="rounded border border-slate-300 px-3 py-1 text-xs disabled:opacity-40"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </section>

            {runs.length > 0 && (
                <section className="rounded border border-slate-200 bg-white">
                    <h2 className="border-b border-slate-200 px-4 py-3 font-medium">Import history</h2>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase text-slate-500">
                                <th className="px-4 py-2">Started</th>
                                <th className="px-4 py-2">Status</th>
                                <th className="px-4 py-2">Rows</th>
                                <th className="px-4 py-2">Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map((r) => (
                                <tr key={r.id} className="border-t border-slate-100">
                                    <td className="px-4 py-2 text-slate-500">
                                        {new Date(r.started_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2">{r.status}</td>
                                    <td className="px-4 py-2">
                                        {r.rows_ok} ok / {r.rows_failed} failed / {r.rows_total} total
                                    </td>
                                    <td className="px-4 py-2 text-xs text-slate-500">{r.notes ?? "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}
        </div>
    );
}
