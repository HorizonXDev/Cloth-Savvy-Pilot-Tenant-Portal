// lib/api.ts — the single HTTP client for the tenant_* Edge Functions.
//
// SEPARATION (why this file contains no admin capability): only tenant_*
// paths exist here, and the only credential attached is the SESSION's
// access token from supabase-js. There is no ADMIN_TOKEN anywhere in this
// app — not in env, not in localStorage, not in code — so a tenant using
// this portal has no path to admin_* functions even in principle; and the
// admin_* functions would reject a session JWT anyway (verifyAdmin demands
// the shared secret). Conversely tenant_* routes never accept anything but
// a session — an API key or admin token presented here fails the GoTrue
// check with 401.
//
// Errors come back in the pilot envelope {error:{code,message,request_id}}
// and surface as ApiError so pages can show a precise, honest message.
// 401 from any call = the session is dead → the caller redirects to login.

import { supabase } from "./supabase";

const FUNCTIONS_URL: string =
    process.env.NEXT_PUBLIC_FUNCTIONS_URL ?? "http://127.0.0.1:54431/functions/v1";

export function functionsUrl(): string {
    return FUNCTIONS_URL.replace(/\/+$/, "");
}

export class ApiError extends Error {
    readonly status: number;
    readonly code: string;
    readonly requestId: string | null;

    constructor(status: number, code: string, message: string, requestId: string | null) {
        super(message);
        this.status = status;
        this.code = code;
        this.requestId = requestId;
    }
}

interface PortalFetchOpts {
    method?: "GET" | "POST" | "PATCH";
    body?: unknown;
}

/** Call a tenant_* function path (e.g. "/tenant_usage?days=7") with the
 * current session's access token. Returns parsed JSON or throws ApiError. */
export async function portalFetch<T = Record<string, unknown>>(
    path: string,
    opts: PortalFetchOpts = {},
): Promise<T> {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
        throw new ApiError(401, "no_session", "not signed in — please sign in again", null);
    }

    let res: Response;
    try {
        res = await fetch(`${functionsUrl()}${path}`, {
            method: opts.method ?? "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
    } catch (e) {
        throw new ApiError(
            0,
            "network",
            `cannot reach ${functionsUrl()} (${e instanceof Error ? e.message : "network error"})`,
            null,
        );
    }

    const text = await res.text();
    let parsed: unknown = null;
    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        parsed = null;
    }
    if (!res.ok) {
        const env = (parsed as { error?: { code?: string; message?: string; request_id?: string } } | null)
            ?.error;
        throw new ApiError(
            res.status,
            env?.code ?? `http_${res.status}`,
            env?.message ?? `request failed with HTTP ${res.status}`,
            env?.request_id ?? res.headers.get("X-Request-Id"),
        );
    }
    return parsed as T;
}
