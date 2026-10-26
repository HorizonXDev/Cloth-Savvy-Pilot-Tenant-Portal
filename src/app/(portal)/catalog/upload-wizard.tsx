"use client";

import { useState } from "react";
import { ApiError, portalFetch } from "@/lib/api";
import { issuesByColumn, parseCsv, validateCsv, type CsvReport } from "@/lib/csv";
import { Badge, Button, Notice } from "@/components/ui";

const BATCH = 50;

type Phase = "idle" | "ready" | "uploading" | "done";

interface UploadResult {
    queued: number;
    rejected: number;
    fileName: string;
    reasons: Array<{ external_id: string | null; reason: string }>;
}

/**
 * The tenant's CSV upload. Validation happens HERE, in the browser, before
 * anything is sent: the report names the failing column, the row numbers and
 * the offending values (mirrors _pilot/import_row.ts). Only rows that pass
 * are sent; they land in catalog_staging as `pending` — no embedding, no
 * search change. The owner's pipeline merges them.
 */
export default function UploadWizard({ onUploaded }: { onUploaded: () => void }) {
    const [phase, setPhase] = useState<Phase>("idle");
    const [fileName, setFileName] = useState("");
    const [report, setReport] = useState<CsvReport | null>(null);
    const [progress, setProgress] = useState({ sent: 0, total: 0 });
    const [result, setResult] = useState<UploadResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    function reset() {
        setPhase("idle");
        setFileName("");
        setReport(null);
        setResult(null);
        setError(null);
        setProgress({ sent: 0, total: 0 });
    }

    function onFile(file: File) {
        reset();
        setFileName(file.name);
        setError(null);
        file.text().then((text) => {
            const { headers, rows } = parseCsv(text);
            const r = validateCsv(headers, rows);
            setReport(r);
            setPhase("ready");
        });
    }

    async function upload() {
        if (!report || report.good.length === 0) return;
        setPhase("uploading");
        setError(null);
        const rows = report.good.map((g) => g.data);
        setProgress({ sent: 0, total: rows.length });
        const reasons: Array<{ external_id: string | null; reason: string }> = [];
        let queued = 0;

        try {
            const start = await portalFetch<{ run: { id: string } }>("/tenant_catalog", {
                method: "POST",
                body: { op: "stage_start", rows_total: rows.length, source_file: fileName },
            });
            const runId = start.run.id;

            for (let i = 0; i < rows.length; i += BATCH) {
                const chunk = rows.slice(i, i + BATCH);
                const d = await portalFetch<{
                    batch: { ok: number; failed: number };
                    failed: Array<{ external_id: string | null; reason: string }>;
                }>("/tenant_catalog", {
                    method: "POST",
                    body: { op: "stage_batch", run_id: runId, rows: chunk, source_file: fileName },
                });
                queued += d.batch.ok;
                reasons.push(...d.failed);
                setProgress({ sent: Math.min(rows.length, i + chunk.length), total: rows.length });
            }

            await portalFetch("/tenant_catalog", {
                method: "POST",
                body: {
                    op: "stage_finish",
                    run_id: runId,
                    status: reasons.length === 0 ? "done" : "done",
                    notes: fileName,
                },
            });

            setResult({ queued, rejected: reasons.length, fileName, reasons });
            setPhase("done");
            onUploaded();
        } catch (e) {
            setError(e instanceof ApiError ? e.message : String(e));
            setPhase("ready");
        }
    }

    const blocked = report?.missingColumns ?? [];
    const grouped = report ? issuesByColumn(report.issues) : [];

    return (
        <div className="grid gap-4">
            <div className="grid gap-2">
                <span className="label">Upload a CSV</span>
                <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onFile(f);
                    }}
                    className="text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-line file:bg-sunken file:px-3 file:py-1.5 file:text-sm file:text-ink"
                />
                <p className="text-xs text-muted">
                    required columns: <code className="mono">external_id</code> (or sku / id),{" "}
                    <code className="mono">title</code>, <code className="mono">section</code> —
                    optional: category, gender, colors (semicolon-separated), price, in_stock,
                    product_url, image_url. Nothing goes live: rows queue for the embedding
                    pipeline and only appear in search after they are merged.
                </p>
            </div>

            {error && <Notice tone="error">{error}</Notice>}

            {report && (
                <div className="card card-pad grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="display text-lg">{fileName}</p>
                        <div className="flex items-center gap-2">
                            <Badge tone={report.good.length > 0 ? "ok" : "danger"}>
                                {report.good.length} ready
                            </Badge>
                            {report.issues.length > 0 && (
                                <Badge tone="warn">{report.issues.length} to fix</Badge>
                            )}
                        </div>
                    </div>

                    {blocked.length > 0 && (
                        <Notice tone="error">
                            This file cannot be uploaded: it has no{" "}
                            {blocked.join(", ")} column{blocked.length > 1 ? "s" : ""}. Rename the
                            header row and pick the file again — nothing has been sent.
                        </Notice>
                    )}

                    {blocked.length === 0 && grouped.length > 0 && (
                        <div className="rounded-xl border border-line bg-sunken/60 p-3">
                            <p className="mb-2 text-sm font-medium">
                                Rows with problems — by column
                            </p>
                            <ul className="grid gap-1.5 text-sm">
                                {grouped.map((g) => (
                                    <li key={g.column} className="flex flex-wrap items-baseline gap-2">
                                        <code className="mono text-gold">{g.column}</code>
                                        <span className="text-danger">
                                            {g.count} row{g.count > 1 ? "s" : ""}
                                        </span>
                                        <span className="text-xs text-muted">
                                            e.g. row {g.sample.row}: {g.sample.reason}
                                            {g.sample.value ? ` (value: “${g.sample.value}”)` : ""}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {Object.keys(report.badSections).length > 0 && (
                                <p className="mt-2 text-xs text-warn">
                                    invalid section values:{" "}
                                    {Object.entries(report.badSections)
                                        .map(([v, n]) => `${v} ×${n}`)
                                        .join(", ")}{" "}
                                    — allowed: top, bottom, dress, saree, blouse, dupatta,
                                    outerwear, footwear, bag, jewellery, accessory
                                </p>
                            )}
                            <p className="mt-2 text-xs text-muted">
                                {report.issues.length} row(s) will be skipped, {report.blankRows}{" "}
                                blank row(s) ignored.
                            </p>
                        </div>
                    )}

                    {phase === "ready" && (
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                variant="primary"
                                onClick={upload}
                                disabled={report.good.length === 0}
                            >
                                Queue {report.good.length} row{report.good.length === 1 ? "" : "s"}
                            </Button>
                            <Button onClick={reset}>Choose another file</Button>
                        </div>
                    )}

                    {phase === "uploading" && (
                        <div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-sunken">
                                <div
                                    className="h-full rounded-full bg-gold transition-all"
                                    style={{
                                        width: `${
                                            progress.total === 0
                                                ? 0
                                                : Math.round((progress.sent / progress.total) * 100)
                                        }%`,
                                    }}
                                />
                            </div>
                            <p className="mt-1 text-xs text-muted">
                                queueing {progress.sent}/{progress.total} — do not close this tab
                            </p>
                        </div>
                    )}

                    {phase === "done" && result && (
                        <Notice tone={result.rejected === 0 ? "ok" : "error"}>
                            {result.queued} row(s) queued for the pipeline
                            {result.rejected > 0
                                ? `, ${result.rejected} rejected by the server — see below.`
                                : ". Nothing is searchable yet; the owner merges the queue."}
                        </Notice>
                    )}

                    {result && result.reasons.length > 0 && (
                        <ul className="max-h-40 overflow-y-auto text-xs text-danger">
                            {result.reasons.map((r, i) => (
                                <li key={i}>
                                    {r.external_id ?? "(row)"}: {r.reason}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
