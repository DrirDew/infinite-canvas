import type { UseCanvasOptions } from "./types.js";
import { useCanvas } from "./use-canvas.js";
import { useCanvasInteractions, type UseCanvasInteractionsOptions } from "./use-canvas-interactions.js";

export type UseCanvasEditorOptions<TMetadata = unknown> = {
    canvas?: UseCanvasOptions<TMetadata>;
    interactions: Omit<UseCanvasInteractionsOptions<TMetadata>, "commands">;
};

export function useCanvasEditor<TMetadata = unknown>({ canvas, interactions }: UseCanvasEditorOptions<TMetadata>) {
    const state = useCanvas(canvas);
    const interactionState = useCanvasInteractions({ ...interactions, commands: state.commands });
    return { ...state, interactions: interactionState };
}
