// lib/types.ts — response shapes of the tenant_* functions (mirrors).

export interface PortalAccount {
    request_id: string;
    user: { id: string; email: string };
    tenant: { id: string; slug: string; name: string; status: string };
    embedding_model: string;
    settings: PortalSettings;
}

export interface PortalSettings {
    currency: string | null;
    min_similarity: number;
    default_limit: number;
    rate_limit_per_min: number;
    combos: Record<string, string[]>;
}

export interface PortalKey {
    id: string;
    key_prefix: string;
    environment: "live" | "sandbox";
    label: string | null;
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
}

export interface PortalKeyList {
    request_id: string;
    keys: PortalKey[];
}

export interface PortalKeyIssued {
    request_id: string;
    plaintext: string;
    warning: string;
    key: PortalKey;
}

export interface PortalUsage {
    request_id: string;
    tenant_id: string;
    days: number;
    from: string;
    totals: { calls: number; units: number };
    month_to_date: { calls: number; units: number };
    currency: string | null;
    rate_limit_per_min: number;
    by_endpoint: Array<{
        endpoint: string;
        calls: number;
        units: number;
        codes: Record<string, number>;
    }>;
    by_key: Array<{ key_id: string; prefix: string; environment: string; calls: number }>;
    by_day: Array<{ day: string; calls: number }>;
    truncated: boolean;
}

export interface PortalProduct {
    id: string;
    external_id: string;
    title: string;
    section: string;
    category: string | null;
    gender: string | null;
    colors: string[] | null;
    price: string | number | null;
    in_stock: boolean;
    product_url: string | null;
    image_url: string | null;
    status: string;
    source: string;
    created_at: string;
    updated_at: string;
}

export interface PortalProducts {
    request_id: string;
    products: PortalProduct[];
    total: number;
    page: number;
    page_size: number;
}

export interface PortalRun {
    id: string;
    status: string;
    rows_total: number;
    rows_ok: number;
    rows_failed: number;
    started_at: string;
    finished_at: string | null;
    notes: string | null;
}

export interface PortalRuns {
    request_id: string;
    runs: PortalRun[];
}
