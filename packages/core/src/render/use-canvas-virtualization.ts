import { useMemo } from "react";
import { canvasDefaults } from "../defaults.js";
import { nodesInViewport } from "../geometry.js";
import type { CanvasNode, CanvasSize, ViewportTransform } from "../types.js";

/** The viewport-local nodes and IDs used to limit heavy node and connection DOM. */
export type CanvasVirtualizationResult<TMetadata = unknown> = { visibleNodes: readonly CanvasNode<TMetadata>[]; visibleNodeIds: ReadonlySet<string> };

/**
 * Derives viewport-local nodes from the cached spatial index and returns stable results until
 * the document, viewport, container size, or padding changes.
 */
export function useCanvasVirtualization<TMetadata>(nodes: readonly CanvasNode<TMetadata>[], viewport: ViewportTransform, size: CanvasSize, padding = canvasDefaults.virtualizationPadding): CanvasVirtualizationResult<TMetadata> {
    const visibleNodes = useMemo(() => nodesInViewport(nodes, viewport, size, padding), [nodes, padding, size.height, size.width, viewport.k, viewport.x, viewport.y]);
    const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
    return { visibleNodes, visibleNodeIds };
}
