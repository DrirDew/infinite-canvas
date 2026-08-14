import type { CanvasGroupResolver, CanvasNode, CanvasRect, CanvasResizeCorner, Position } from "../types.js";

export function normalizeRect(start: Position, end: Position): CanvasRect {
    return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}

export function resizeNodeBounds(node: Pick<CanvasNode, "position" | "width" | "height">, corner: CanvasResizeCorner, delta: Position, keepRatio = false, ratio = node.width / node.height, minWidth = 24, minHeight = 24) {
    const fromLeft = corner.includes("left");
    const fromTop = corner.includes("top");
    const right = node.position.x + node.width;
    const bottom = node.position.y + node.height;
    let width = Math.max(minWidth, node.width + (fromLeft ? -delta.x : delta.x));
    let height = Math.max(minHeight, node.height + (fromTop ? -delta.y : delta.y));
    if (keepRatio) {
        if (Math.abs(delta.x) >= Math.abs(delta.y)) height = width / ratio;
        else width = height * ratio;
        if (height < minHeight) [width, height] = [minHeight * ratio, minHeight];
        if (width < minWidth) [width, height] = [minWidth, minWidth / ratio];
    }
    return { width, height, position: { x: fromLeft ? right - width : node.position.x, y: fromTop ? bottom - height : node.position.y } };
}

export function nodesInRect<T>(nodes: CanvasNode<T>[], rect: CanvasRect) {
    return nodes.filter((node) => rect.x < node.position.x + node.width && rect.x + rect.width > node.position.x && rect.y < node.position.y + node.height && rect.y + rect.height > node.position.y);
}

export function nodeBounds<T>(nodes: CanvasNode<T>[]) {
    return nodes.reduce(
        (acc, node) => ({ left: Math.min(acc.left, node.position.x), top: Math.min(acc.top, node.position.y), right: Math.max(acc.right, node.position.x + node.width), bottom: Math.max(acc.bottom, node.position.y + node.height) }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
}

export const isGroupNode = <T,>(node: CanvasNode<T>) => node.role === "group";

export function findGroupDropTarget<T>(movedIds: ReadonlySet<string>, nodes: CanvasNode<T>[], canGroupNode?: CanvasGroupResolver<T>) {
    if (nodes.some((node) => movedIds.has(node.id) && isGroupNode(node))) return null;
    const moving = nodes.filter((node) => movedIds.has(node.id) && !isGroupNode(node));
    if (!moving.length) return null;
    return (
        [...nodes].reverse().find(
            (group) =>
                isGroupNode(group) &&
                !movedIds.has(group.id) &&
                moving.some((node) => {
                    if (canGroupNode && !canGroupNode(node, group)) return false;
                    const x = node.position.x + node.width / 2;
                    const y = node.position.y + node.height / 2;
                    return x >= group.position.x && x <= group.position.x + group.width && y >= group.position.y && y <= group.position.y + group.height;
                }),
        ) || null
    );
}

export function snapNodesIntoGroup<T>(movedIds: ReadonlySet<string>, nodes: CanvasNode<T>[], group: CanvasNode<T>, padding = 24) {
    const moving = nodes.filter((node) => movedIds.has(node.id) && !isGroupNode(node));
    if (!moving.length) return nodes;
    const bounds = nodeBounds(moving);
    const [left, top, right, bottom] = [group.position.x + padding, group.position.y + padding, group.position.x + group.width - padding, group.position.y + group.height - padding];
    const dx = bounds.right - bounds.left > right - left ? left - bounds.left : bounds.left < left ? left - bounds.left : bounds.right > right ? right - bounds.right : 0;
    const dy = bounds.bottom - bounds.top > bottom - top ? top - bounds.top : bounds.top < top ? top - bounds.top : bounds.bottom > bottom ? bottom - bounds.bottom : 0;
    return nodes.map((node) => (!movedIds.has(node.id) || isGroupNode(node) ? node : { ...node, position: { x: node.position.x + dx, y: node.position.y + dy }, groupId: group.id }));
}

export function findContainingGroupId<T>(node: CanvasNode<T>, nodes: CanvasNode<T>[], canGroupNode?: CanvasGroupResolver<T>) {
    const x = node.position.x + node.width / 2;
    const y = node.position.y + node.height / 2;
    return [...nodes].reverse().find((group) => isGroupNode(group) && group.id !== node.id && (!canGroupNode || canGroupNode(node, group)) && x >= group.position.x && x <= group.position.x + group.width && y >= group.position.y && y <= group.position.y + group.height)?.id;
}

export function fitNodeSize(width: number, height: number, maxWidth = 640, maxHeight = 640) {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const scale = Math.min(1, maxWidth / w, maxHeight / h);
    return { width: w * scale, height: h * scale };
}

export function nodeSizeFromRatio(size: string, baseWidth: number, baseHeight: number) {
    const match = size?.match(/^(\d+)(?:x|:)(\d+)/);
    if (!match) return null;
    const ratio = Number(match[1]) / Math.max(1, Number(match[2]));
    if (ratio < 0.25 || ratio > 4) return { width: baseWidth, height: baseHeight };
    return ratio >= baseWidth / baseHeight ? { width: baseWidth, height: baseWidth / ratio } : { width: baseHeight * ratio, height: baseHeight };
}
