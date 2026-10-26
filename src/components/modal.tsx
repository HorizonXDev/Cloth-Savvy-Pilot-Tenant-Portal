"use client";

import type { ReactNode } from "react";

/** A small branded dialog for the portal's edit/confirm flows (
 *  the admin console has its own delete dialog with extra steps). Closes on
 *  backdrop click and on Escape — a dialog you cannot dismiss by accident. */
export default function Modal({
    title,
    onClose,
    children,
    wide = false,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    wide?: boolean;
}) {
    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
            onClick={onClose}
            onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
            }}
            role="presentation"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
                className={`card card-pad my-8 w-full ${wide ? "max-w-3xl" : "max-w-xl"}`}
            >
                <header className="mb-4 flex items-center justify-between gap-4 border-b border-line pb-3">
                    <h3 className="display text-xl">{title}</h3>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="btn btn-ghost btn-sm"
                    >
                        Close
                    </button>
                </header>
                {children}
            </div>
        </div>
    );
}
