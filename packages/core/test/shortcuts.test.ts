import { expect, test } from "bun:test";
import { resolveCanvasShortcut } from "../src";

const key = (value: string, options: Partial<Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey">> = {}): Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"> => ({ metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...options, key: value });

test("resolves cross-platform canvas shortcuts", () => {
    expect(resolveCanvasShortcut(key("z", { ctrlKey: true }))).toBe("undo");
    expect(resolveCanvasShortcut(key("z", { metaKey: true, shiftKey: true }))).toBe("redo");
    expect(resolveCanvasShortcut(key("y", { ctrlKey: true }))).toBe("redo");
    expect(resolveCanvasShortcut(key("a", { ctrlKey: true }))).toBe("select-all");
    expect(resolveCanvasShortcut(key("c", { metaKey: true }))).toBe("copy");
    expect(resolveCanvasShortcut(key("v", { ctrlKey: true }))).toBe("paste");
    expect(resolveCanvasShortcut(key("Delete"))).toBe("delete");
    expect(resolveCanvasShortcut(key("Escape"))).toBe("escape");
    expect(resolveCanvasShortcut(key("c", { ctrlKey: true, altKey: true }))).toBeNull();
});
