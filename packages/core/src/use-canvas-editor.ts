import type { UseCanvasOptions } from "./types";
import { useCanvas } from "./use-canvas";
import { useCanvasInteractions, type UseCanvasInteractionsOptions } from "./use-canvas-interactions";

export type UseCanvasEditorOptions<TMetadata = unknown> = {
    canvas?: UseCanvasOptions<TMetadata>;
    interactions: Omit<UseCanvasInteractionsOptions<TMetadata>, "commands">;
};

export function useCanvasEditor<TMetadata = unknown>({ canvas, interactions }: UseCanvasEditorOptions<TMetadata>) {
    const state = useCanvas(canvas);
    const interactionState = useCanvasInteractions({ ...interactions, commands: state.commands });
    return { ...state, interactions: interactionState };
}
