import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadRootEnv() {
    const path = resolve(import.meta.dir, "../../.env");
    if (!existsSync(path)) return;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const index = trimmed.indexOf("=");
        if (index < 0) continue;
        const key = trimmed.slice(0, index).trim();
        let value = trimmed.slice(index + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        if (key && process.env[key] === undefined) process.env[key] = value;
    }
}

export function dataDir() {
    return resolve(process.env.DATA_DIR?.trim() || resolve(import.meta.dir, "../../data"));
}
