import { useMemo, type MouseEvent, type SVGAttributes } from "react";
import { canvasDefaults } from "./defaults.js";
import { getConnectionPath } from "./geometry.js";
import type { CanvasTheme } from "./theme.js";
import type { CanvasConnection, CanvasConnectionInteraction, CanvasNode } from "./types.js";

export type CanvasConnectionStyle = Pick<SVGAttributes<SVGPathElement>, "stroke" | "strokeWidth" | "strokeOpacity" | "strokeDasharray" | "style">;

export type CanvasConnectionLayerProps<TMetadata = unknown> = {
    nodes: CanvasNode<TMetadata>[];
    connections: CanvasConnection[];
    interaction?: CanvasConnectionInteraction | null;
    selectedConnectionId?: string | null;
    activeConnectionIds?: ReadonlySet<string>;
    theme: CanvasTheme;
    resolvePath?: (source: CanvasNode<TMetadata>, target?: CanvasNode<TMetadata>, interaction?: CanvasConnectionInteraction) => string;
    resolveStyle?: (connection: CanvasConnection, active: boolean) => CanvasConnectionStyle;
    previewStyle?: CanvasConnectionStyle;
    hitStrokeWidth?: number;
    onConnectionSelect?: (connection: CanvasConnection) => void;
    onConnectionContextMenu?: (event: MouseEvent<SVGPathElement>, connection: CanvasConnection) => void;
};

export function CanvasConnectionLayer<TMetadata>({ nodes, connections, interaction, selectedConnectionId, activeConnectionIds, theme, resolvePath = getConnectionPath, resolveStyle, previewStyle, hitStrokeWidth = canvasDefaults.connectionStrokeHitWidth, onConnectionSelect, onConnectionContextMenu }: CanvasConnectionLayerProps<TMetadata>) {
    const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
    const source = interaction ? byId.get(interaction.handle.nodeId) : undefined;
    const target = interaction?.targetNodeId ? byId.get(interaction.targetNodeId) : undefined;
    return (
        <svg style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "visible", pointerEvents: "none", transform: "translateZ(0)", zIndex: 0 }}>
            {connections.map((connection) => {
                const from = byId.get(connection.fromNodeId);
                const to = byId.get(connection.toNodeId);
                if (!from || !to) return null;
                const path = resolvePath(from, to);
                const active = selectedConnectionId === connection.id || Boolean(activeConnectionIds?.has(connection.id));
                const style = resolveStyle?.(connection, active) || { stroke: active ? theme.node.activeStroke : theme.node.muted, strokeWidth: active ? 3 : 2, strokeOpacity: active ? 1 : 0.82, style: { filter: active ? `drop-shadow(0 0 8px ${theme.node.activeStroke}66)` : undefined } };
                return (
                    <g key={connection.id}>
                        <path
                            data-connection-id={connection.id}
                            d={path}
                            stroke="transparent"
                            strokeWidth={hitStrokeWidth}
                            fill="none"
                            style={{ cursor: "pointer", pointerEvents: "stroke" }}
                            onClick={(event) => {
                                event.stopPropagation();
                                onConnectionSelect?.(connection);
                            }}
                            onContextMenu={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onConnectionContextMenu?.(event, connection);
                            }}
                        />
                        <path d={path} fill="none" {...style} style={{ ...style.style, pointerEvents: "none" }} />
                    </g>
                );
            })}
            {interaction && source ? <path d={resolvePath(source, target, interaction)} fill="none" stroke={theme.node.activeStroke} strokeWidth={2} strokeDasharray="5,5" {...previewStyle} /> : null}
        </svg>
    );
}
