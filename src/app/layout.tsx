import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Cloth Savvy — Brand portal",
    description: "Self-serve portal for Cloth Savvy API tenants (usage, keys, settings, catalog)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
