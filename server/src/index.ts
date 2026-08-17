import { Hono } from "hono";

import { clearSessionCookie, createSession, requireAdmin, requireUser, writeSessionCookie, type AppEnv } from "./auth";
import { bootstrapAdmin, findUserByUsername } from "./db";
import { loadRootEnv } from "./env";
import { toPublicUser } from "./schema";
import { companyTencentVodChannel, generateCompanyTencentVodImages, type CompanyImageRequest } from "./tencent-vod";
import { createUser, normalizeUsername, publicUsers } from "./users";

loadRootEnv();
await bootstrapAdmin();

const PORT = Number(process.env.PORT) || 8787;

function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError";
}

const app = new Hono<AppEnv>();

app.post("/api/auth/login", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { username?: string; password?: string };
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    const row = findUserByUsername(username);
    if (!row || !(await Bun.password.verify(password, row.password_hash))) return c.json({ error: "用户名或密码错误" }, 401);
    writeSessionCookie(c, await createSession(row.id));
    return c.json(toPublicUser(row));
});

app.post("/api/auth/logout", (c) => {
    clearSessionCookie(c);
    return c.json({ ok: true });
});

app.get("/api/auth/me", requireUser, (c) => c.json(c.get("user")));

app.get("/api/company/channels", requireUser, (c) => {
    const channel = companyTencentVodChannel();
    return c.json({ channels: channel ? [channel] : [] });
});

app.post("/api/tencent-vod/images", requireUser, async (c) => {
    try {
        const body = (await c.req.json()) as CompanyImageRequest;
        const images = await generateCompanyTencentVodImages(body, c.req.raw.signal);
        return c.json({ images });
    } catch (error) {
        if (isAbortError(error) || c.req.raw.signal.aborted) return c.json({ error: "请求已取消" }, 499);
        const message = error instanceof Error ? error.message : "腾讯云点播生图失败";
        return c.json({ error: message }, message.includes("未配置") ? 503 : 400);
    }
});

app.get("/api/users", requireUser, requireAdmin, (c) => c.json({ users: publicUsers() }));

app.post("/api/users", requireUser, requireAdmin, async (c) => {
    try {
        const body = (await c.req.json().catch(() => ({}))) as { username?: string; password?: string };
        return c.json(await createUser(body.username || "", String(body.password || "")), 201);
    } catch (error) {
        return c.json({ error: error instanceof Error ? error.message : "创建用户失败" }, 400);
    }
});

app.notFound((c) => c.json({ error: "Not Found" }, 404));

Bun.serve({
    port: PORT,
    hostname: "0.0.0.0",
    maxRequestBodySize: 50 * 1024 * 1024,
    fetch: app.fetch,
});

console.log(`company api listening on ${PORT}`);
