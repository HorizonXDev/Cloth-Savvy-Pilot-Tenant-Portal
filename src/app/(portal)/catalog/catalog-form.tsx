"use client";

import { useState } from "react";
import { SECTIONS } from "@/lib/csv";
import { Button, Field, Notice } from "@/components/ui";

/** The editable shape of a catalog row — used for BOTH a live product
 *  (product_update) and a queued staging row (stage_update), because they
 *  carry the same fields and must obey the same rules. */
export interface FormValues {
    title: string;
    section: string;
    category: string;
    gender: string;
    colors: string; // semicolon-separated in the form, array on the wire
    price: string;
    in_stock: boolean;
    product_url: string;
    image_url: string;
    status: "active" | "archived";
}

/** `object` rather than a Record so a generated interface (PortalProduct) or
 *  the staging `payload` can both be passed without an index signature. */
export function toFormValues(source: object): FormValues {
    const s = source as Record<string, unknown>;
    const arr = Array.isArray(s.colors) ? (s.colors as string[]) : [];
    const price = s.price;
    return {
        title: typeof s.title === "string" ? s.title : "",
        section: typeof s.section === "string" ? s.section : "",
        category: typeof s.category === "string" ? s.category : "",
        gender: typeof s.gender === "string" ? s.gender : "",
        colors: arr.join("; "),
        price: price === null || price === undefined || price === "" ? "" : String(price),
        in_stock: s.in_stock !== false,
        product_url: typeof s.product_url === "string" ? s.product_url : "",
        image_url: typeof s.image_url === "string" ? s.image_url : "",
        status: s.status === "archived" ? "archived" : "active",
    };
}

/** Client-side check that mirrors the server rules, so the tenant is told
 *  about a bad title or section before a round trip. */
export function validateForm(v: FormValues): string | null {
    if (!v.title.trim()) return "title is required — it is the text that gets embedded";
    if (v.title.trim().length > 300) return "title must be at most 300 characters";
    if (!v.section) return "section is required";
    if (!(SECTIONS as readonly string[]).includes(v.section)) {
        return `section must be one of: ${SECTIONS.join(", ")}`;
    }
    if (v.price.trim() !== "") {
        const n = Number(v.price.replace(/[, ]/g, ""));
        if (!Number.isFinite(n) || n < 0) return "price must be a positive number";
    }
    return null;
}

export function toPayload(v: FormValues): Record<string, unknown> {
    return {
        title: v.title.trim(),
        section: v.section,
        category: v.category.trim() || null,
        gender: v.gender.trim() || null,
        colors: v.colors
            .split(/[;|]/)
            .map((c) => c.trim().toLowerCase())
            .filter(Boolean),
        price: v.price.trim() === "" ? null : Number(v.price.replace(/[, ]/g, "")),
        in_stock: v.in_stock,
        product_url: v.product_url.trim() || null,
        image_url: v.image_url.trim() || null,
        status: v.status,
    };
}

/** The shared fields. On submit the caller receives the validated payload. */
export default function CatalogForm({
    initial,
    submitLabel,
    onSubmit,
    onCancel,
    extraNote,
}: {
    initial: FormValues;
    submitLabel: string;
    onSubmit: (payload: Record<string, unknown>) => Promise<void>;
    onCancel: () => void;
    extraNote?: string;
}) {
    const [value, setValue] = useState<FormValues>(initial);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
        setValue((s) => ({ ...s, [k]: v }));

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const problem = validateForm(value);
        if (problem) {
            setError(problem);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await onSubmit(toPayload(value));
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setBusy(false);
            return;
        }
        setBusy(false);
    }

    return (
        <form onSubmit={submit} className="grid gap-4">
            {error && <Notice tone="error">{error}</Notice>}
            {extraNote && <Notice>{extraNote}</Notice>}

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title" hint="embedded for search — the words a shopper would type">
                    <input
                        className="input"
                        value={value.title}
                        onChange={(e) => set("title", e.target.value)}
                        maxLength={300}
                    />
                </Field>
                <Field label="Section">
                    <select
                        className="input"
                        value={value.section}
                        onChange={(e) => set("section", e.target.value)}
                    >
                        <option value="">choose…</option>
                        {SECTIONS.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Category">
                    <input
                        className="input"
                        value={value.category}
                        onChange={(e) => set("category", e.target.value)}
                        maxLength={100}
                    />
                </Field>
                <Field label="Gender">
                    <input
                        className="input"
                        value={value.gender}
                        onChange={(e) => set("gender", e.target.value)}
                        maxLength={40}
                    />
                </Field>
                <Field label="Colours" hint="semicolon-separated — e.g. indigo; gold">
                    <input
                        className="input"
                        value={value.colors}
                        onChange={(e) => set("colors", e.target.value)}
                    />
                </Field>
                <Field label="Price">
                    <input
                        className="input"
                        value={value.price}
                        inputMode="decimal"
                        onChange={(e) => set("price", e.target.value)}
                    />
                </Field>
                <Field label="Product URL">
                    <input
                        className="input"
                        value={value.product_url}
                        onChange={(e) => set("product_url", e.target.value)}
                    />
                </Field>
                <Field label="Image URL">
                    <input
                        className="input"
                        value={value.image_url}
                        onChange={(e) => set("image_url", e.target.value)}
                    />
                </Field>
            </div>

            <div className="flex flex-wrap items-center gap-5">
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={value.in_stock}
                        onChange={(e) => set("in_stock", e.target.checked)}
                    />
                    In stock
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="radio"
                        name="status"
                        checked={value.status === "active"}
                        onChange={() => set("status", "active")}
                    />
                    Active (visible to search)
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="radio"
                        name="status"
                        checked={value.status === "archived"}
                        onChange={() => set("status", "archived")}
                    />
                    Archived (hidden from search)
                </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="primary" busy={busy}>
                    {submitLabel}
                </Button>
                <Button type="button" onClick={onCancel} disabled={busy}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}
