import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// The same three families as the marketing site (Cloth-Savvy-Web/layout.tsx)
// and the admin console: a tenant logging in should feel the same product, but
// this app never shares code with the console — separate project, separate
// origin, separate bundle.
const display = Cormorant_Garamond({
    variable: "--font-display",
    subsets: ["latin"],
    weight: ["300", "400", "500"],
    display: "swap",
});
const sans = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({
    variable: "--font-mono",
    subsets: ["latin"],
    weight: ["400", "500"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "Cloth Savvy — Brand portal",
    description: "Self-serve portal for Cloth Savvy API tenants (usage, keys, catalog, settings)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
            <body>{children}</body>
        </html>
    );
}
