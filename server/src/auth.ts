import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { deleteExpiredSessions, deleteSession, findUserById, findValidSession, insertSession } from "./db";
import { toPublicUser, type PublicUser } from "./schema";

export type AppEnv = {
    Variables: {
        user: PublicUser;
    };
};

export const SESSION_COOKIE = "ic_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function cookieOptions() {
    return { httpOnly: true, path: "/", sameSite: "Lax" as const, maxAge: Math.floor(SESSION_TTL_MS / 1000) };
}

export async function createSession(userId: string) {
    const now = Date.now();
    deleteExpiredSessions(now);
    const id = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
    insertSession({ id, user_id: userId, expires_at: now + SESSION_TTL_MS, created_at: now });
    return id;
}

export function readSessionUser(c: Context) {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (!sessionId) return null;
    const session = findValidSession(sessionId, Date.now());
    if (!session) return null;
    const row = findUserById(session.user_id);
    return row ? toPublicUser(row) : null;
}

export function clearSessionCookie(c: Context) {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (sessionId) deleteSession(sessionId);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export function writeSessionCookie(c: Context, sessionId: string) {
    setCookie(c, SESSION_COOKIE, sessionId, cookieOptions());
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
    const user = readSessionUser(c);
    if (!user) return c.json({ error: "未登录" }, 401);
    c.set("user", user);
    await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (c.get("user").role !== "admin") return c.json({ error: "没有权限" }, 403);
    await next();
};
