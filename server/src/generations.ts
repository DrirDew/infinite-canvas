import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { addCredits, deleteJob, findAsset, findJobById, findUserById, insertAsset, insertJob, insertLedger, listAssetsByJob, listJobsByUser, withImmediate } from "./db";
import { dataDir } from "./env";
import { generateCompanyTencentVodImagesSettled, type CompanyImageRequest } from "./tencent-vod";
import { resolveSharedTencentChannel } from "./channels";

export class CreditError extends Error {}

function generationsRoot() {
    return resolve(dataDir(), "generations");
}

function plannedCount(body: CompanyImageRequest) {
    return Math.max(1, Math.min(15, Math.floor(Number(body.count) || 1)));
}

function reserveCredits(userId: string, count: number) {
    withImmediate(() => {
        const row = findUserById(userId);
        if (!row || row.credit_balance < count) throw new CreditError("额度不足");
        addCredits(userId, -count);
    });
}

function assetUrl(jobId: string, index: number) {
    return `/api/generations/${jobId}/assets/${index}`;
}

function publicJob(job: NonNullable<ReturnType<typeof findJobById>>, assets = listAssetsByJob(job.id)) {
    return {
        id: job.id,
        prompt: job.prompt,
        model: job.model,
        size: job.size,
        quality: job.quality,
        count: job.count,
        status: job.status,
        error: job.error,
        durationMs: job.duration_ms,
        successCount: job.success_count,
        failCount: job.fail_count,
        createdAt: job.created_at,
        assets: assets.map((asset) => ({
            index: asset.item_index,
            mime: asset.mime,
            url: assetUrl(job.id, asset.item_index),
            width: asset.width,
            height: asset.height,
            bytes: asset.bytes,
        })),
    };
}

function parseImage(dataUrl: string) {
    const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl.trim());
    if (!match) return null;
    const mime = match[1] || "image/png";
    const bytes = Buffer.from(match[2], "base64");
    const size = imageSize(bytes, mime);
    return { mime, bytes, ...size };
}

function imageSize(bytes: Buffer, mime: string) {
    if (mime.includes("png") && bytes.length >= 24) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    if (mime.includes("jpeg") || mime.includes("jpg")) {
        let offset = 2;
        while (offset + 9 < bytes.length) {
            if (bytes[offset] !== 0xff) break;
            const marker = bytes[offset + 1];
            const length = bytes.readUInt16BE(offset + 2);
            if (marker >= 0xc0 && marker <= 0xc3) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
            offset += 2 + length;
        }
    }
    return { width: 0, height: 0 };
}

function extension(mime: string) {
    if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
    if (mime.includes("webp")) return "webp";
    return "png";
}

function writeAssets(userId: string, jobId: string, images: Array<{ dataUrl: string }>) {
    const assets: Array<{ mime: string; path: string; width: number; height: number; bytes: number }> = [];
    for (let index = 0; index < images.length; index += 1) {
        const parsed = parseImage(images[index].dataUrl);
        if (!parsed) continue;
        const path = `${userId}/${jobId}/${index}.${extension(parsed.mime)}`;
        const abs = join(generationsRoot(), path);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, parsed.bytes);
        assets.push({ mime: parsed.mime, path, width: parsed.width, height: parsed.height, bytes: parsed.bytes.length });
    }
    return assets;
}

function saveJob(input: {
    userId: string;
    body: CompanyImageRequest;
    planned: number;
    images: Array<{ dataUrl: string }>;
    error: string;
    durationMs: number;
}) {
    const successCount = input.images.length;
    const failCount = input.planned - successCount;
    const jobId = crypto.randomUUID();
    const assets = writeAssets(input.userId, jobId, input.images);
    withImmediate(() => {
        addCredits(input.userId, failCount);
        insertJob({
            id: jobId,
            user_id: input.userId,
            kind: "image",
            prompt: String(input.body.prompt || "").trim(),
            model: String(input.body.model || ""),
            size: String(input.body.size || ""),
            quality: String(input.body.quality || ""),
            count: input.planned,
            status: successCount ? "success" : "failed",
            error: successCount ? "" : input.error,
            duration_ms: Math.round(input.durationMs),
            success_count: successCount,
            fail_count: failCount,
            created_at: Date.now(),
        });
        for (let index = 0; index < assets.length; index += 1) {
            const asset = assets[index];
            insertAsset({
                id: crypto.randomUUID(),
                job_id: jobId,
                item_index: index,
                mime: asset.mime,
                path: asset.path,
                width: asset.width,
                height: asset.height,
                bytes: asset.bytes,
            });
        }
        if (successCount) {
            insertLedger({ id: crypto.randomUUID(), user_id: input.userId, job_id: jobId, delta: -successCount, reason: "generate", created_at: Date.now() });
        }
    });
    return findJobById(jobId)!;
}

export async function generateCompanyImages(userId: string, body: CompanyImageRequest, signal?: AbortSignal) {
    const prompt = String(body.prompt || "").trim();
    if (!prompt) throw new Error("请输入提示词");
    const { credentials } = resolveSharedTencentChannel(body.channelId);
    const planned = plannedCount(body);
    reserveCredits(userId, planned);
    const started = Date.now();
    let settled = false;
    try {
        const result = await generateCompanyTencentVodImagesSettled({ ...body, count: planned }, credentials, signal);
        if (result.aborted && !result.images.length) {
            withImmediate(() => addCredits(userId, planned));
            settled = true;
            throw new DOMException("Aborted", "AbortError");
        }
        const job = saveJob({
            userId,
            body,
            planned,
            images: result.images,
            error: result.errors[0] || (result.aborted ? "请求已取消" : "腾讯云点播生图失败"),
            durationMs: Date.now() - started,
        });
        settled = true;
        const user = findUserById(userId);
        if (result.aborted) throw new DOMException("Aborted", "AbortError");
        if (!result.images.length) throw new Error(job.error || "腾讯云点播生图失败");
        return {
            id: job.id,
            images: result.images,
            failCount: job.fail_count,
            creditBalance: user?.credit_balance ?? 0,
        };
    } catch (error) {
        if (!settled) {
            try {
                withImmediate(() => addCredits(userId, planned));
            } catch {
                // Keep the original generate error.
            }
        }
        throw error;
    }
}

export function listGenerations(userId: string) {
    return listJobsByUser(userId).map((job) => publicJob(job));
}

export function getGeneration(userId: string, id: string) {
    const job = findJobById(id);
    if (!job || job.user_id !== userId) return null;
    return publicJob(job);
}

export function readGenerationAsset(userId: string, jobId: string, index: number) {
    const job = findJobById(jobId);
    if (!job || job.user_id !== userId) return null;
    const asset = findAsset(jobId, index);
    if (!asset) return null;
    const root = generationsRoot();
    const abs = resolve(root, asset.path);
    const rel = relative(root, abs);
    if (!rel || rel.startsWith("..") || rel.split(sep).includes("..")) return null;
    return { mime: asset.mime, bytes: readFileSync(abs) };
}

export function removeGeneration(userId: string, id: string) {
    const job = findJobById(id);
    if (!job || job.user_id !== userId) return false;
    rmSync(join(generationsRoot(), userId, id), { recursive: true, force: true });
    deleteJob(id);
    return true;
}
