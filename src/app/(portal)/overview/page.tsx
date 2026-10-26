"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, portalFetch } from "@/lib/api";
import type { PortalAccount, PortalUsage } from "@/lib/types";
import { Badge, Card, ColumnChart, Notice, PageTitle, RankBars, Stat } from "@/components/ui";

/** Landing page: who you are, what you have spent this window, and where to
 *  go next. Deliberately not a full report — Usage & billing holds that. */
export default function OverviewPage() {
    const [account, setAccount] = useState<PortalAccount | null>(null);
    const [usage, setUsage] = useState<PortalUsage | null>(null);
    const [days, setDays] = useState(7);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        portalFetch<PortalAccount>("/tenant_account")
            .then(setAccount)
            .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    }, []);

    useEffect(() => {
        portalFetch<PortalUsage>(`/tenant_usage?days=${days}`)
            .then((d) => {
                setUsage(d);
                setError(null);
            })
            .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    }, [days]);

    return (
        <div className="grid gap-6">
            <PageTitle
                eyebrow={account ? `tenant · ${account.tenant.slug}` : "tenant"}
                title={account?.tenant.name ?? "Loading your account…"}
                actions={
                    account && (
                        <Badge tone={account.tenant.status === "active" ? "ok" : "danger"}>
                            {account.tenant.status}
                        </Badge>
                    )
                }
            />

            {error && <Notice tone="error">{error}</Notice>}

            {usage && (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Stat
                            label={`Calls · ${days} days`}
                            value={usage.totals.calls.toLocaleString()}
                            hint={`${usage.totals.units.toLocaleString()} billed units`}
                        />
                        <Stat
                            label="Month to date"
                            value={usage.month_to_date.calls.toLocaleString()}
                            hint={`${usage.month_to_date.units.toLocaleString()} units`}
                        />
                        <Stat
                            label="Keys in use"
                            value={usage.by_key.length}
                            hint="keys that called in this window"
                        />
                        <Stat
                            label="Rate limit"
                            value={`${usage.rate_limit_per_min}/min`}
                            hint={usage.currency ? `billing in ${usage.currency}` : "per key"}
                        />
                    </div>

                    <Card
                        title="Calls per day"
                        actions={
                            <select
                                value={days}
                                onChange={(e) => setDays(Number(e.target.value))}
                                className="input w-auto"
                            >
                                <option value={7}>last 7 days</option>
                                <option value={30}>last 30 days</option>
                                <option value={90}>last 90 days</option>
                            </select>
                        }
                    >
                        <ColumnChart
                            data={usage.by_day.map((d) => ({ label: d.day.slice(5), value: d.calls }))}
                            unit=" calls"
                        />
                        {usage.truncated && (
                            <p className="mt-3 text-xs text-warn">
                                showing the latest 10,000 events only — narrow the range for exact
                                numbers.
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
                </>
            )}

            <Card title="Do something">
                <div className="grid gap-3 sm:grid-cols-3">
                    <Link href="/catalog" className="card card-pad block hover:border-gold/60">
                        <p className="display text-lg">Catalog</p>
                        <p className="text-sm text-muted">
                            Upload a CSV, edit products, archive or delete them.
                        </p>
                    </Link>
                    <Link href="/keys" className="card card-pad block hover:border-gold/60">
                        <p className="display text-lg">API keys</p>
                        <p className="text-sm text-muted">Issue, rotate and revoke your keys.</p>
                    </Link>
                    <Link href="/quickstart" className="card card-pad block hover:border-gold/60">
                        <p className="display text-lg">Quickstart</p>
                        <p className="text-sm text-muted">
                            Copy-paste curl and JS against your live key.
                        </p>
                    </Link>
                </div>
            </Card>
        </div>
    );
}
