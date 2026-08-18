import { mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { addQuotaUsed, deleteAsset, deleteAssetsByJobRole, deleteJob, ensureQuotaDay, findAsset, findJobById, getAppSetting, insertAsset, insertJob, insertLedger, listAssetsByJob, listJobsByStatus, listJobsByUser, setAppSetting, updateJob, withImmediate } from "./db";
import type { GenerationAssetRole, GenerationJobRow, QuotaKind } from "./schema";
import { quotaEventFields } from "./schema";
import { dataDir } from "./env";
import { publishGenerationEvent } from "./generation-events";
import { createCompanyImageTask, createCompanyVideoTask, decodeTaskContext, describeVodTask, encodeTaskContext, fileUrlToDataUrl, parseVodCallback, type CompanyImageRequest, type VodTaskSnapshot } from "./tencent-vod";
import { resolveSharedTencentChannel } from "./channels";

export class CreditError extends Error {}

const ROLE_INDEX: Record<GenerationAssetRole, number> = { result: 0, "image-ref": 1000, "video-ref": 2000, "audio-ref": 3000 };

function generationsRoot() {
    return resolve(dataDir(), "generations");
}

function plannedCount(body: CompanyImageRequest) {
    return Math.max(1, Math.min(15, Math.floor(Number(body.count) || 1)));
}

type TencentTaskSlot = {
    taskId: string;
    index: number;
    kind: "image" | "video";
    status: "processing" | "finish" | "fail";
    error?: string;
    fileUrl?: string;
};

function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError";
}

function tencentSlots(extra: Record<string, unknown>): TencentTaskSlot[] {
    if (!Array.isArray(extra.tencentTasks)) return [];
    return extra.tencentTasks.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const record = item as Record<string, unknown>;
        const status = record.status === "finish" || record.status === "fail" ? record.status : "processing";
        return [
            {
                taskId: String(record.taskId || "").trim(),
                index: Math.max(0, Math.round(Number(record.index) || 0)),
                kind: record.kind === "video" ? "video" : "image",
                status,
                error: String(record.error || ""),
                fileUrl: String(record.fileUrl || ""),
            },
        ];
    });
}

function notifyJob(job: GenerationJobRow) {
    const user = ensureQuotaDay(job.user_id);
    publishGenerationEvent(job.user_id, { generation: publicJob(job), ...(user ? quotaEventFields(user) : { imageRemaining: 0, videoRemaining: 0 }) });
}

function jobQuotaKind(job: GenerationJobRow): QuotaKind {
    return job.kind === "video" ? "video" : "image";
}

function reserveCredits(userId: string, kind: QuotaKind, count: number) {
    withImmediate(() => {
        const row = ensureQuotaDay(userId);
        const quota = kind === "video" ? row?.video_quota || 0 : row?.image_quota || 0;
        const used = kind === "video" ? row?.video_used || 0 : row?.image_used || 0;
        if (!row || used + count > quota) throw new CreditError("额度不足");
        addQuotaUsed(userId, kind, count);
    });
}

function refundCredits(userId: string, kind: QuotaKind, count: number) {
    withImmediate(() => addQuotaUsed(userId, kind, -count));
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
    delete extra.resultUrls;
    delete extra.video;
    return extra;
}

export function getStoreMediaSetting() {
    return getAppSetting("store_media") !== "0";
}

export function setStoreMediaSetting(value: boolean) {
    setAppSetting("store_media", value ? "1" : "0");
}

function isRemoteUrl(value: string) {
    return /^https?:\/\//i.test(value || "");
}

function sanitizeResultUrls(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || "").trim()).filter(isRemoteUrl).slice(0, 15);
}

