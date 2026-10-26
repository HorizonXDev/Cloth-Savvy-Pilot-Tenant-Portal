"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Session guard + brand rail for every portal page. No session → login;
// signed out mid-session (revoked/expired token) also lands on login, which
// is where a 403-on-revoke error should send the tenant.
const NAV = [
    { href: "/overview", label: "Overview" },
    { href: "/usage", label: "Usage & billing" },
    { href: "/keys", label: "API keys" },
    { href: "/catalog", label: "Catalog" },
    { href: "/quickstart", label: "API quickstart" },
    { href: "/settings", label: "Settings" },
];

function Brand({ compact = false }: { compact?: boolean }) {
    return (
        <div className="flex items-center gap-2.5">
            <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-lg bg-gold text-sm font-semibold text-bg"
            >
                CS
            </span>
            <span className="leading-tight">
                <span className={`display block ${compact ? "text-lg" : "text-xl"}`}>Cloth Savvy</span>
                <span className="eyebrow block text-[10px]">Brand portal</span>
            </span>
        </div>
    );
}

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
            <main className="grid min-h-screen place-items-center text-sm text-muted">
                checking session…
            </main>
        );
    }

    const nav = (className: string) =>
        NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
                <Link
                    key={item.href}
                    href={item.href}
                    className={
                        active
                            ? `${className} border-gold text-gold`
                            : `${className} border-transparent text-muted hover:text-ink`
                    }
                >
                    {item.label}
                </Link>
            );
        });

    return (
        <div className="min-h-screen lg:pl-60">
            {/* desktop rail */}
            <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-sunken lg:flex">
                <div className="border-b border-line px-5 py-5">
                    <Link href="/overview">
                        <Brand />
                    </Link>
                </div>
                <nav className="flex flex-1 flex-col gap-1 p-3">
                    {nav("rounded-lg border-l-2 px-3 py-2 text-sm transition-colors").map((link, i) => (
                        <div key={i}>{link}</div>
                    ))}
                </nav>
                <div className="border-t border-line p-4">
                    <p className="mb-3 truncate text-[11px] text-muted" title={email ?? ""}>
                        {email}
                    </p>
                    <button onClick={signOut} className="btn btn-ghost w-full text-sm">
                        Sign out
                    </button>
                </div>
            </aside>

            {/* mobile bar */}
            <header className="sticky top-0 z-20 border-b border-line bg-sunken/95 backdrop-blur lg:hidden">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <Link href="/overview">
                        <Brand compact />
                    </Link>
                    <button onClick={signOut} className="btn btn-ghost btn-sm">
                        Sign out
                    </button>
                </div>
                <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
                    {nav("rounded-full border px-3 py-1.5 text-sm whitespace-nowrap")}
                </nav>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">{children}</main>
        </div>
    );
}
