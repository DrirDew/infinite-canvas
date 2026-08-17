import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";

import { dataDir } from "./env";
import type { GenerationAssetRow, GenerationJobRow, SessionRow, UserRole, UserRow } from "./schema";

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
        CREATE TABLE IF NOT EXISTS generation_jobs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            prompt TEXT NOT NULL,
            model TEXT NOT NULL,
            size TEXT NOT NULL,
            quality TEXT NOT NULL,
            count INTEGER NOT NULL,
            status TEXT NOT NULL,
            error TEXT NOT NULL DEFAULT '',
            duration_ms INTEGER NOT NULL,
            success_count INTEGER NOT NULL,
            fail_count INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS generation_jobs_user_id ON generation_jobs(user_id, created_at);
        CREATE TABLE IF NOT EXISTS generation_assets (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            item_index INTEGER NOT NULL,
            mime TEXT NOT NULL,
            path TEXT NOT NULL,
            width INTEGER NOT NULL DEFAULT 0,
            height INTEGER NOT NULL DEFAULT 0,
            bytes INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (job_id) REFERENCES generation_jobs(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS generation_assets_job_id ON generation_assets(job_id);
        CREATE TABLE IF NOT EXISTS usage_ledger (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            job_id TEXT,
            delta INTEGER NOT NULL,
            reason TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (job_id) REFERENCES generation_jobs(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS usage_ledger_user_id ON usage_ledger(user_id, created_at);
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

export function addCredits(userId: string, delta: number) {
    db().query("UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?").run(delta, userId);
}

export function setCreditBalance(userId: string, balance: number) {
    db().query("UPDATE users SET credit_balance = ? WHERE id = ?").run(balance, userId);
}

export function insertJob(row: GenerationJobRow) {
    db()
        .query(
            "INSERT INTO generation_jobs (id, user_id, kind, prompt, model, size, quality, count, status, error, duration_ms, success_count, fail_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(row.id, row.user_id, row.kind, row.prompt, row.model, row.size, row.quality, row.count, row.status, row.error, row.duration_ms, row.success_count, row.fail_count, row.created_at);
}

export function insertAsset(row: GenerationAssetRow) {
    db()
        .query("INSERT INTO generation_assets (id, job_id, item_index, mime, path, width, height, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(row.id, row.job_id, row.item_index, row.mime, row.path, row.width, row.height, row.bytes);
}

export function insertLedger(row: { id: string; user_id: string; job_id: string | null; delta: number; reason: string; created_at: number }) {
    db().query("INSERT INTO usage_ledger (id, user_id, job_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(row.id, row.user_id, row.job_id, row.delta, row.reason, row.created_at);
}

export function listJobsByUser(userId: string) {
    return db().query("SELECT * FROM generation_jobs WHERE user_id = ? ORDER BY created_at DESC").all(userId) as GenerationJobRow[];
}

export function findJobById(id: string) {
    return db().query("SELECT * FROM generation_jobs WHERE id = ?").get(id) as GenerationJobRow | null;
}

export function listAssetsByJob(jobId: string) {
    return db().query("SELECT * FROM generation_assets WHERE job_id = ? ORDER BY item_index ASC").all(jobId) as GenerationAssetRow[];
}

export function findAsset(jobId: string, index: number) {
    return db().query("SELECT * FROM generation_assets WHERE job_id = ? AND item_index = ?").get(jobId, index) as GenerationAssetRow | null;
}

export function deleteJob(id: string) {
    db().query("DELETE FROM generation_jobs WHERE id = ?").run(id);
}

export function withImmediate<T>(fn: () => T) {
    const sqlite = db();
    sqlite.exec("BEGIN IMMEDIATE");
    try {
        const result = fn();
        sqlite.exec("COMMIT");
        return result;
    } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
    }
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
