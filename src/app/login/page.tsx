"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim() || !password) {
            setError("enter your email and password");
            return;
        }
        setBusy(true);
        setError(null);
        const { error: signInErr } = await supabase().auth.signInWithPassword({
            email: email.trim(),
            password,
        });
        if (signInErr) {
            setError(
                signInErr.message === "Invalid login credentials"
                    ? "wrong email or password"
                    : signInErr.message,
            );
            setBusy(false);
            return;
        }
        router.replace("/overview");
    }

    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
            <h1 className="mb-1 text-2xl font-semibold">Brand portal</h1>
            <p className="mb-6 text-sm text-slate-500">
                Cloth Savvy API — sign in with the login your account manager created for you.
                No account? Contact your Cloth Savvy representative.
            </p>
            <form onSubmit={submit} className="flex flex-col gap-3">
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@brand.com"
                    autoFocus
                    autoComplete="email"
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                    type="submit"
                    disabled={busy}
                    className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                    {busy ? "Signing in…" : "Sign in"}
                </button>
                {error && (
                    <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </p>
                )}
            </form>
        </main>
    );
}
