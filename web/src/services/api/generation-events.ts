import type { GenerationRecord } from "@/services/api/generations";

export type GenerationEventPayload = {
    generation: GenerationRecord;
    imageRemaining?: number;
    videoRemaining?: number;
};

type Listener = (payload: GenerationEventPayload) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;

function dispatch(payload: GenerationEventPayload) {
    listeners.forEach((listener) => listener(payload));
}

function connect() {
    if (source || typeof EventSource === "undefined") return;
    source = new EventSource("/api/generations/events", { withCredentials: true });
    source.addEventListener("generation", (event) => {
        try {
            const payload = JSON.parse((event as MessageEvent).data) as GenerationEventPayload;
            if (payload?.generation) dispatch(payload);
        } catch {
            // Ignore malformed SSE payloads.
        }
    });
    source.onerror = () => {
        source?.close();
        source = null;
        if (listeners.size) window.setTimeout(connect, 2000);
    };
}

function disconnect() {
    source?.close();
    source = null;
}

export function subscribeGenerationEvents(listener: Listener) {
    listeners.add(listener);
    connect();
    return () => {
        listeners.delete(listener);
        if (!listeners.size) disconnect();
    };
}
