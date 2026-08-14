import { canvasDefaults } from "../defaults.js";
import type { CanvasNode, CanvasSize, Position, ViewportTransform } from "../types.js";
import { nodesInRect } from "./nodes.js";

export const CANVAS_MIN_ZOOM = canvasDefaults.minZoom;
export const CANVAS_MAX_ZOOM = canvasDefaults.maxZoom;

export function screenToCanvas(clientX: number, clientY: number, viewport: ViewportTransform, origin: Pick<DOMRect, "left" | "top"> = { left: 0, top: 0 }): Position {
    return { x: (clientX - origin.left - viewport.x) / viewport.k, y: (clientY - origin.top - viewport.y) / viewport.k };
}

export function canvasToScreen(position: Position, viewport: ViewportTransform, origin: Pick<DOMRect, "left" | "top"> = { left: 0, top: 0 }): Position {
    return { x: origin.left + viewport.x + position.x * viewport.k, y: origin.top + viewport.y + position.y * viewport.k };
}

export function centerViewport(size: CanvasSize, k = 1): ViewportTransform {
    return { x: size.width / 2, y: size.height / 2, k };
}

export function zoomViewport(viewport: ViewportTransform, size: CanvasSize, scale: number, minZoom = CANVAS_MIN_ZOOM, maxZoom = CANVAS_MAX_ZOOM): ViewportTransform {
    return zoomViewportAtPoint(viewport, { x: size.width / 2, y: size.height / 2 }, scale, minZoom, maxZoom);
}

export function zoomViewportAtPoint(viewport: ViewportTransform, point: Position, scale: number, minZoom = CANVAS_MIN_ZOOM, maxZoom = CANVAS_MAX_ZOOM): ViewportTransform {
    const k = Math.min(Math.max(scale, minZoom), maxZoom);
    return { x: point.x - ((point.x - viewport.x) / viewport.k) * k, y: point.y - ((point.y - viewport.y) / viewport.k) * k, k };
}

export function fitViewportToNode<T>(node: CanvasNode<T>, size: CanvasSize, coverage = canvasDefaults.focusCoverage, minZoom = CANVAS_MIN_ZOOM, maxZoom = canvasDefaults.focusMaxZoom): ViewportTransform {
    const k = Math.min(Math.max(Math.min((size.width * coverage) / node.width, (size.height * coverage) / node.height), minZoom), maxZoom);
    return { x: size.width / 2 - (node.position.x + node.width / 2) * k, y: size.height / 2 - (node.position.y + node.height / 2) * k, k };
}

export function nodesInViewport<T>(nodes: CanvasNode<T>[], viewport: ViewportTransform, size: CanvasSize, padding = 0) {
    return nodesInRect(nodes, { x: -viewport.x / viewport.k - padding, y: -viewport.y / viewport.k - padding, width: size.width / viewport.k + padding * 2, height: size.height / viewport.k + padding * 2 });
}
