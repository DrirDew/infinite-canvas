import { CanvasNodeType, type BaseCanvasNodeMetadata, type CanvasConnectionDropTarget, type CanvasConnectionInteraction, type CanvasNode, type CanvasRect, type CanvasResizeCorner, type CanvasSize, type ConnectionHandle, type Position, type ViewportTransform } from "./types";

export function screenToCanvas(clientX: number, clientY: number, viewport: ViewportTransform, origin: Pick<DOMRect, "left" | "top"> = { left: 0, top: 0 }): Position {
    return { x: (clientX - origin.left - viewport.x) / viewport.k, y: (clientY - origin.top - viewport.y) / viewport.k };
}

export function canvasToScreen(position: Position, viewport: ViewportTransform, origin: Pick<DOMRect, "left" | "top"> = { left: 0, top: 0 }): Position {
    return { x: origin.left + viewport.x + position.x * viewport.k, y: origin.top + viewport.y + position.y * viewport.k };
}

export function normalizeRect(start: Position, end: Position): CanvasRect {
    return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}

export function resizeNodeBounds(node: Pick<CanvasNode, "position" | "width" | "height">, corner: CanvasResizeCorner, delta: Position, keepRatio = false, ratio = node.width / node.height, minWidth = 220, minHeight = 160) {
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

export function nodesInRect<T extends BaseCanvasNodeMetadata>(nodes: CanvasNode<T>[], rect: CanvasRect) {
    return nodes.filter((node) => rect.x < node.position.x + node.width && rect.x + rect.width > node.position.x && rect.y < node.position.y + node.height && rect.y + rect.height > node.position.y);
}

export function nodesInViewport<T extends BaseCanvasNodeMetadata>(nodes: CanvasNode<T>[], viewport: ViewportTransform, size: CanvasSize, padding = 0) {
    return nodesInRect(nodes, { x: -viewport.x / viewport.k - padding, y: -viewport.y / viewport.k - padding, width: size.width / viewport.k + padding * 2, height: size.height / viewport.k + padding * 2 });
}

export function nodeBounds<T extends BaseCanvasNodeMetadata>(nodes: CanvasNode<T>[]) {
    return nodes.reduce(
        (acc, node) => ({
            left: Math.min(acc.left, node.position.x),
            top: Math.min(acc.top, node.position.y),
            right: Math.max(acc.right, node.position.x + node.width),
            bottom: Math.max(acc.bottom, node.position.y + node.height),
        }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
}

export function findGroupDropTarget<T extends BaseCanvasNodeMetadata>(movedIds: Set<string>, nodes: CanvasNode<T>[]) {
    if (nodes.some((node) => movedIds.has(node.id) && node.type === CanvasNodeType.Group)) return null;
    const moving = nodes.filter((node) => movedIds.has(node.id) && node.type !== CanvasNodeType.Group);
    if (!moving.length) return null;
    return (
        [...nodes].reverse().find(
            (group) =>
                group.type === CanvasNodeType.Group &&
                !movedIds.has(group.id) &&
                moving.some((node) => {
                    const x = node.position.x + node.width / 2;
                    const y = node.position.y + node.height / 2;
                    return x >= group.position.x && x <= group.position.x + group.width && y >= group.position.y && y <= group.position.y + group.height;
                }),
        ) || null
    );
}

export function snapNodesIntoGroup<T extends BaseCanvasNodeMetadata>(movedIds: Set<string>, nodes: CanvasNode<T>[], group: CanvasNode<T>) {
    const moving = nodes.filter((node) => movedIds.has(node.id) && node.type !== CanvasNodeType.Group);
    if (!moving.length) return nodes;
    const bounds = nodeBounds(moving);
    const [left, top, right, bottom] = [group.position.x + 24, group.position.y + 24, group.position.x + group.width - 24, group.position.y + group.height - 24];
    const dx = bounds.right - bounds.left > right - left ? left - bounds.left : bounds.left < left ? left - bounds.left : bounds.right > right ? right - bounds.right : 0;
    const dy = bounds.bottom - bounds.top > bottom - top ? top - bounds.top : bounds.top < top ? top - bounds.top : bounds.bottom > bottom ? bottom - bounds.bottom : 0;
    return nodes.map((node) =>
        !movedIds.has(node.id) || node.type === CanvasNodeType.Group
            ? node
            : {
                  ...node,
                  position: { x: node.position.x + dx, y: node.position.y + dy },
                  metadata: { ...node.metadata, groupId: group.id } as T,
              },
    );
}

export function findContainingGroupId<T extends BaseCanvasNodeMetadata>(node: CanvasNode<T>, nodes: CanvasNode<T>[]) {
    const x = node.position.x + node.width / 2;
    const y = node.position.y + node.height / 2;
    return [...nodes].reverse().find((group) => group.type === CanvasNodeType.Group && group.id !== node.id && x >= group.position.x && x <= group.position.x + group.width && y >= group.position.y && y <= group.position.y + group.height)?.id;
}

export function getConnectionTargetAnchor<T extends BaseCanvasNodeMetadata>(node: CanvasNode<T>, current: ConnectionHandle) {
    return {
        x: current.handleType === "source" ? node.position.x : node.position.x + node.width,
        y: node.position.y + node.height / 2,
    };
}

export function getConnectionPath<T extends BaseCanvasNodeMetadata>(source: CanvasNode<T>, target?: CanvasNode<T>, interaction?: CanvasConnectionInteraction) {
    const start = interaction?.handle.handleType === "target" ? (target ? { x: target.position.x + target.width, y: target.position.y + target.height / 2 } : interaction.pointer) : { x: source.position.x + source.width, y: source.position.y + source.height / 2 };
    const end = interaction?.handle.handleType === "target" ? { x: source.position.x, y: source.position.y + source.height / 2 } : target ? { x: target.position.x, y: target.position.y + target.height / 2 } : interaction?.pointer || start;
    const curvature = interaction ? Math.abs(end.x - start.x) * 0.5 : Math.max(Math.abs(end.x - start.x) * 0.5, 50);
    return `M ${start.x} ${start.y} C ${start.x + curvature} ${start.y}, ${end.x - curvature} ${end.y}, ${end.x} ${end.y}`;
}

export function findConnectionDropTarget<T extends BaseCanvasNodeMetadata>(nodes: CanvasNode<T>[], current: ConnectionHandle, position: Position, scale = 1, handleRadius = 40, nodePadding = 32): CanvasConnectionDropTarget {
    const radius = handleRadius / Math.max(scale, 0.05);
    const padding = nodePadding / Math.max(scale, 0.05);
    let isNearNode = false;
    let nodeId: string | null = null;
    let priority = Infinity;
    [...nodes].reverse().forEach((node) => {
        const anchor = getConnectionTargetAnchor(node, current);
        const dx = position.x - anchor.x;
        const dy = position.y - anchor.y;
        const hitsHandle = dx * dx + dy * dy <= radius * radius;
        const hitsInside = position.x >= node.position.x && position.x <= node.position.x + node.width && position.y >= node.position.y && position.y <= node.position.y + node.height;
        const hitsExpanded = position.x >= node.position.x - padding && position.x <= node.position.x + node.width + padding && position.y >= node.position.y - padding && position.y <= node.position.y + node.height + padding;
        if (!hitsHandle && !hitsInside && !hitsExpanded) return;
        isNearNode = true;
        if (node.id === current.nodeId || !normalizeConnection(current.nodeId, node.id, nodes, current.handleType)) return;
        const nextPriority = hitsInside ? 0 : hitsHandle ? 1 : 2;
        if (nextPriority < priority) {
            nodeId = node.id;
            priority = nextPriority;
        }
    });
    return { nodeId, isNearNode };
}

export function normalizeConnection<T extends BaseCanvasNodeMetadata>(firstNodeId: string, secondNodeId: string, nodes: CanvasNode<T>[], firstHandleType: "source" | "target") {
    const first = nodes.find((node) => node.id === firstNodeId);
    const second = nodes.find((node) => node.id === secondNodeId);
    if (!first || !second || first.id === second.id || first.type === CanvasNodeType.Group || second.type === CanvasNodeType.Group || (first.type === CanvasNodeType.Config && second.type === CanvasNodeType.Config)) return null;
    if (second.type === CanvasNodeType.Config) return { fromNodeId: first.id, toNodeId: second.id };
    if (first.type === CanvasNodeType.Config && firstHandleType === "target") return { fromNodeId: second.id, toNodeId: first.id };
    return { fromNodeId: first.id, toNodeId: second.id };
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
