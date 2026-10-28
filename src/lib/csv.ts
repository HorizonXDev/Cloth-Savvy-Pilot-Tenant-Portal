// lib/csv.ts — CSV parsing + PRE-UPLOAD validation for the tenant's catalog
// wizard. The rules mirror supabase/functions/_pilot/import_row.ts (the one
// validator the API uses); they are duplicated here only so the tenant sees
// the problem BEFORE a byte leaves the browser, with the failing column named
// — the 2026-10-26 failure reported only "rows 2-11 lack external_id/title/
// section", which told the user nothing about which column was empty.
// The server stays authoritative: anything it rejects still comes back as a
// per-row failure with a reason.

/** The section enum, mirrored from _pilot/sections.ts (asserted identical by
 *  the backend's own tests — if you add a section there, add it here). */
export const SECTIONS = [
    "top", "bottom", "dress", "saree", "blouse", "dupatta", "outerwear",
    "footwear", "bag", "jewellery", "accessory",
] as const;

/** Which CSV header names are accepted for each logical field. */
const HEADER_ALIASES: Record<string, string[]> = {
    external_id: ["external_id", "sku", "id"],
    title: ["title", "name"],
    section: ["section"],
    category: ["category"],
    gender: ["gender"],
    colors: ["colors", "colours"],
    price: ["price"],
    in_stock: ["in_stock", "instock", "stock"],
    product_url: ["product_url", "url"],
    image_url: ["image_url", "image"],
};

/* ------------------------------- parsing -------------------------------- */

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    const pushField = () => {
        row.push(field);
        field = "";
    };
    const pushRow = () => {
        pushField();
        if (!(row.length === 1 && row[0] === "")) rows.push(row);
        row = [];
    };

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ",") {
            pushField();
        } else if (c === "\n") {
            pushRow();
        } else if (c === "\r") {
            // ignored; \r\n collapses via the \n branch
        } else {
            field += c;
        }
    }
    if (field !== "" || row.length > 0) pushRow();

    const headerRow = rows.shift() ?? [];
    return { headers: headerRow.map((h) => h.trim().toLowerCase()), rows };
}

/* ------------------------------ validation ------------------------------ */

export interface CsvIssue {
    /** 1-based index of the DATA row (header excluded) — the number the user
     *  sees in their spreadsheet. */
    row: number;
    column: string;
    value: string;
    reason: string;
}

export interface CsvReport {
    headers: string[];
    /** logical field -> the header column actually found for it */
    columnMap: Record<string, string>;
    /** required logical fields with no usable header at all */
    missingColumns: string[];
    /** rows that passed every rule, ready to send */
    good: Array<{ row: number; data: Record<string, unknown> }>;
    issues: CsvIssue[];
    /** invalid `section` values and how many rows used each (so the message
     *  can say "9 rows use 'layer' — not a valid section") */
    badSections: Record<string, number>;
    blankRows: number;
    /** rows that are valid but carry no image_url — they queue fine, yet the
     *  owner's pipeline cannot build a vector for them without a picture. */
    noImageUrl: string[];
}

const cell = (headers: string[], cells: string[], logical: string): string => {
    const aliases = HEADER_ALIASES[logical] ?? [logical];
    for (const a of aliases) {
        const i = headers.indexOf(a);
        if (i >= 0) {
            const v = (cells[i] ?? "").trim();
            if (v !== "") return v;
        }
    }
    return "";
};

/**
 * Validate a parsed CSV before upload. Never throws: the report always tells
 * the user exactly which column and which rows are wrong, and how many rows
 * are good to go.
 */