function publicJob(job: NonNullable<ReturnType<typeof findJobById>>, assets = listAssetsByJob(job.id)) {
    const extra = parseExtra(job.extra_json);
    const results = assets.filter((asset) => (asset.role || "result") === "result");
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
        extra,
        createdAt: job.created_at,
        updatedAt: job.updated_at || job.created_at,
        startedAt: job.started_at || 0,
        finishedAt: job.finished_at || 0,
        assets: results.map((asset) => ({
            index: asset.item_index,
            mime: asset.mime,
            url: assetUrl(job.id, asset.item_index),
            width: asset.width,
            height: asset.height,
            bytes: asset.bytes,
        })),
        resultUrls: Array.isArray(extra.resultUrls) ? extra.resultUrls.map((item) => String(item || "")).filter(isRemoteUrl) : [],
        references: mapStoredRefs(job.id, extra.references, assets),
        videoReferences: mapStoredRefs(job.id, extra.videoReferences, assets),
        audioReferences: mapStoredRefs(job.id, extra.audioReferences, assets),
    };
}

function mapStoredRefs(jobId: string, value: unknown, assets: ReturnType<typeof listAssetsByJob>) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const record = item as Record<string, unknown>;
        const index = Math.round(Number(record.index));
        const asset = assets.find((row) => row.item_index === index);
        if (!asset) return [];
        return [
            {
                id: String(record.id || `${jobId}-${index}`),
                name: String(record.name || ""),
                type: String(record.type || asset.mime),
                url: assetUrl(jobId, asset.item_index),
                width: Number(record.width || asset.width || 0) || 0,
                height: Number(record.height || asset.height || 0) || 0,
                durationMs: Number(record.durationMs || 0) || 0,
                bytes: Number(record.bytes || asset.bytes || 0) || 0,
            },
        ];
    });
}

function parseDataUrl(dataUrl: string) {
    const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl.trim());
    if (!match) return null;
    const mime = match[1] || "application/octet-stream";
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
    if (mime.includes("mp4")) return "mp4";
    if (mime.includes("webm")) return "webm";
    if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
    if (mime.includes("wav")) return "wav";
    if (mime.includes("png")) return "png";
    return "bin";
}

async function materializeFile(item: { dataUrl?: string; url?: string; width?: number; height?: number; bytes?: number }) {
    if (item.dataUrl?.startsWith("data:")) {
        const parsed = parseDataUrl(item.dataUrl);
        if (parsed) return { ...parsed, width: item.width || parsed.width, height: item.height || parsed.height };
    }
    const remote = (item.dataUrl && isRemoteUrl(item.dataUrl) ? item.dataUrl : "") || (item.url && isRemoteUrl(item.url) ? item.url : "");
    if (remote) {
        const response = await fetch(remote);
        if (!response.ok) return null;
        const mime = (response.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
        const bytes = Buffer.from(await response.arrayBuffer());
        const size = imageSize(bytes, mime);
        return { mime, bytes, width: item.width || size.width, height: item.height || size.height };
    }
    return null;
}

function writeParsedAsset(userId: string, jobId: string, role: GenerationAssetRole, index: number, file: { mime: string; bytes: Buffer; width: number; height: number }) {
    const path = `${userId}/${jobId}/${role}-${index}.${extension(file.mime)}`;
    const abs = join(generationsRoot(), path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, file.bytes);
    insertAsset({
        id: crypto.randomUUID(),
        job_id: jobId,
        item_index: ROLE_INDEX[role] + index,
        role,
        mime: file.mime,
        path,
        width: file.width,
        height: file.height,
        bytes: file.bytes.length,
    });
    return ROLE_INDEX[role] + index;
}

function clearRoleAssets(jobId: string, role: GenerationAssetRole) {
    for (const asset of listAssetsByJob(jobId).filter((item) => (item.role || "result") === role)) {
        try {
            unlinkSync(join(generationsRoot(), asset.path));
        } catch {
            // Missing files should not block replacing assets.
        }
    }
    deleteAssetsByJobRole(jobId, role);
}

async function replaceRoleMedia(userId: string, jobId: string, role: GenerationAssetRole, items: MediaInput[]) {
    clearRoleAssets(jobId, role);
    const meta: Array<Record<string, unknown>> = [];
    for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const file = await materializeFile(item);
        if (!file) continue;
        const assetIndex = writeParsedAsset(userId, jobId, role, index, file);
        meta.push({
            id: String(item.id || `${role}-${index}`),
            name: String(item.name || ""),
            type: String(item.type || file.mime),
            index: assetIndex,
            width: Number(item.width || file.width || 0) || 0,
            height: Number(item.height || file.height || 0) || 0,
            durationMs: Number(item.durationMs || 0) || 0,
            bytes: Number(item.bytes || file.bytes.length || 0) || 0,
        });
    }
    return meta;
}

