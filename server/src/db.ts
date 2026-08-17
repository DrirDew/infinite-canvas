import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";

import { dataDir } from "./env";
import type { ChannelRow, GenerationAssetRow, GenerationJobRow, LedgerRow, SessionRow, UserRole, UserRow } from "./schema";

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
        CREATE TABLE IF NOT EXISTS channels (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            api_format TEXT NOT NULL,
            base_url TEXT NOT NULL DEFAULT '',
            api_key TEXT NOT NULL DEFAULT '',
            secret_key TEXT NOT NULL DEFAULT '',
            sub_app_id TEXT NOT NULL DEFAULT '',
            models_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
    `);
    try {
        sqlite.exec("ALTER TABLE channels DROP COLUMN is_default");
    } catch {
        // New databases have no is_default column.
    }
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

export function setPasswordHash(userId: string, passwordHash: string) {
    db().query("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
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

export function listLedgerByUser(userId: string) {
    return db().query("SELECT * FROM usage_ledger WHERE user_id = ? ORDER BY created_at DESC").all(userId) as LedgerRow[];
}

export function generatedCountForUser(userId: string) {
    const row = db().query("SELECT COALESCE(SUM(CASE WHEN reason = 'generate' THEN -delta ELSE 0 END), 0) AS generated FROM usage_ledger WHERE user_id = ?").get(userId) as { generated: number };
    return row.generated;
}

export function generatedCountMap() {
    const rows = db().query("SELECT user_id, COALESCE(SUM(CASE WHEN reason = 'generate' THEN -delta ELSE 0 END), 0) AS generated FROM usage_ledger GROUP BY user_id").all() as Array<{ user_id: string; generated: number }>;
    return new Map(rows.map((row) => [row.user_id, row.generated]));
}

export function jobCountByUser(userId: string) {
    return (db().query("SELECT COUNT(*) AS count FROM generation_jobs WHERE user_id = ?").get(userId) as { count: number }).count;
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

export function deleteUserRecords(userId: string) {
    db().query("DELETE FROM usage_ledger WHERE user_id = ?").run(userId);
    db().query("DELETE FROM generation_jobs WHERE user_id = ?").run(userId);
    db().query("DELETE FROM sessions WHERE user_id = ?").run(userId);
    db().query("DELETE FROM users WHERE id = ?").run(userId);
}

export function channelCount() {
    return (db().query("SELECT COUNT(*) AS count FROM channels").get() as { count: number }).count;
}

export function listChannels() {
    return db().query("SELECT * FROM channels ORDER BY created_at ASC").all() as ChannelRow[];
}

export function findChannelById(id: string) {
    return db().query("SELECT * FROM channels WHERE id = ?").get(id) as ChannelRow | null;
}

export function insertChannel(row: ChannelRow) {
    db()
        .query("INSERT INTO channels (id, name, api_format, base_url, api_key, secret_key, sub_app_id, models_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(row.id, row.name, row.api_format, row.base_url, row.api_key, row.secret_key, row.sub_app_id, row.models_json, row.created_at, row.updated_at);
}

export function updateChannel(row: ChannelRow) {
    db()
        .query("UPDATE channels SET name = ?, api_format = ?, base_url = ?, api_key = ?, secret_key = ?, sub_app_id = ?, models_json = ?, updated_at = ? WHERE id = ?")
        .run(row.name, row.api_format, row.base_url, row.api_key, row.secret_key, row.sub_app_id, row.models_json, row.updated_at, row.id);
}

export function deleteChannel(id: string) {
    db().query("DELETE FROM channels WHERE id = ?").run(id);
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
