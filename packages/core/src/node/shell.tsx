import type { HTMLAttributes } from "react";
import type { CanvasNode } from "../types.js";

export type CanvasNodeShellProps<TMetadata = unknown> = HTMLAttributes<HTMLDivElement> & { node: CanvasNode<TMetadata> };

export function CanvasNodeShell<TMetadata>({ node, style, ...props }: CanvasNodeShellProps<TMetadata>) {
    return <div {...props} data-node-id={node.id} style={{ ...style, position: "absolute", transform: `translate(${node.position.x}px,${node.position.y}px)`, width: node.width, height: node.height, contain: "layout style" }} />;
}
