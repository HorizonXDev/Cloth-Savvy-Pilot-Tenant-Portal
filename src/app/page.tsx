"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        supabase()
            .auth.getSession()
            .then(({ data }) => router.replace(data.session ? "/overview" : "/login"));
    }, [router]);

    return (
        <main className="flex min-h-screen items-center justify-center text-sm text-slate-400">
            loading…
        </main>
    );
}
