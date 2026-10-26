"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Notice } from "@/components/ui";

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
        <main className="grid min-h-screen place-items-center px-4 py-10">
            <div className="w-full max-w-md">
                <div className="mb-7 flex flex-col items-center gap-3 text-center">
                    <span
                        aria-hidden
                        className="grid h-12 w-12 place-items-center rounded-xl bg-gold text-lg font-semibold text-bg"
                    >
                        CS
                    </span>
                    <div>
                        <p className="eyebrow mb-1">Tenant portal</p>
                        <h1 className="display text-3xl">Cloth Savvy</h1>
                    </div>
                </div>

                <form onSubmit={submit} className="card card-pad grid gap-4">
                    <p className="text-sm text-muted">
                        Sign in with the portal login your account manager created for you. No
                        account yet? Contact your Cloth Savvy representative — logins are issued
                        by the admin, never self-registered.
                    </p>

                    <label className="block">
                        <span className="label">Email</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@brand.com"
                            autoFocus
                            autoComplete="email"
                            className="input"
                        />
                    </label>

                    <label className="block">
                        <span className="label">Password</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            className="input"
                        />
                    </label>

                    {error && <Notice tone="error">{error}</Notice>}

                    <button type="submit" disabled={busy} className="btn btn-primary w-full">
                        {busy ? "Signing in…" : "Sign in"}
                    </button>
                </form>

                <p className="mt-5 text-center text-xs text-muted">
                    This portal can only reach tenant endpoints — admin functions live on a
                    different origin and reject these credentials.
                </p>
            </div>
        </main>
    );
}
