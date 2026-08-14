const owners = new Set<object>();
let previous = "";

export const acquireBodyCursor = (owner: object) => {
    if (!owners.size) previous = document.body.style.cursor;
    owners.add(owner);
    document.body.style.cursor = "grabbing";
};

export const releaseBodyCursor = (owner: object) => {
    if (!owners.delete(owner) || owners.size) return;
    document.body.style.cursor = previous;
};
