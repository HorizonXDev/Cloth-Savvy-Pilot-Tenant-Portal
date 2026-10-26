"use client";

import { useEffect, useState } from "react";
import { functionsUrl, portalFetch } from "@/lib/api";
import type { PortalAccount } from "@/lib/types";
import { Badge, Button, Card, Notice, PageTitle, TableWrap } from "@/components/ui";

interface Snippet {
    id: string;
    title: string;
    note: string;
    code: string;
}

/** API quickstart: everything a developer needs to make their first (and
 *  hundredth) call without leaving the portal — real base URL, real endpoint
 *  list, the actual error codes this API returns, and copyable snippets. */
export default function QuickstartPage() {
    const [account, setAccount] = useState<PortalAccount | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        portalFetch<PortalAccount>("/tenant_account")
            .then(setAccount)
            .catch(() => setAccount(null)); // the base URL below still works without it
    }, []);

    const base = functionsUrl();

    const snippets: Snippet[] = [
        {
            id: "health",
            title: "1 · Health check",
            note: "No key needed beyond the header — returns db and encoder status.",
            code: `curl -s ${base}/health \\
  -H "Authorization: Bearer sk_live_YOUR_KEY"`,
        },
        {
            id: "occasions",
            title: "2 · Your occasions",
            note: "The occasion list is yours — configured in your tenant settings, not hardcoded.",
            code: `curl -s ${base}/occasions \\
  -H "Authorization: Bearer sk_live_YOUR_KEY"`,
        },
        {
            id: "search",
            title: "3 · Semantic search",
            note: "No match is a 200 with items: [] and no_match: true — never an error.",
            code: `curl -s -X POST ${base}/search \\
  -H "Authorization: Bearer sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"blue cotton kurta","section":"top","limit":10}'`,
        },
        {
            id: "combos",
            title: "4 · Build a combo",
            note: "Sections come from your occasion recipe; 422 lists the valid occasions.",
            code: `curl -s -X POST ${base}/combos \\
  -H "Authorization: Bearer sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"occasion":"casual"}'`,
        },
        {
            id: "js",
            title: "JavaScript",
            note: "Same envelope on every endpoint: { request_id, … } or { error: {…} }.",
            code: `const res = await fetch("${base}/search", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + process.env.CLOTHSAVVY_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: "linen office shirt" }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error.message + " (" + data.error.request_id + ")");
console.log(data.items);`,
        },
    ];

    function copy(s: Snippet) {
        navigator.clipboard?.writeText(s.code).catch(() => {});
        setCopied(s.id);
        window.setTimeout(() => setCopied(null), 2500);
    }

    return (
        <div className="grid gap-6">
            <PageTitle eyebrow="developers" title="API quickstart" />

            <Card title="Base URL & authentication">
                <div className="grid gap-3 text-sm">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="label mb-0">Base</span>
                        <code className="mono rounded-lg bg-sunken px-2 py-1">{base}</code>
                        <Button
                            size="sm"
                            onClick={() => {
                                navigator.clipboard?.writeText(base).catch(() => {});
                                setCopied("base");
                                window.setTimeout(() => setCopied(null), 2500);
                            }}
                        >
                            {copied === "base" ? "Copied" : "Copy"}
                        </Button>
                    </div>
                    <p className="text-muted">
                        Every request carries{" "}
                        <code className="mono">Authorization: Bearer &lt;api key&gt;</code>. Keys are
                        prefixed <code className="mono">sk_live_</code> or{" "}
                        <code className="mono">sk_test_</code> — sandbox keys never touch live
                        traffic. The full key is shown exactly once, at creation.
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs">
                        <Badge tone="plain">rate limit: {account?.settings.rate_limit_per_min ?? "—"} / min per key</Badge>
                        <Badge tone="plain">currency: {account?.settings.currency ?? "not set"}</Badge>
                        <Badge tone="plain">model: {account?.embedding_model ?? "—"}</Badge>
                    </div>
                </div>
            </Card>

            <div className="grid gap-4">
                {snippets.map((s) => (
                    <Card
                        key={s.id}
                        title={s.title}
                        actions={
                            <Button size="sm" onClick={() => copy(s)}>
                                {copied === s.id ? "Copied" : "Copy"}
                            </Button>
                        }
                    >
                        <p className="mb-3 text-sm text-muted">{s.note}</p>
                        <pre className="mono overflow-x-auto rounded-lg border border-line bg-sunken p-3 text-xs leading-relaxed">
                            {s.code}
                        </pre>
                    </Card>
                ))}
            </div>

            <Card title="Endpoints">
                <TableWrap>
                    <thead>
                        <tr>
                            <th>Method</th>
                            <th>Path</th>
                            <th>What it does</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><Badge tone="ok">GET</Badge></td>
                            <td className="mono">/health</td>
                            <td>Service, database and encoder status</td>
                        </tr>
                        <tr>
                            <td><Badge tone="ok">GET</Badge></td>
                            <td className="mono">/occasions</td>
                            <td>Your occasion → sections recipes</td>
                        </tr>
                        <tr>
                            <td><Badge tone="warn">POST</Badge></td>
                            <td className="mono">/search</td>
                            <td>Semantic product search (query, section, limit, min_similarity, colors, max_price, in_stock_only)</td>
                        </tr>
                        <tr>
                            <td><Badge tone="warn">POST</Badge></td>
                            <td className="mono">/combos</td>
                            <td>Outfit combos for an occasion (occasion, gender, max_price, colors, style_notes)</td>
                        </tr>
                    </tbody>
                </TableWrap>
            </Card>

            <Card title="Error envelope">
                <p className="mb-3 text-sm text-muted">
                    Errors are always{" "}
                    <code className="mono">
                        {"{ error: { code, message, request_id } }"}
                    </code>
                    . Quote the <code className="mono">request_id</code> when you contact support.
                </p>
                <TableWrap>
                    <thead>
                        <tr>
                            <th>HTTP</th>
                            <th>code</th>
                            <th>Meaning</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>400</td><td className="mono">invalid_request</td><td>Bad or missing field — the message says which</td></tr>
                        <tr><td>401</td><td className="mono">unauthorized</td><td>Missing, malformed, revoked or wrong-environment key</td></tr>
                        <tr><td>403</td><td className="mono">forbidden</td><td>Key belongs to another tenant, or the tenant is suspended</td></tr>
                        <tr><td>422</td><td className="mono">unsupported_occasion</td><td>Unknown occasion — the message lists your valid ones</td></tr>
                        <tr><td>429</td><td className="mono">rate_limited</td><td>Over the per-key per-minute limit</td></tr>
                        <tr><td>500</td><td className="mono">internal</td><td>Unexpected — quote the request_id</td></tr>
                        <tr><td>502</td><td className="mono">upstream_llm</td><td>Language model unavailable</td></tr>
                        <tr><td>503</td><td className="mono">upstream_encoder</td><td>Embedding encoder unavailable — retry with backoff</td></tr>
                    </tbody>
                </TableWrap>
            </Card>

            <Notice>
                Catalog changes you make in this portal reach search as soon as they are merged by
                the embedding pipeline — single-product text edits re-embed immediately.
            </Notice>
        </div>
    );
}
