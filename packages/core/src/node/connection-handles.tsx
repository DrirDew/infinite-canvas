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
    sourceHandleId?: string;
    targetHandleId?: string;
    hitSize?: number;
    offset?: number;
    indicatorSize?: number;
    renderHandle?: (handleType: "source" | "target") => ReactNode;
    onConnectStart: (event: PointerEvent, nodeId: string, handleType: "source" | "target", handleId?: string) => void;
};

/** Renders scale-independent source and target hit areas on a node. */
export function CanvasNodeConnectionHandles({ nodeId, visible, theme, source = true, target = true, sourceHandleId, targetHandleId, hitSize = canvasDefaults.connectionPortHitSize, offset = canvasDefaults.connectionPortOffset, indicatorSize = canvasDefaults.connectionPortIndicatorSize, renderHandle, onConnectStart }: CanvasNodeConnectionHandlesProps) {
    hitSize = Math.max(0, hitSize);
    indicatorSize = Math.max(0, indicatorSize);
    return (
        <>
            {target ? <CanvasNodeConnectionHandle side="left" handleType="target" handleId={targetHandleId} visible={visible} theme={theme} hitSize={hitSize} offset={offset} indicatorSize={indicatorSize} renderHandle={renderHandle} onPointerDown={(event) => onConnectStart(event, nodeId, "target", targetHandleId)} /> : null}
            {source ? <CanvasNodeConnectionHandle side="right" handleType="source" handleId={sourceHandleId} visible={visible} theme={theme} hitSize={hitSize} offset={offset} indicatorSize={indicatorSize} renderHandle={renderHandle} onPointerDown={(event) => onConnectStart(event, nodeId, "source", sourceHandleId)} /> : null}
        </>
    );
}

/** Renders one side-specific connection hit area without owning connection state. */
function CanvasNodeConnectionHandle({ side, handleType, handleId, visible, theme, hitSize, offset, indicatorSize, renderHandle, onPointerDown }: { side: "left" | "right"; handleType: "source" | "target"; handleId?: string; visible: boolean; theme: CanvasTheme; hitSize: number; offset: number; indicatorSize: number; renderHandle?: CanvasNodeConnectionHandlesProps["renderHandle"]; onPointerDown: (event: PointerEvent) => void }) {
    return (
        <div
            data-connection-handle={side === "left" ? "target" : "source"}
            data-connection-handle-id={handleId}
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
