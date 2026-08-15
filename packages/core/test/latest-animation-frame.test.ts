import { expect, test } from "bun:test";
import { createLatestAnimationFrame } from "../src/internal/latest-animation-frame.js";

test("coalesces input to the latest value and cancels pending work", () => {
    const scheduled: FrameRequestCallback[] = [];
    let canceled = 0;
    const values: number[] = [];
    const queue = createLatestAnimationFrame(
        (value: number) => values.push(value),
        (callback) => (scheduled.push(callback), scheduled.length),
        () => (canceled += 1),
    );
    queue.push(1);
    queue.push(2);
    expect(values).toEqual([]);
    scheduled.shift()?.(0);
    expect(values).toEqual([2]);
    queue.push(3);
    queue.clear();
    expect(canceled).toBe(1);
    expect(values).toEqual([2]);
});
