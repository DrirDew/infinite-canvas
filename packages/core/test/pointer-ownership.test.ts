import { expect, test } from "bun:test";
import { acquireCanvasPointer, canOwnCanvasPointer, releaseCanvasPointer } from "../src/internal/pointer-ownership.js";

test("isolates pointer ownership by canvas surface", () => {
    const first = {} as Element;
    const second = {} as Element;
    const owner = {};
    const other = {};
    expect(acquireCanvasPointer(first, owner, 1)).toBe(true);
    expect(canOwnCanvasPointer(first, other, 2)).toBe(false);
    expect(acquireCanvasPointer(second, other, 2)).toBe(true);
    releaseCanvasPointer(first, other);
    expect(canOwnCanvasPointer(first, other, 2)).toBe(false);
    releaseCanvasPointer(first, owner);
    expect(acquireCanvasPointer(first, other, 2)).toBe(true);
});
