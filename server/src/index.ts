import { Hono } from "hono";

import { clearSessionCookie, createSession, requireAdmin, requireUser, writeSessionCookie, type AppEnv } from "./auth";
import { bootstrapAdmin, findUserByUsername, generatedCountForUser } from "./db";
import { loadRootEnv } from "./env";
import { CreditError, generateCompanyImages, getGeneration, listGenerations, readGenerationAsset, removeGeneration } from "./generations";
import { toPublicUser } from "./schema";
import { companyTencentVodChannel, type CompanyImageRequest } from "./tencent-vod";
import { usageForUser } from "./usage";
import { adjustCredits, createUser, normalizeUsername, publicUsers } from "./users";

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
    return c.json(toPublicUser(row, generatedCountForUser(row.id)));
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
        return c.json(await generateCompanyImages(c.get("user").id, body, c.req.raw.signal));
    } catch (error) {
        if (isAbortError(error) || c.req.raw.signal.aborted) return c.json({ error: "请求已取消" }, 499);
        if (error instanceof CreditError) return c.json({ error: error.message }, 403);
        const message = error instanceof Error ? error.message : "腾讯云点播生图失败";
        return c.json({ error: message }, message.includes("未配置") ? 503 : 400);
    }
});

app.get("/api/generations", requireUser, (c) => c.json({ generations: listGenerations(c.get("user").id) }));

app.get("/api/generations/:id", requireUser, (c) => {
    const item = getGeneration(c.get("user").id, c.req.param("id"));
    return item ? c.json(item) : c.json({ error: "记录不存在" }, 404);
});

app.get("/api/generations/:id/assets/:index", requireUser, (c) => {
    const asset = readGenerationAsset(c.get("user").id, c.req.param("id"), Number(c.req.param("index")));
    if (!asset) return c.json({ error: "记录不存在" }, 404);
    return new Response(asset.bytes, { headers: { "Content-Type": asset.mime, "Cache-Control": "private, max-age=3600" } });
});

app.delete("/api/generations/:id", requireUser, (c) => {
    if (!removeGeneration(c.get("user").id, c.req.param("id"))) return c.json({ error: "记录不存在" }, 404);
    return c.json({ ok: true });
});

app.get("/api/usage/me", requireUser, (c) => {
    const usage = usageForUser(c.get("user").id);
    return usage ? c.json(usage) : c.json({ error: "未登录" }, 401);
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

app.patch("/api/users/:id/credits", requireUser, requireAdmin, async (c) => {
    try {
        const body = (await c.req.json().catch(() => ({}))) as { creditBalance?: number };
        return c.json(adjustCredits(c.req.param("id"), Number(body.creditBalance)));
    } catch (error) {
        return c.json({ error: error instanceof Error ? error.message : "调整额度失败" }, 400);
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
