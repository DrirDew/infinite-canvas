import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { addCredits, deleteAssetsByJob, deleteJob, findAsset, findJobById, findUserById, insertAsset, insertJob, insertLedger, listAssetsByJob, listJobsByUser, updateJob, withImmediate } from "./db";
import type { GenerationJobRow, GenerationJobStatus } from "./schema";
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

function parseExtra(raw: string | undefined) {
    try {
        const value = JSON.parse(raw || "{}");
        return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

function sanitizeExtra(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const extra = { ...(value as Record<string, unknown>) };
    delete extra.references;
    delete extra.videoReferences;
    delete extra.audioReferences;
    return extra;
}

function publicJob(job: NonNullable<ReturnType<typeof findJobById>>, assets = listAssetsByJob(job.id)) {
    return {
        id: job.id,
        kind: job.kind,
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
        extra: parseExtra(job.extra_json),
        createdAt: job.created_at,
        updatedAt: job.updated_at || job.created_at,
        startedAt: job.started_at || 0,
        finishedAt: job.finished_at || 0,
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

function replaceJobAssets(userId: string, jobId: string, images: Array<{ dataUrl: string }>) {
    rmSync(join(generationsRoot(), userId, jobId), { recursive: true, force: true });
    const assets = writeAssets(userId, jobId, images);
    deleteAssetsByJob(jobId);
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
}

function saveJob(input: {
    userId: string;
    jobId?: string;
    body: CompanyImageRequest;
    planned: number;
    images: Array<{ dataUrl: string }>;
    error: string;
    durationMs: number;
}) {
    const successCount = input.images.length;
    const failCount = input.planned - successCount;
    const existing = input.jobId ? findJobById(input.jobId) : null;
    if (input.jobId && (!existing || existing.user_id !== input.userId)) throw new Error("记录不存在");
    const jobId = existing?.id || crypto.randomUUID();
    const now = Date.now();
    const row: GenerationJobRow = {
        id: jobId,
        user_id: input.userId,
        kind: existing?.kind || "image",
        prompt: String(input.body.prompt || "").trim(),
        model: String(input.body.model || existing?.model || ""),
        size: String(input.body.size || existing?.size || ""),
        quality: String(input.body.quality || existing?.quality || ""),
        count: input.planned,
        status: successCount ? "success" : "failed",
        error: successCount ? "" : input.error,
        duration_ms: Math.round(input.durationMs),
        success_count: successCount,
        fail_count: failCount,
        extra_json: existing?.extra_json || "",
        created_at: existing?.created_at || now,
        updated_at: now,
        started_at: existing?.started_at || now - Math.round(input.durationMs),
        finished_at: now,
    };
    withImmediate(() => {
        addCredits(input.userId, failCount);
        if (existing) updateJob(row);
        else insertJob(row);
        replaceJobAssets(input.userId, jobId, input.images);
        if (successCount) {
            insertLedger({ id: crypto.randomUUID(), user_id: input.userId, job_id: jobId, delta: -successCount, reason: "generate", created_at: now });
        }
    });
    return findJobById(jobId)!;
}

function markJobFailed(userId: string, jobId: string, error: string) {
    const job = findJobById(jobId);
    if (!job || job.user_id !== userId) return;
    updateJob({ ...job, extra_json: job.extra_json || "", status: "failed", error, updated_at: Date.now(), finished_at: Date.now(), started_at: job.started_at || 0 });
}

export async function generateCompanyImages(userId: string, body: CompanyImageRequest, signal?: AbortSignal) {
    const prompt = String(body.prompt || "").trim();
    if (!prompt) throw new Error("请输入提示词");
    const { credentials } = resolveSharedTencentChannel(body.channelId);
    const planned = plannedCount(body);
    const jobId = String(body.jobId || "").trim() || undefined;
    reserveCredits(userId, planned);
    const started = Date.now();
    let settled = false;
    try {
        const result = await generateCompanyTencentVodImagesSettled({ ...body, count: planned }, credentials, signal);
        if (result.aborted && !result.images.length) {
            withImmediate(() => addCredits(userId, planned));
            if (jobId) markJobFailed(userId, jobId, "请求已取消");
            settled = true;
            throw new DOMException("Aborted", "AbortError");
        }
        const job = saveJob({
            userId,
            jobId,
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
            if (jobId) markJobFailed(userId, jobId, error instanceof Error ? error.message : "腾讯云点播生图失败");
        }
        throw error;
    }
}

export type GenerationWriteInput = {
    kind?: string;
    prompt?: unknown;
    model?: unknown;
    size?: unknown;
    quality?: unknown;
    count?: unknown;
    status?: unknown;
    error?: unknown;
    durationMs?: unknown;
    successCount?: unknown;
    failCount?: unknown;
    extra?: unknown;
    images?: Array<{ dataUrl?: string }>;
    startedAt?: unknown;
    finishedAt?: unknown;
};

function normalizeKind(value: unknown, fallback = "image") {
    return value === "video" || value === "image" ? value : fallback;
}

function normalizeStatus(value: unknown, fallback: GenerationJobStatus): GenerationJobStatus {
    return value === "draft" || value === "running" || value === "success" || value === "failed" ? value : fallback;
}

function asText(value: unknown, fallback = "") {
    return typeof value === "string" ? value : fallback;
}

function asCount(value: unknown, fallback: number) {
    const count = Math.floor(Number(value));
    return Number.isFinite(count) && count > 0 ? Math.min(15, count) : fallback;
}

function asTime(value: unknown, fallback = 0) {
    const time = Math.round(Number(value));
    return Number.isFinite(time) && time > 0 ? time : fallback;
}

export function createGeneration(userId: string, input: GenerationWriteInput) {
    const now = Date.now();
    const jobId = crypto.randomUUID();
    insertJob({
        id: jobId,
        user_id: userId,
        kind: normalizeKind(input.kind),
        prompt: asText(input.prompt).trim(),
        model: asText(input.model),
        size: asText(input.size),
        quality: asText(input.quality),
        count: asCount(input.count, 1),
        status: normalizeStatus(input.status, "draft"),
        error: asText(input.error),
        duration_ms: Math.max(0, Math.round(Number(input.durationMs) || 0)),
        success_count: Math.max(0, Math.round(Number(input.successCount) || 0)),
        fail_count: Math.max(0, Math.round(Number(input.failCount) || 0)),
        extra_json: JSON.stringify(sanitizeExtra(input.extra)),
        created_at: now,
        updated_at: now,
        started_at: asTime(input.startedAt),
        finished_at: asTime(input.finishedAt),
    });
    return publicJob(findJobById(jobId)!);
}

export function patchGeneration(userId: string, id: string, input: GenerationWriteInput) {
    const job = findJobById(id);
    if (!job || job.user_id !== userId) return null;
    const now = Date.now();
    const next: GenerationJobRow = {
        ...job,
        prompt: input.prompt === undefined ? job.prompt : asText(input.prompt).trim(),
        model: input.model === undefined ? job.model : asText(input.model),
        size: input.size === undefined ? job.size : asText(input.size),
        quality: input.quality === undefined ? job.quality : asText(input.quality),
        count: input.count === undefined ? job.count : asCount(input.count, job.count),
        status: input.status === undefined ? job.status : normalizeStatus(input.status, job.status),
        error: input.error === undefined ? job.error : asText(input.error),
        duration_ms: input.durationMs === undefined ? job.duration_ms : Math.max(0, Math.round(Number(input.durationMs) || 0)),
        success_count: input.successCount === undefined ? job.success_count : Math.max(0, Math.round(Number(input.successCount) || 0)),
        fail_count: input.failCount === undefined ? job.fail_count : Math.max(0, Math.round(Number(input.failCount) || 0)),
        extra_json: input.extra === undefined ? job.extra_json || "" : JSON.stringify({ ...parseExtra(job.extra_json), ...sanitizeExtra(input.extra) }),
        updated_at: now,
        started_at: input.startedAt === undefined ? job.started_at || 0 : asTime(input.startedAt),
        finished_at: input.finishedAt === undefined ? job.finished_at || 0 : asTime(input.finishedAt),
    };
    withImmediate(() => {
        updateJob(next);
        if (input.images?.length) {
            replaceJobAssets(
                userId,
                id,
                input.images.flatMap((image) => (image.dataUrl ? [{ dataUrl: image.dataUrl }] : [])),
            );
        }
    });
    return publicJob(findJobById(id)!);
}

export function listGenerations(userId: string, kind?: string) {
    return listJobsByUser(userId, kind === "image" || kind === "video" ? kind : undefined).map((job) => publicJob(job));
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

export function removeUserGenerations(userId: string) {
    rmSync(join(generationsRoot(), userId), { recursive: true, force: true });
}
