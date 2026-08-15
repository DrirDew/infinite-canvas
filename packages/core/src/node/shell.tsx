import type { HTMLAttributes } from "react";
import type { CanvasNode } from "../canvas/model.js";

/** Standard div attributes plus the node snapshot used for world positioning. */
export type CanvasNodeShellProps<TMetadata = unknown> = HTMLAttributes<HTMLDivElement> & { node: CanvasNode<TMetadata> };

/** Positions node content in world coordinates and exposes a stable node data marker. */
export function CanvasNodeShell<TMetadata>({ node, style, ...props }: CanvasNodeShellProps<TMetadata>) {
    return <div {...props} data-node-id={node.id} style={{ ...style, position: "absolute", transform: `translate(${node.position.x}px,${node.position.y}px)`, width: node.width, height: node.height, contain: "layout style" }} />;
}
