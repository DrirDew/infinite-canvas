const pointers = new WeakMap<Element, { owner: object; pointerId: number }>();

export const canOwnCanvasPointer = (surface: Element, owner: object, pointerId: number) => {
    const current = pointers.get(surface);
    return !current || (current.owner === owner && current.pointerId === pointerId);
};

export const acquireCanvasPointer = (surface: Element, owner: object, pointerId: number) => {
    if (!canOwnCanvasPointer(surface, owner, pointerId)) return false;
    pointers.set(surface, { owner, pointerId });
    return true;
};

export const releaseCanvasPointer = (surface: Element, owner: object) => {
    if (pointers.get(surface)?.owner === owner) pointers.delete(surface);
};