function replaceResultAsset(userId: string, jobId: string, index: number, file: { mime: string; bytes: Buffer; width: number; height: number }) {
    const itemIndex = ROLE_INDEX.result + index;
    const existing = findAsset(jobId, itemIndex);
    if (existing) {
        try {
            unlinkSync(join(generationsRoot(), existing.path));
        } catch {
            // Missing files should not block replacing assets.
        }
        deleteAsset(jobId, itemIndex);
    }
    writeParsedAsset(userId, jobId, "result", index, file);
}

function findJobForVodSnapshot(snapshot: VodTaskSnapshot) {
    const context = decodeTaskContext(snapshot.sessionContext);
    if (context) {
        const job = findJobById(context.jobId);
        if (job) return { job, index: context.index };
    }
    if (!snapshot.taskId) return null;
    for (const job of listJobsByStatus("running")) {
        const slot = tencentSlots(parseExtra(job.extra_json)).find((item) => item.taskId === snapshot.taskId);
        if (slot) return { job, index: slot.index };
    }
    return null;
}

async function applyVodTaskSnapshot(snapshot: VodTaskSnapshot) {
    const matched = findJobForVodSnapshot(snapshot);
    if (!matched) return null;
    const { job, index } = matched;
    if (job.status !== "running") return publicJob(job);
    const extra = parseExtra(job.extra_json);
    const slots = tencentSlots(extra);
    const slot = slots.find((item) => item.index === index) || { taskId: snapshot.taskId, index, kind: snapshot.kind, status: "processing" as const };
    if (!slots.some((item) => item.index === index)) slots.push(slot);
    if (slot.status === "finish" || slot.status === "fail") return publicJob(job);
    if (snapshot.status === "PROCESSING") return publicJob(job);
    slot.taskId = slot.taskId || snapshot.taskId;
    slot.kind = snapshot.kind;
    const now = Date.now();
    if (snapshot.status === "FINISH" && snapshot.fileUrl) {
        slot.status = "finish";
        slot.fileUrl = snapshot.fileUrl;
        slot.error = "";
        if (getStoreMediaSetting()) {
            delete extra.resultUrls;
            const dataUrl = await fileUrlToDataUrl(snapshot.fileUrl);
            const parsed = parseDataUrl(dataUrl);
            if (parsed) replaceResultAsset(job.user_id, job.id, index, parsed);
            else extra.resultUrls = upsertResultUrl(extra.resultUrls, index, snapshot.fileUrl, job.count);
        } else {
            extra.resultUrls = upsertResultUrl(extra.resultUrls, index, snapshot.fileUrl, job.count);
        }
        withImmediate(() => insertLedger({ id: crypto.randomUUID(), user_id: job.user_id, job_id: job.id, delta: -1, reason: "generate", created_at: now }));
    } else {
        slot.status = "fail";
        slot.error = snapshot.error || (snapshot.status === "FINISH" ? "腾讯云点播任务完成但没有返回文件" : "腾讯云点播任务失败");
        refundCredits(job.user_id, jobQuotaKind(job), 1);
    }
    extra.tencentTasks = slots;
    const successCount = slots.filter((item) => item.status === "finish").length;
    const failCount = slots.filter((item) => item.status === "fail").length;
    const pending = slots.some((item) => item.status === "processing");
    const next: GenerationJobRow = {
        ...job,
        extra_json: JSON.stringify(extra),
        success_count: successCount,
        fail_count: failCount,
        status: pending ? "running" : successCount ? "success" : "failed",
        error: pending ? "" : successCount ? "" : slot.error || job.error || "腾讯云点播任务失败",
        duration_ms: Math.max(0, now - (job.started_at || job.created_at || now)),
        updated_at: now,
        finished_at: pending ? 0 : now,
    };
    updateJob(next);
    const saved = findJobById(job.id)!;
    notifyJob(saved);
    return publicJob(saved);
}

