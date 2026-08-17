import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";

import { dataDir } from "./env";
import type { SessionRow, UserRole, UserRow } from "./schema";

let sqlite: Database | undefined;

export function db() {
    if (sqlite) return sqlite;
    const dir = dataDir();
    mkdirSync(dir, { recursive: true });
    sqlite = new Database(join(dir, "app.db"), { create: true });
    sqlite.exec("PRAGMA journal_mode = WAL");
    sqlite.exec("PRAGMA foreign_keys = ON");
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            credit_balance INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
    `);
    return sqlite;
}

export function userCount() {
    return db().query("SELECT COUNT(*) AS count FROM users").get() as { count: number };
}

export function findUserById(id: string) {
    return db().query("SELECT * FROM users WHERE id = ?").get(id) as UserRow | null;
}

export function findUserByUsername(username: string) {
    return db().query("SELECT * FROM users WHERE username = ?").get(username) as UserRow | null;
}

export function listUsers() {
    return db().query("SELECT * FROM users ORDER BY created_at ASC").all() as UserRow[];
}

export function insertUser(row: UserRow) {
    db().query("INSERT INTO users (id, username, password_hash, role, credit_balance, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(row.id, row.username, row.password_hash, row.role, row.credit_balance, row.created_at);
}

export function insertSession(row: SessionRow) {
    db().query("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(row.id, row.user_id, row.expires_at, row.created_at);
}

export function findValidSession(id: string, now: number) {
    return db().query("SELECT * FROM sessions WHERE id = ? AND expires_at > ?").get(id, now) as SessionRow | null;
}

export function deleteSession(id: string) {
    db().query("DELETE FROM sessions WHERE id = ?").run(id);
}

export function deleteExpiredSessions(now: number) {
    db().query("DELETE FROM sessions WHERE expires_at <= ?").run(now);
}

export async function bootstrapAdmin() {
    if (userCount().count > 0) return;
    const username = process.env.ADMIN_USERNAME?.trim() || "";
    const password = process.env.ADMIN_PASSWORD || "";
    if (!username || !password) {
        console.warn("users table is empty; set ADMIN_USERNAME and ADMIN_PASSWORD to create the first admin");
        return;
    }
    const role: UserRole = "admin";
    insertUser({
        id: crypto.randomUUID(),
        username,
        password_hash: await Bun.password.hash(password),
        role,
        credit_balance: 0,
        created_at: Date.now(),
    });
    console.log(`created admin user ${username}`);
}
