import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import type { ComponentTheme } from "./types.js";

export type AgentPanelProps = {
    children: ReactNode;
    theme: ComponentTheme;
    open: boolean;
    mounted?: boolean;
    closing?: boolean;
    width: number;
    minWidth?: number;
    maxWidth?: number;
    motionMs?: number;
    resizeLabel?: string;
    onWidthChange: (width: number) => void;
    onWidthCommit?: (width: number) => void;
};

export function AgentPanel({ children, theme, open, mounted = true, closing = false, width, minWidth = 360, maxWidth = 760, motionMs = 220, resizeLabel = "调整 Agent 面板宽度", onWidthChange, onWidthCommit }: AgentPanelProps) {
    const [resizing, setResizing] = useState(false);
    const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = width;
        let nextWidth = width;
        const onMove = (moveEvent: PointerEvent) => {
            nextWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + startX - moveEvent.clientX));
            onWidthChange(nextWidth);
        };
        const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            setResizing(false);
            onWidthCommit?.(nextWidth);
        };
        setResizing(true);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    if (!mounted) return null;
    const transition = resizing ? "none" : `width ${motionMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${motionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    return <div className="relative z-[70] flex h-full shrink-0" style={{ width: open ? width + 1 : 0, opacity: open ? 1 : 0, overflow: "clip", pointerEvents: open && !closing ? undefined : "none", transition }}><aside className="relative flex h-full shrink-0 flex-col border-l" data-canvas-shortcuts-ignore style={{ width, transform: closing ? "translateX(28px)" : "translateX(0)", transition: resizing ? "none" : `transform ${motionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`, background: theme.node.panel, borderColor: theme.node.stroke, color: theme.node.text }}><button type="button" className="absolute inset-y-0 left-0 z-40 w-4 -translate-x-1/2 cursor-col-resize" onPointerDown={startResize} aria-label={resizeLabel} />{children}</aside></div>;
}