function upsertResultUrl(value: unknown, index: number, url: string, count: number) {
    const current = Array.isArray(value) ? value.map((item) => String(item || "")) : [];
    const next = Array.from({ length: Math.max(count, index + 1, current.length) }, (_, itemIndex) => current[itemIndex] || "");
    next[index] = url;
    return next;
}

export async function handleTencentVodCallback(body: unknown) {
    for (const snapshot of parseVodCallback(body)) {
        await applyVodTaskSnapshot(snapshot);
    }
}

export async function refreshGenerationJob(userId: string, jobId: string) {
    const job = findJobById(jobId);
    if (!job || job.user_id !== userId) return null;
    const extra = parseExtra(job.extra_json);
    const slots = tencentSlots(extra);
    if (job.status === "running" && slots.length) {
        const { credentials } = resolveSharedTencentChannel(String(extra.channelId || ""));
        for (const slot of slots) {
            if (slot.status !== "processing" || !slot.taskId) continue;
            const snapshot = await describeVodTask(credentials, slot.taskId);
            await applyVodTaskSnapshot({ ...snapshot, taskId: slot.taskId, sessionContext: snapshot.sessionContext || encodeTaskContext(job.id, slot.index) });
        }
    }
    const latest = findJobById(jobId);
    if (!latest || latest.user_id !== userId) return null;
    return publicJob(latest);
}

function saveRunningJob(input: { userId: string; jobId?: string; body: CompanyImageRequest; planned: number; extra: Record<string, unknown>; kind: "image" | "video" }) {
    const existing = input.jobId ? findJobById(input.jobId) : null;
    if (input.jobId && (!existing || existing.user_id !== input.userId)) throw new Error("记录不存在");
    const now = Date.now();
    const jobId = existing?.id || crypto.randomUUID();
    const row: GenerationJobRow = {
        id: jobId,
        user_id: input.userId,
        kind: existing?.kind || input.kind,
        prompt: String(input.body.prompt || "").trim(),
        model: String(input.body.model || existing?.model || ""),
        size: String(input.body.size || existing?.size || ""),
        quality: String(input.body.quality || existing?.quality || ""),
        count: input.planned,
        status: "running",
        error: "",
        duration_ms: 0,
        success_count: 0,
        fail_count: 0,
        extra_json: JSON.stringify(input.extra),
        created_at: existing?.created_at || now,
        updated_at: now,
        started_at: existing?.started_at || now,
        finished_at: 0,
    };
    const slots = tencentSlots(input.extra);
    row.success_count = slots.filter((item) => item.status === "finish").length;
    row.fail_count = slots.filter((item) => item.status === "fail").length;
    if (existing) updateJob(row);
    else insertJob(row);
    return findJobById(jobId)!;
}

function markJobFailed(userId: string, jobId: string, error: string) {
    const job = findJobById(jobId);
    if (!job || job.user_id !== userId) return;
    updateJob({ ...job, extra_json: job.extra_json || "", status: "failed", error, updated_at: Date.now(), finished_at: Date.now(), started_at: job.started_at || 0 });
}

