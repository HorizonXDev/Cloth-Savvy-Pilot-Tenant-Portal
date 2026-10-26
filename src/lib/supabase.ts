// lib/supabase.ts — browser Supabase Auth client (login only).
//
// SECURITY MODEL: the anon key here is PUBLIC BY DESIGN — the schema
// grants `anon` zero table privileges (proven by schema_audit / test T7),
// so this client can do nothing but authenticate (sign in / out / refresh)
// against GoTrue. It NEVER queries tables: all portal data flows through
// the tenant_* Edge Functions, which resolve the tenant from the server-
// side membership row keyed to this session's user id.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54421";
const SUPABASE_ANON_KEY: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
    if (!client) {
        if (!SUPABASE_ANON_KEY) {
            // Fail loudly at first use instead of silently misbehaving.
            throw new Error(
                "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set — copy .env.example to .env.local",
            );
        }
        client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        });
    }
    return client;
}
