"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const NAV = [
    { href: "/overview", label: "Overview" },
    { href: "/keys", label: "API keys" },
    { href: "/settings", label: "Settings" },
    { href: "/catalog", label: "Catalog" },
];

/** Session guard + nav shell for every portal page. No session → login.
 *  Signed out mid-session (revoked/expired) → also back to login: the
 *  403-on-revoke path lands here through portalFetch errors. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [ready, setReady] = useState(false);
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        supabase()
            .auth.getSession()
            .then(({ data }) => {
                if (!data.session) {
                    router.replace("/login");
                    return;
                }
                setEmail(data.session.user.email ?? null);
                setReady(true);
            });
    }, [router]);

    async function signOut() {
        await supabase().auth.signOut();
        router.replace("/login");
    }

    if (!ready) {
        return (
            <main className="flex min-h-screen items-center justify-center text-sm text-slate-400">
                loading…
            </main>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
                    <span className="font-semibold">Brand portal</span>
                    <nav className="flex flex-1 gap-4">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`text-sm ${
                                    pathname.startsWith(item.href)
                                        ? "font-medium text-slate-900 underline underline-offset-4"
                                        : "text-slate-500 hover:text-slate-900"
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    {email && <span className="hidden text-xs text-slate-400 sm:block">{email}</span>}
                    <button
                        onClick={signOut}
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                        Sign out
                    </button>
                </div>
            </header>
            <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </div>
    );
}
