"use client";

import { useEffect, useState } from "react";
import { ApiError, portalFetch } from "@/lib/api";
import type { PortalUsage } from "@/lib/types";
import { downloadCsv } from "@/lib/csv";
import { Badge, Button, Card, ColumnChart, Notice, PageTitle, RankBars, Stat, TableWrap } from "@/components/ui";

const RANGES = [7, 30, 90] as const;

/** Usage & billing: what this tenant called, how much of it is billable, and
 *  a CSV of it for their own finance sheet. Month-to-date is a UTC calendar
 *  month (the API's definition), stated on the page so nobody argues later. */
export default function UsagePage() {
    const [days, setDays] = useState<(typeof RANGES)[number]>(30);
    const [usage, setUsage] = useState<PortalUsage | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [exportMsg, setExportMsg] = useState<string | null>(null);

    useEffect(() => {
        portalFetch<PortalUsage>(`/tenant_usage?days=${days}`)
            .then((d) => {
                setUsage(d);
                setError(null);
            })
            .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    }, [days]);

    function exportCsv(kind: "days" | "endpoints") {
        if (!usage) return;
        if (kind === "days") {
            downloadCsv(
                `usage-by-day-${days}d`,
                ["day", "calls"],
                usage.by_day.map((d) => [d.day, d.calls]),
            );
        } else {
            downloadCsv(
                `usage-by-endpoint-${days}d`,
                ["endpoint", "calls", "units", "codes"],
                usage.by_endpoint.map((e) => [
                    e.endpoint,
                    e.calls,
                    e.units,
                    Object.entries(e.codes)
                        .map(([code, n]) => `${code}x${n}`)
                        .join(" "),
                ]),
            );
        }
        setExportMsg(`${kind} CSV downloaded`);
        window.setTimeout(() => setExportMsg(null), 4000);
    }

    return (
        <div className="grid gap-6">
            <PageTitle
                eyebrow="billing"
                title="Usage"
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        {exportMsg && <span className="text-xs text-ok">{exportMsg}</span>}
                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value) as (typeof RANGES)[number])}
                            className="input w-auto"
                        >
                            {RANGES.map((r) => (
                                <option key={r} value={r}>
                                    last {r} days
                                </option>
                            ))}
                        </select>
                        <Button size="sm" onClick={() => exportCsv("days")} disabled={!usage}>
                            Export days
                        </Button>
                        <Button size="sm" onClick={() => exportCsv("endpoints")} disabled={!usage}>
                            Export endpoints
                        </Button>
                    </div>
                }
            />

            {error && <Notice tone="error">{error}</Notice>}

            {usage && (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Stat
                            label={`Calls · ${days} days`}
                            value={usage.totals.calls.toLocaleString()}
                            hint={`${usage.totals.units.toLocaleString()} billable units`}
                        />
                        <Stat
                            label="Month to date"
                            value={usage.month_to_date.calls.toLocaleString()}
                            hint={`${usage.month_to_date.units.toLocaleString()} units · UTC calendar month`}
                        />
                        <Stat label="Keys used" value={usage.by_key.length} />
                        <Stat
                            label="Rate limit"
                            value={`${usage.rate_limit_per_min}/min`}
                            hint="per key"
                        />
                    </div>

                    <Card
                        title="Calls per day"
                        actions={
                            <Badge tone="plain">
                                {usage.currency ? `billed in ${usage.currency}` : "no currency set"}
                            </Badge>
                        }
                    >
                        <ColumnChart
                            data={usage.by_day.map((d) => ({ label: d.day.slice(5), value: d.calls }))}
                            unit=" calls"
                        />
                        {usage.truncated && (
                            <p className="mt-3 text-xs text-warn">
                                showing the latest 10,000 events — narrow the range for exact totals.
                            </p>
                        )}
                    </Card>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card title="By endpoint">
                            <RankBars
                                data={usage.by_endpoint.map((e) => ({
                                    label: e.endpoint,
                                    value: e.calls,
                                }))}
                            />
                        </Card>
                        <Card title="By key">
                            <RankBars
                                data={usage.by_key.map((k) => ({
                                    label: `${k.prefix} · ${k.environment}`,
                                    value: k.calls,
                                }))}
                            />
                        </Card>
                    </div>

                    <TableWrap>
                        <thead>
                            <tr>
                                <th>Endpoint</th>
                                <th>Calls</th>
                                <th>Units</th>
                                <th>Response codes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usage.by_endpoint.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-muted">
                                        nothing called in this window yet
                                    </td>
                                </tr>
                            )}
                            {usage.by_endpoint.map((e) => (
                                <tr key={e.endpoint}>
                                    <td className="mono">{e.endpoint}</td>
                                    <td>{e.calls}</td>
                                    <td>{e.units}</td>
                                    <td className="mono text-xs text-muted">
                                        {Object.entries(e.codes)
                                            .map(([code, n]) => `${code}×${n}`)
                                            .join("  ") || "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </TableWrap>
                </>
            )}
        </div>
    );
}
