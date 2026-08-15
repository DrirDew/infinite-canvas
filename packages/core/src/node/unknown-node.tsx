import type { CSSProperties, ReactNode } from "react";
import type { CanvasTheme } from "../theme.js";

/** Customizable content for the safe fallback shown for an unregistered node type. */
export type CanvasUnknownNodeProps = { type: string; theme: CanvasTheme; title?: ReactNode; description?: ReactNode; icon?: ReactNode; style?: CSSProperties };

/** Renders a theme-aware placeholder instead of failing on an unknown node type. */
export function CanvasUnknownNode({ type, theme, title = "Unknown node", description = `No renderer is registered for ${type}.`, icon, style }: CanvasUnknownNodeProps) {
    return (
        <div data-unknown-node-type={type} style={{ display: "flex", width: "100%", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, textAlign: "center", color: theme.node.placeholder, ...style }}>
            {icon}
            <span style={{ fontSize: 14 }}>{title}</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{description}</span>
        </div>
    );
}
