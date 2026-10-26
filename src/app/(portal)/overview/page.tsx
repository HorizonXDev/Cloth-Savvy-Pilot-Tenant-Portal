"use client";

import { useEffect, useState } from "react";
import { ApiError, portalFetch } from "@/lib/api";
import type { PortalAccount, PortalUsage } from "@/lib/types";

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

    const maxDay = Math.max(1, ...(usage?.by_day.map((d) => d.calls) ?? [1]));

    return (
        <div className="grid gap-5">
            {account && (
                <div>
                    <h1 className="text-xl font-semibold">{account.tenant.name}</h1>
                    <p className="text-sm text-slate-500">
                        tenant <code className="rounded bg-slate-200 px-1">{account.tenant.slug}</code>
                        {" · "}model {account.embedding_model}
                    </p>
                </div>
            )}

            {error && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <div className="flex items-center gap-3">
                <h2 className="font-medium">Usage</h2>
                <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                >
                    <option value={7}>last 7 days</option>
                    <option value={30}>last 30 days</option>
                    <option value={90}>last 90 days</option>
                </select>
                {usage?.truncated && (
                    <span className="text-xs text-amber-700">showing the latest 10,000 events only</span>
                )}
            </div>

            {usage && (
                <>
                    <div className="grid gap-4 sm:grid-cols-4">
                        <div className="rounded border border-slate-200 bg-white p-4">
                            <p className="text-xs uppercase text-slate-500">Calls ({days}d)</p>
                            <p className="text-2xl font-semibold">{usage.totals.calls}</p>
                        </div>
                        <div className="rounded border border-slate-200 bg-white p-4">
                            <p className="text-xs uppercase text-slate-500">Units ({days}d)</p>
                            <p className="text-2xl font-semibold">{usage.totals.units}</p>
                        </div>
                        <div className="rounded border border-slate-200 bg-white p-4">
                            <p className="text-xs uppercase text-slate-500">Month to date</p>
                            <p className="text-2xl font-semibold">{usage.month_to_date.calls}</p>
                            <p className="text-xs text-slate-500">{usage.month_to_date.units} units</p>
                        </div>
                        <div className="rounded border border-slate-200 bg-white p-4">
                            <p className="text-xs uppercase text-slate-500">Keys seen</p>
                            <p className="text-2xl font-semibold">{usage.by_key.length}</p>
                        </div>
                    </div>

                    <section className="rounded border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex items-baseline justify-between">
                            <h3 className="font-medium">Calls per day</h3>
                            <span className="text-xs text-slate-500">
                                rate limit {usage.rate_limit_per_min}/min per key
                                {usage.currency ? ` · billing in ${usage.currency}` : ""}
                            </span>
                        </div>
                        <div className="flex h-28 items-end gap-1">
                            {usage.by_day.length === 0 && (
                                <p className="text-sm text-slate-400">no calls in this window</p>
                            )}
                            {usage.by_day.map((d) => (
                                <div key={d.day} className="group flex flex-1 flex-col items-center gap-1">
                                    <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100">
                                        {d.calls}
                                    </span>
                                    <div
                                        className="w-full rounded-t bg-blue-500"
                                        style={{ height: `${Math.max(4, (d.calls / maxDay) * 80)}px` }}
                                        title={`${d.day}: ${d.calls}`}
                                    />
                                    <span className="text-[9px] text-slate-400">{d.day.slice(5)}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <section className="rounded border border-slate-200 bg-white">
                            <h3 className="border-b border-slate-200 px-4 py-3 font-medium">By endpoint</h3>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase text-slate-500">
                                        <th className="px-4 py-2">Endpoint</th>
                                        <th className="px-4 py-2">Calls</th>
                                        <th className="px-4 py-2">Codes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usage.by_endpoint.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-4 text-slate-400">
                                                nothing yet
                                            </td>
                                        </tr>
                                    )}
                                    {usage.by_endpoint.map((e) => (
                                        <tr key={e.endpoint} className="border-t border-slate-100">
                                            <td className="px-4 py-2 font-mono text-xs">{e.endpoint}</td>
                                            <td className="px-4 py-2">{e.calls}</td>
                                            <td className="px-4 py-2 font-mono text-xs text-slate-500">
                                                {Object.entries(e.codes)
                                                    .map(([code, n]) => `${code}×${n}`)
                                                    .join("  ")}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>

                        <section className="rounded border border-slate-200 bg-white">
                            <h3 className="border-b border-slate-200 px-4 py-3 font-medium">By key</h3>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase text-slate-500">
                                        <th className="px-4 py-2">Key</th>
                                        <th className="px-4 py-2">Env</th>
                                        <th className="px-4 py-2">Calls</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usage.by_key.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-4 text-slate-400">
                                                no keyed calls yet
                                            </td>
                                        </tr>
                                    )}
                                    {usage.by_key.map((k) => (
                                        <tr key={k.key_id} className="border-t border-slate-100">
                                            <td className="px-4 py-2 font-mono text-xs">{k.prefix}</td>
                                            <td className="px-4 py-2">{k.environment}</td>
                                            <td className="px-4 py-2">{k.calls}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                    </div>
                </>
            )}
        </div>
    );
}
