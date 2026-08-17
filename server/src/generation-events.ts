const clients = new Map<string, Set<(data: string) => void>>();

export function publishGenerationEvent(userId: string, payload: unknown) {
    const set = clients.get(userId);
    if (!set?.size) return;
    const data = JSON.stringify(payload);
    for (const send of set) send(data);
}

export function addGenerationEventClient(userId: string, send: (data: string) => void) {
    const set = clients.get(userId) || new Set<(data: string) => void>();
    set.add(send);
    clients.set(userId, set);
    return () => {
        set.delete(send);
        if (!set.size) clients.delete(userId);
    };
}
