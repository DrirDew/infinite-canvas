import type { UseCanvasOptions } from "../types.js";
import { useCanvas } from "./use-canvas.js";
import { useCanvasInteractions, type UseCanvasInteractionsOptions } from "../interaction/use-canvas-interactions.js";

/** Options for creating canvas state and interaction bindings in one hook. */
export type UseCanvasEditorOptions<TMetadata = unknown> = {
    canvas?: UseCanvasOptions<TMetadata>;
    interactions: Omit<UseCanvasInteractionsOptions<TMetadata>, "commands">;
};

/** Combines {@link useCanvas} and {@link useCanvasInteractions} for common editors. */
export function useCanvasEditor<TMetadata = unknown>({ canvas, interactions }: UseCanvasEditorOptions<TMetadata>) {
    const state = useCanvas(canvas);
    const interactionState = useCanvasInteractions({ ...interactions, commands: state.commands });
    return { ...state, interactions: interactionState };
}
