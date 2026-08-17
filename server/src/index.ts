import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { companyTencentVodChannel, generateCompanyTencentVodImages, type CompanyImageRequest } from "./tencent-vod";

const PORT = Number(process.env.PORT) || 8787;

function loadRootEnv() {
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

loadRootEnv();

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError";
}

Bun.serve({
    port: PORT,
    hostname: "0.0.0.0",
    maxRequestBodySize: 50 * 1024 * 1024,
    async fetch(request) {
        const url = new URL(request.url);
        if (request.method === "GET" && url.pathname === "/api/company/channels") {
            const channel = companyTencentVodChannel();
            return json({ channels: channel ? [channel] : [] });
        }
        if (request.method === "POST" && url.pathname === "/api/tencent-vod/images") {
            try {
                const body = (await request.json()) as CompanyImageRequest;
                const images = await generateCompanyTencentVodImages(body, request.signal);
                return json({ images });
            } catch (error) {
                if (isAbortError(error) || request.signal.aborted) return json({ error: "请求已取消" }, 499);
                const message = error instanceof Error ? error.message : "腾讯云点播生图失败";
                return json({ error: message }, message.includes("未配置") ? 503 : 400);
            }
        }
        return json({ error: "Not Found" }, 404);
    },
});

console.log(`company api listening on ${PORT}`);
