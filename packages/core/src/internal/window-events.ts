const listeners = new Map<keyof WindowEventMap, Set<EventListener>>();
const dispatchers = new Map<keyof WindowEventMap, EventListener>();

export function subscribeWindowEvent<K extends keyof WindowEventMap>(type: K, listener: (event: WindowEventMap[K]) => void) {
    let entries = listeners.get(type);
    if (!entries) {
        entries = new Set();
        listeners.set(type, entries);
        const dispatch: EventListener = (event) => entries!.forEach((entry) => entry(event));
        dispatchers.set(type, dispatch);
        window.addEventListener(type, dispatch);
    }
    const entry = listener as EventListener;
    entries.add(entry);
    return () => {
        entries.delete(entry);
        if (entries.size) return;
        window.removeEventListener(type, dispatchers.get(type)!);
        listeners.delete(type);
        dispatchers.delete(type);
    };
}