export async function generateCompanyImages(userId: string, body: CompanyImageRequest, signal?: AbortSignal) {
    return generateCompanyAigc(userId, body, "image", signal);
}

export async function generateCompanyVideos(userId: string, body: CompanyImageRequest, signal?: AbortSignal) {
    return generateCompanyAigc(userId, { ...body, count: 1 }, "video", signal);
}

async function generateCompanyAigc(userId: string, body: CompanyImageRequest, kind: "image" | "video", signal?: AbortSignal) {
    const prompt = String(body.prompt || "").trim();
    if (!prompt) throw new Error("请输入提示词");
    const { credentials, row } = resolveSharedTencentChannel(body.channelId);
    const planned = kind === "video" ? 1 : plannedCount(body);
    const jobId = String(body.jobId || "").trim() || undefined;
    const failedLabel = kind === "video" ? "腾讯云点播生视频失败" : "腾讯云点播生图失败";
    reserveCredits(userId, kind, planned);
    const extra = parseExtra(jobId ? findJobById(jobId)?.extra_json : undefined);
    extra.channelId = row.id;
    extra.tencentTasks = [];
    if (kind === "video") {
        extra.videoModel = body.model;
        extra.vquality = body.quality;
        extra.videoSeconds = body.seconds;
        extra.videoGenerateAudio = body.generateAudio;
        extra.videoWatermark = body.watermark;
    }
    let job = saveRunningJob({ userId, jobId, body: { ...body, prompt, count: planned }, planned, extra, kind });
    const slots: TencentTaskSlot[] = [];
    try {
        for (let index = 0; index < planned; index += 1) {
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
            try {
                const taskId = kind === "video"
                    ? await createCompanyVideoTask(credentials, prompt, { ...body, count: 1 }, encodeTaskContext(job.id, index), signal)
                    : await createCompanyImageTask(credentials, prompt, { ...body, count: 1 }, encodeTaskContext(job.id, index), signal);
                slots.push({ taskId, index, kind, status: "processing" });
            } catch (error) {
                if (isAbortError(error) || signal?.aborted) throw error;
                slots.push({ taskId: "", index, kind, status: "fail", error: error instanceof Error ? error.message : failedLabel });
                refundCredits(userId, kind, 1);
            }
            extra.tencentTasks = slots;
            job = saveRunningJob({ userId, jobId: job.id, body: { ...body, prompt, count: planned }, planned, extra, kind });
        }
    } catch (error) {
        const uncreated = planned - slots.length;
        if (uncreated > 0) refundCredits(userId, kind, uncreated);
        for (let index = slots.length; index < planned; index += 1) {
            slots.push({ taskId: "", index, kind, status: "fail", error: isAbortError(error) ? "请求已取消" : error instanceof Error ? error.message : failedLabel });
        }
        extra.tencentTasks = slots;
        job = saveRunningJob({ userId, jobId: job.id, body: { ...body, prompt, count: planned }, planned, extra, kind });
        if (!slots.some((slot) => slot.status === "processing")) {
            markJobFailed(userId, job.id, isAbortError(error) ? "请求已取消" : error instanceof Error ? error.message : failedLabel);
            throw error;
        }
    }
    if (!slots.some((slot) => slot.status === "processing")) {
        const failed = findJobById(job.id)!;
        const error = slots.find((slot) => slot.error)?.error || failedLabel;
        const next = { ...failed, extra_json: failed.extra_json || "", status: "failed" as const, error, fail_count: slots.length, updated_at: Date.now(), finished_at: Date.now(), started_at: failed.started_at || 0 };
        updateJob(next);
        notifyJob(findJobById(job.id)!);
        throw new Error(error);
    }
    const latest = findJobById(job.id)!;
    notifyJob(latest);
    const user = ensureQuotaDay(userId);
    return { id: latest.id, status: latest.status, ...(user ? quotaEventFields(user) : { imageRemaining: 0, videoRemaining: 0 }) };
}

