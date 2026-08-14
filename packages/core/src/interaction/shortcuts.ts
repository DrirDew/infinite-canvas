import type { CanvasShortcut, CanvasShortcutEvent } from "../types.js";

export function resolveCanvasShortcut(event: CanvasShortcutEvent): CanvasShortcut | null {
    const key = event.key.toLowerCase();
    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && !event.altKey) {
        if (key === "z") return event.shiftKey ? "redo" : "undo";
        if (key === "y") return "redo";
        if (key === "a") return "select-all";
        if (key === "c") return "copy";
        if (key === "v") return "paste";
    }
    if (event.key === "Delete" || event.key === "Backspace") return "delete";
    return event.key === "Escape" ? "escape" : null;
}
