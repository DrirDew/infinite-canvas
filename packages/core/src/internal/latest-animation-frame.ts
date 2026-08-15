/** A scheduler that retains only the newest value until the browser's next animation frame. */
export type LatestAnimationFrame<T> = { push: (value: T) => void; clear: () => void };

/**
 * Coalesces high-frequency input into at most one callback per animation frame.
 * Custom request/cancel functions keep the scheduler deterministic in unit tests.
 */
export function createLatestAnimationFrame<T>(callback: (value: T) => void, request = requestAnimationFrame, cancel = cancelAnimationFrame): LatestAnimationFrame<T> {
    let frame: number | null = null;
    let latest!: T;
    let pending = false;
    return {
        push(value) {
            latest = value;
            pending = true;
            if (frame !== null) return;
            frame = request(() => {
                frame = null;
                if (!pending) return;
                pending = false;
                callback(latest);
            });
        },
        clear() {
            if (frame !== null) cancel(frame);
            frame = null;
            pending = false;
        },
    };
}