type MediaInput = {
    id?: string;
    name?: string;
    type?: string;
    dataUrl?: string;
    url?: string;
    width?: number;
    height?: number;
    durationMs?: number;
    bytes?: number;
};

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
    resultUrls?: unknown;
    references?: MediaInput[];
    videoReferences?: MediaInput[];
    audioReferences?: MediaInput[];
    video?: { dataUrl?: string; url?: string };
    startedAt?: unknown;
    finishedAt?: unknown;
};

function normalizeKind(value: unknown, fallback = "image") {
    return value === "video" || value === "image" ? value : fallback;
}

function normalizeStatus(value: unknown, fallback: GenerationJobStatus): GenerationJobStatus {
    return value === "draft" || value === "running" || value === "success" || value === "failed" ? value : fallback;
}

type GenerationJobStatus = GenerationJobRow["status"];

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

function asMediaList(value: unknown): MediaInput[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const record = item as Record<string, unknown>;
        return [
            {
                id: asText(record.id),
                name: asText(record.name),
                type: asText(record.type),
                dataUrl: asText(record.dataUrl) || undefined,
                url: asText(record.url) || undefined,
                width: Number(record.width) || 0,
                height: Number(record.height) || 0,
                durationMs: Number(record.durationMs) || 0,
                bytes: Number(record.bytes) || 0,
            },
        ];
    });
}

async function applyMedia(userId: string, job: GenerationJobRow, input: GenerationWriteInput, extra: Record<string, unknown>) {
    delete extra.video;
    if (!getStoreMediaSetting()) {
        if (input.resultUrls !== undefined || input.images !== undefined) extra.resultUrls = sanitizeResultUrls(input.resultUrls ?? input.images?.map((image) => image.dataUrl));
        return extra;
    }
    delete extra.resultUrls;
    if (input.references !== undefined) extra.references = await replaceRoleMedia(userId, job.id, "image-ref", asMediaList(input.references) || []);
    if (input.videoReferences !== undefined) extra.videoReferences = await replaceRoleMedia(userId, job.id, "video-ref", asMediaList(input.videoReferences) || []);
    if (input.audioReferences !== undefined) extra.audioReferences = await replaceRoleMedia(userId, job.id, "audio-ref", asMediaList(input.audioReferences) || []);
    const resultItems: MediaInput[] = [];
    if (input.images?.length) resultItems.push(...input.images.filter((image) => image.dataUrl).map((image) => ({ dataUrl: image.dataUrl })));
    if (input.video?.dataUrl || (input.video?.url && isRemoteUrl(input.video.url))) resultItems.push({ dataUrl: input.video.dataUrl, url: input.video.url });
    if (resultItems.length) await replaceRoleMedia(userId, job.id, "result", resultItems);
    else if (input.resultUrls !== undefined) await replaceRoleMedia(userId, job.id, "result", sanitizeResultUrls(input.resultUrls).map((url) => ({ url })));
    return extra;
}

export async function createGeneration(userId: string, input: GenerationWriteInput) {
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
    const job = findJobById(jobId)!;
    const extra = await applyMedia(userId, job, input, parseExtra(job.extra_json));
    updateJob({ ...job, extra_json: JSON.stringify(extra) });
    return publicJob(findJobById(jobId)!);
}

export async function patchGeneration(userId: string, id: string, input: GenerationWriteInput) {
    const job = findJobById(id);
    if (!job || job.user_id !== userId) return null;
    const now = Date.now();
    const extra = await applyMedia(userId, job, input, { ...parseExtra(job.extra_json), ...sanitizeExtra(input.extra) });
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
        extra_json: JSON.stringify(extra),
        updated_at: now,
        started_at: input.startedAt === undefined ? job.started_at || 0 : asTime(input.startedAt),
        finished_at: input.finishedAt === undefined ? job.finished_at || 0 : asTime(input.finishedAt),
    };
    updateJob(next);
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
