import type { CanvasConnectionResolver } from "@infinite-canvas/core";
import { CanvasNodeType, type CanvasNodeMetadata } from "@/types/canvas";

export const resolveCanvasConnection: CanvasConnectionResolver<CanvasNodeMetadata> = (first, second, firstHandleType) => {
    if (first.type === CanvasNodeType.Config && second.type === CanvasNodeType.Config) return null;
    if (second.type === CanvasNodeType.Config) return { fromNodeId: first.id, toNodeId: second.id };
    if (first.type === CanvasNodeType.Config && firstHandleType === "target") return { fromNodeId: second.id, toNodeId: first.id };
    return { fromNodeId: first.id, toNodeId: second.id };
};