export function validateCsv(headers: string[], rows: string[][]): CsvReport {
    const columnMap: Record<string, string> = {};
    const missingColumns: string[] = [];

    for (const logical of Object.keys(HEADER_ALIASES)) {
        const found = HEADER_ALIASES[logical]
            .map((a) => headers.indexOf(a))
            .find((i) => i >= 0);
        if (found !== undefined && found >= 0) columnMap[logical] = headers[found];
    }
    for (const required of ["external_id", "title", "section"]) {
        if (!columnMap[required]) {
            missingColumns.push(
                required === "external_id"
                    ? "external_id (or sku / id)"
                    : required === "title"
                      ? "title (or name)"
                      : required,
            );
        }
    }

    const report: CsvReport = {
        headers,
        columnMap,
        missingColumns,
        good: [],
        issues: [],
        badSections: {},
        blankRows: 0,
        noImageUrl: [],
    };
    if (missingColumns.length > 0) return report;

    rows.forEach((cells, i) => {
        const rowNo = i + 2; // +2: header is line 1, i is 0-based
        if (!cells.some((c) => c.trim() !== "")) {
            report.blankRows++;
            return;
        }

        const data: Record<string, unknown> = {};
        const fail = (column: string, value: string, reason: string) =>
            report.issues.push({ row: rowNo, column, value, reason });

        // --- the three required fields, each named individually
        const external_id = cell(headers, cells, "external_id");
        if (!external_id) {
            fail("external_id", "", "empty — every product needs a unique SKU");
        } else if (external_id.length > 200) {
            fail("external_id", external_id.slice(0, 40), "longer than 200 characters");
        }

        const title = cell(headers, cells, "title");
        if (!title) {
            fail("title", "", "empty — the title is required (it is shown in results and matched by text search)");
        } else if (title.length > 300) {
            fail("title", title.slice(0, 40), "longer than 300 characters");
        }

        const section = cell(headers, cells, "section");
        if (!section) {
            fail("section", "", "empty — must be one of the allowed sections");
        } else if (!(SECTIONS as readonly string[]).includes(section.toLowerCase())) {
            report.badSections[section] = (report.badSections[section] ?? 0) + 1;
            fail(
                "section",
                section,
                `not an allowed section (allowed: ${SECTIONS.join(", ")})`,
            );
        }

        if (report.issues.some((x) => x.row === rowNo)) return; // row already broken

        data.external_id = external_id;
        data.title = title;
        data.section = section.toLowerCase();

        // --- optional fields (only forwarded when present)
        const category = cell(headers, cells, "category");
        if (category) {
            if (category.length > 100) return fail("category", category.slice(0, 40), "longer than 100 characters");
            data.category = category;
        }
        const gender = cell(headers, cells, "gender");
        if (gender) data.gender = gender;

        const colors = cell(headers, cells, "colors");
        if (colors) {
            const list = colors.split(/[;|]/).map((c) => c.trim()).filter(Boolean);
            if (list.length > 10) return fail("colors", colors.slice(0, 40), "more than 10 colours");
            data.colors = list.map((c) => c.toLowerCase());
        }

        const price = cell(headers, cells, "price");
        if (price) {
            const n = Number(price.replace(/[, ]/g, ""));
            if (!Number.isFinite(n) || n < 0) {
                return fail("price", price.slice(0, 20), "not a positive number");
            }
            data.price = n;
        }

        const inStock = cell(headers, cells, "in_stock");
        if (inStock) data.in_stock = ["true", "1", "yes", "y"].includes(inStock.toLowerCase());

        const product_url = cell(headers, cells, "product_url");
        if (product_url) data.product_url = product_url;
        const image_url = cell(headers, cells, "image_url");
        if (image_url) data.image_url = image_url;

        if (!data.image_url) report.noImageUrl.push(external_id);
        report.good.push({ row: rowNo, data });
    });

    return report;
}

/** Group issues by column so the report can say "title: 40 rows empty". */
export function issuesByColumn(issues: CsvIssue[]): Array<{ column: string; count: number; sample: CsvIssue }> {
    const map = new Map<string, { count: number; sample: CsvIssue }>();
    for (const issue of issues) {
        const cur = map.get(issue.column);
        if (cur) cur.count++;
        else map.set(issue.column, { count: 1, sample: issue });
    }
    return [...map.entries()].map(([column, v]) => ({ column, ...v }));
}

/* ------------------------------- writing CSV ----------------------------- */
// Same RFC-4180 rules as the admin console's copy: a cell with a comma,
// quote or newline is quoted, quotes are doubled, and a UTF-8 BOM is prepended
// so Excel opens Indian product names instead of question marks.

export function csvCell(value: unknown): string {
    if (value === null || value === undefined) return "";
    const s = Array.isArray(value) ? value.join("; ") : String(value);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
    const lines = [headers.map(csvCell).join(",")];
    for (const row of rows) lines.push(row.map(csvCell).join(","));
    return lines.join("\r\n") + "\r\n";
}

/** Build the file and hand it to the browser — nothing leaves the page. */
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
    const blob = new Blob(["\uFEFF" + toCsv(headers, rows)], {
        type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
