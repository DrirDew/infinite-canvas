import type { PointerEvent, ReactNode } from "react";
import { canvasDefaults } from "../defaults.js";
import type { CanvasTheme } from "../theme.js";

/** Layout, visibility, rendering, and pointer options for node connection handles. */
export type CanvasNodeConnectionHandlesProps = {
    nodeId: string;
    visible: boolean;
    theme: CanvasTheme;
    source?: boolean;
    target?: boolean;
    hitSize?: number;
    offset?: number;
    indicatorSize?: number;
    renderHandle?: (handleType: "source" | "target") => ReactNode;
    onConnectStart: (event: PointerEvent, nodeId: string, handleType: "source" | "target") => void;
};

/** Renders scale-independent source and target hit areas on a node. */
export function CanvasNodeConnectionHandles({ nodeId, visible, theme, source = true, target = true, hitSize = canvasDefaults.connectionPortHitSize, offset = canvasDefaults.connectionPortOffset, indicatorSize = canvasDefaults.connectionPortIndicatorSize, renderHandle, onConnectStart }: CanvasNodeConnectionHandlesProps) {
    hitSize = Math.max(0, hitSize);
    indicatorSize = Math.max(0, indicatorSize);
    return (
        <>
            {target ? <CanvasNodeConnectionHandle side="left" handleType="target" visible={visible} theme={theme} hitSize={hitSize} offset={offset} indicatorSize={indicatorSize} renderHandle={renderHandle} onPointerDown={(event) => onConnectStart(event, nodeId, "target")} /> : null}
            {source ? <CanvasNodeConnectionHandle side="right" handleType="source" visible={visible} theme={theme} hitSize={hitSize} offset={offset} indicatorSize={indicatorSize} renderHandle={renderHandle} onPointerDown={(event) => onConnectStart(event, nodeId, "source")} /> : null}
        </>
    );
}

function CanvasNodeConnectionHandle({ side, handleType, visible, theme, hitSize, offset, indicatorSize, renderHandle, onPointerDown }: { side: "left" | "right"; handleType: "source" | "target"; visible: boolean; theme: CanvasTheme; hitSize: number; offset: number; indicatorSize: number; renderHandle?: CanvasNodeConnectionHandlesProps["renderHandle"]; onPointerDown: (event: PointerEvent) => void }) {
    return (
        <div
            data-connection-handle={side === "left" ? "target" : "source"}
            style={{ position: "absolute", top: "50%", [side]: -offset, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", width: hitSize, height: hitSize, cursor: "crosshair", touchAction: "none", opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none", transform: "translateY(-50%)", transition: "opacity 150ms" }}
            onPointerDown={(event) => {
                event.stopPropagation();
                if (event.button !== 0) return;
                onPointerDown(event);
            }}
        >
            {renderHandle?.(handleType) ?? <div style={{ width: indicatorSize, height: indicatorSize, border: `2px solid ${theme.node.muted}`, borderRadius: "50%", background: theme.node.panel }} />}
        </div>
    );
}
