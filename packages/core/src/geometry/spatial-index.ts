import type { CanvasNode, CanvasRect } from "../canvas/model.js";

/** Default world-space cell size used to partition large canvas documents. */
export const CANVAS_SPATIAL_INDEX_CELL_SIZE = 512;
/** Node count below which a direct scan is generally cheaper than querying an index. */
export const CANVAS_SPATIAL_INDEX_THRESHOLD = 128;

/** Prevents one exceptionally large group node from expanding into millions of cells. */
const MAX_NODE_CELLS = 4096;
/** Falls back to a linear scan when a query covers most of the canvas world. */
const MAX_QUERY_CELLS = 16384;
/** Weak keys allow discarded immutable node snapshots and their indexes to be collected together. */
const indexCache = new WeakMap<object, CanvasNodeSpatialIndex<unknown>>();

/** Returns whether a node overlaps an axis-aligned world rectangle. */
export function nodeIntersectsRect<TMetadata>(node: CanvasNode<TMetadata>, rect: CanvasRect) {
    return rect.x < node.position.x + node.width && rect.x + rect.width > node.position.x && rect.y < node.position.y + node.height && rect.y + rect.height > node.position.y;
}

/**
 * A uniform-grid index for repeated viewport, marquee, and pointer hit queries.
 * Query results preserve the document's node order so z-order behavior stays stable.
 */
export class CanvasNodeSpatialIndex<TMetadata = unknown> {
    private readonly cells = new Map<string, number[]>();
    private readonly largeNodeIndexes: number[] = [];
    private readonly nodeById = new Map<string, CanvasNode<TMetadata>>();

    public constructor(
        private readonly nodes: readonly CanvasNode<TMetadata>[],
        private readonly cellSize = CANVAS_SPATIAL_INDEX_CELL_SIZE,
    ) {
        nodes.forEach((node, index) => {
            this.nodeById.set(node.id, node);
            const [left, right, top, bottom] = this.cellBounds(node.position.x, node.position.y, node.width, node.height);
            if ((right - left + 1) * (bottom - top + 1) > MAX_NODE_CELLS) return void this.largeNodeIndexes.push(index);
            for (let x = left; x <= right; x++) {
                for (let y = top; y <= bottom; y++) {
                    const key = `${x}:${y}`;
                    const indexes = this.cells.get(key);
                    if (indexes) indexes.push(index);
                    else this.cells.set(key, [index]);
                }
            }
        });
    }

    /** Returns a node by ID without scanning the document array. */
    public get(nodeId: string) {
        return this.nodeById.get(nodeId);
    }

    /** Returns nodes intersecting a world rectangle in their original z-order. */
    public query(rect: CanvasRect) {
        const indexes = new Set(this.largeNodeIndexes);
        const [left, right, top, bottom] = this.cellBounds(rect.x, rect.y, rect.width, rect.height);
        if ((right - left + 1) * (bottom - top + 1) > MAX_QUERY_CELLS) return this.nodes.filter((node) => nodeIntersectsRect(node, rect));
        for (let x = left; x <= right; x++) {
            for (let y = top; y <= bottom; y++) this.cells.get(`${x}:${y}`)?.forEach((index) => indexes.add(index));
        }
        return [...indexes].sort((first, second) => first - second).flatMap((index) => {
            const node = this.nodes[index];
            return node && nodeIntersectsRect(node, rect) ? [node] : [];
        });
    }

    /** Converts a rectangle to inclusive grid coordinates. */
    private cellBounds(x: number, y: number, width: number, height: number) {
        const size = Math.max(1, this.cellSize);
        return [Math.floor(x / size), Math.floor((x + width) / size), Math.floor(y / size), Math.floor((y + height) / size)] as const;
    }
}

/** Returns the spatial index cached for an immutable node-array snapshot. */
export function getCanvasNodeSpatialIndex<TMetadata>(nodes: readonly CanvasNode<TMetadata>[]) {
    let index = indexCache.get(nodes);
    if (!index) {
        index = new CanvasNodeSpatialIndex(nodes);
        indexCache.set(nodes, index);
    }
    return index as CanvasNodeSpatialIndex<TMetadata>;
}
