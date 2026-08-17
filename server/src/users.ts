import { findUserByUsername, insertUser, listUsers } from "./db";
import { toPublicUser, type UserRole } from "./schema";

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{2,32}$/;

export function normalizeUsername(value: unknown) {
    return String(value || "").trim();
}

export function validateUsername(username: string) {
    if (!USERNAME_PATTERN.test(username)) throw new Error("用户名需为 2-32 位字母、数字、点、下划线或短横线");
}

export function validatePassword(password: string) {
    if (password.length < 6) throw new Error("密码至少 6 位");
}

export async function createUser(username: string, password: string, role: UserRole = "user") {
    const name = normalizeUsername(username);
    validateUsername(name);
    validatePassword(password);
    if (findUserByUsername(name)) throw new Error("用户名已存在");
    const row = {
        id: crypto.randomUUID(),
        username: name,
        password_hash: await Bun.password.hash(password),
        role,
        credit_balance: 0,
        created_at: Date.now(),
    };
    insertUser(row);
    return toPublicUser(row);
}

export function publicUsers() {
    return listUsers().map(toPublicUser);
}
