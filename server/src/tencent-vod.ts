import { signTencentCloudRequest } from "./sign";

const SERVICE = "vod";
const API_VERSION = "2018-07-17";
const HOST = "vod.tencentcloudapi.com";
const GG_ASPECT_RATIOS = ["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

export const COMPANY_TENCENT_VOD_CHANNEL_ID = "company-tencent-vod";
export const TENCENT_VOD_MODELS = [
    { name: "image2_low", capability: "image" as const },
    { name: "image2_medium", capability: "image" as const },
    { name: "image2_high", capability: "image" as const },
    { name: "gg_2.5", capability: "image" as const },
    { name: "gg_3.0", capability: "image" as const },
    { name: "gg_3.1", capability: "image" as const },
];

type VodModel = { modelName: "OG" | "GG"; modelVersion: string };
type TencentCloudResponse<T> = { Response?: T & { Error?: { Code?: string; Message?: string } } };
type CreateTaskPayload = { TaskId?: string };
type AigcTaskPayload = {
    TaskId?: string;
    Status?: string;
    ErrCode?: number;
    ErrCodeExt?: string;
    Message?: string;
    SessionContext?: string;
    Output?: { FileInfos?: Array<{ FileUrl?: string }> };
};
type DescribeTaskPayload = {
    Status?: string;
    AigcImageTask?: AigcTaskPayload;
    AigcVideoTask?: AigcTaskPayload;
};
type FileInfo = { Type: "Base64"; Base64: string; ReferenceType?: "mask" };

export type VodTaskKind = "image" | "video";
export type VodTaskSnapshot = {
    taskId: string;
    kind: VodTaskKind;
    status: "PROCESSING" | "FINISH" | "FAIL";
    fileUrl: string;
    error: string;
    sessionContext: string;
};

export type CompanyImageRequest = {
    channelId?: string;
    jobId?: string;
    model?: string;
    prompt?: string;
    references?: Array<{ dataUrl?: string }>;
    mask?: { dataUrl?: string } | null;
    count?: number;
    quality?: string;
    size?: string;
    background?: string;
};

export function tencentVodCredentials() {
    const secretId = process.env.TENCENT_VOD_SECRET_ID?.trim() || "";
    const secretKey = process.env.TENCENT_VOD_SECRET_KEY?.trim() || "";
    const subAppId = process.env.TENCENT_VOD_SUB_APP_ID?.trim() || "";
    if (!secretId || !secretKey || !subAppId) return null;
    return { secretId, secretKey, subAppId };
}

export function companyTencentVodChannel() {
    if (!tencentVodCredentials()) return null;
    return {
        id: COMPANY_TENCENT_VOD_CHANNEL_ID,
        name: "腾讯云",
        apiFormat: "tencent-vod",
        models: TENCENT_VOD_MODELS,
    };
}

export function encodeTaskContext(jobId: string, index: number) {
    return JSON.stringify({ j: jobId, i: index });
}

export function decodeTaskContext(value: string) {
    try {
        const parsed = JSON.parse(value || "") as { j?: unknown; i?: unknown };
        const jobId = String(parsed.j || "").trim();
        const index = Math.round(Number(parsed.i));
        if (!jobId || !Number.isFinite(index) || index < 0) return null;
        return { jobId, index };
    } catch {
        return null;
    }
}

export async function createCompanyImageTask(credentials: { secretId: string; secretKey: string; subAppId: string }, prompt: string, body: CompanyImageRequest, sessionContext: string, signal?: AbortSignal) {
    const resolved = resolveVodModel(body.model || "", body.quality);
    const isGg = resolved.modelName === "GG";
    if (isGg && body.mask?.dataUrl) throw new Error("蒙版编辑暂不支持该模型，请使用其他渠道");
    const fileInfos = buildFileInfos((body.references || []).slice(0, maxReferenceCount(resolved)), isGg ? undefined : body.mask);
    const additional: Record<string, string> = {};
    const outputConfig: Record<string, string> = { StorageMode: "Temporary" };
    if (isGg) {
        const aspectRatio = toGgAspectRatio(body.size);
        if (aspectRatio) outputConfig.AspectRatio = aspectRatio;
    } else {
        const ogSize = toOgSize(body.size);
        if (ogSize) additional.size = ogSize;
        if (body.background) additional.background = body.background;
    }
    const created = await callVod<CreateTaskPayload>(credentials, "CreateAigcImageTask", {
        SubAppId: Number(credentials.subAppId),
        ModelName: resolved.modelName,
        ModelVersion: resolved.modelVersion,
        Prompt: prompt,
        EnhancePrompt: "Disabled",
        SessionContext: sessionContext,
        OutputConfig: outputConfig,
        ...(fileInfos.length ? { FileInfos: fileInfos } : {}),
        ...(Object.keys(additional).length ? { ExtInfo: JSON.stringify({ AdditionalParameters: JSON.stringify(additional) }) } : {}),
    }, signal);
    const taskId = created.TaskId?.trim();
    if (!taskId) throw new Error("腾讯云点播生图失败");
    return taskId;
}

export async function describeVodTask(credentials: { secretId: string; secretKey: string; subAppId: string }, taskId: string): Promise<VodTaskSnapshot> {
    const detail = await callVod<DescribeTaskPayload>(credentials, "DescribeTaskDetail", { SubAppId: Number(credentials.subAppId), TaskId: taskId });
    const kind: VodTaskKind = detail.AigcVideoTask ? "video" : "image";
    const snapshot = snapshotFromAigcTask(detail.AigcImageTask || detail.AigcVideoTask || { TaskId: taskId, Status: detail.Status }, kind, detail.Status) || {
        taskId,
        kind,
        status: "PROCESSING",
        fileUrl: "",
        error: "",
        sessionContext: "",
    };
    return { ...snapshot, taskId: snapshot.taskId || taskId };
}

export function parseVodCallback(body: unknown) {
    const snapshots: VodTaskSnapshot[] = [];
    const visit = (value: unknown) => {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        if (typeof value !== "object") return;
        const record = value as Record<string, unknown>;
        const eventType = String(record.EventType || "").trim();
        if (eventType === "AigcImageTaskComplete" || record.AigcImageCompleteEvent) {
            const snapshot = snapshotFromAigcTask(record.AigcImageCompleteEvent, "image");
            if (snapshot) snapshots.push(snapshot);
        }
        if (eventType === "AigcVideoTaskComplete" || record.AigcVideoCompleteEvent) {
            const snapshot = snapshotFromAigcTask(record.AigcVideoCompleteEvent, "video");
            if (snapshot) snapshots.push(snapshot);
        }
        visit(record.EventSet);
        visit(record.EventContent);
        visit(record.Response);
    };
    visit(body);
    return snapshots;
}

function snapshotFromAigcTask(value: unknown, kind: VodTaskKind, fallbackStatus?: string): VodTaskSnapshot | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        if (!fallbackStatus) return null;
        return { taskId: "", kind, status: normalizeTaskStatus(fallbackStatus, 0, ""), fileUrl: "", error: "", sessionContext: "" };
    }
    const task = value as AigcTaskPayload;
    const taskId = String(task.TaskId || "").trim();
    const error = String(task.Message || task.ErrCodeExt || "").trim();
    const status = normalizeTaskStatus(task.Status || fallbackStatus, task.ErrCode, task.ErrCodeExt);
    const fileUrl = (task.Output?.FileInfos || []).map((item) => String(item.FileUrl || "").trim()).find(Boolean) || "";
    if (!taskId && status === "PROCESSING") return null;
    return { taskId, kind, status, fileUrl, error, sessionContext: String(task.SessionContext || "").trim() };
}

function normalizeTaskStatus(status: string | undefined, errCode?: number, errCodeExt?: string): VodTaskSnapshot["status"] {
    const value = String(status || "").toUpperCase();
    if (errCode || errCodeExt || value === "FAIL" || value === "FAILED") return "FAIL";
    if (value === "FINISH" || value === "DONE" || value === "SUCCESS") return "FINISH";
    return "PROCESSING";
}

async function callVod<T>(credentials: { secretId: string; secretKey: string }, action: string, payload: Record<string, unknown>, signal?: AbortSignal) {
    const body = JSON.stringify(payload);
    const signed = signTencentCloudRequest({ secretId: credentials.secretId, secretKey: credentials.secretKey, service: SERVICE, host: HOST, action, payload: body });
    const response = await fetch(`https://${HOST}/`, {
        method: "POST",
        headers: {
            Authorization: signed.authorization,
            "Content-Type": signed.contentType,
            "X-TC-Action": action,
            "X-TC-Timestamp": String(signed.timestamp),
            "X-TC-Version": API_VERSION,
            "X-TC-Language": "zh-CN",
        },
        body,
        signal,
    });
    const data = (await response.json()) as TencentCloudResponse<T>;
    const result = data.Response;
    if (!result) throw new Error("腾讯云点播生图失败");
    if (result.Error?.Message || result.Error?.Code) throw new Error(result.Error.Message || result.Error.Code || "腾讯云点播生图失败");
    return result;
}

function toOgSize(size?: string) {
    const value = size?.trim();
    if (!value || value.toLowerCase() === "auto") return undefined;
    return value.replace(/\*/g, "x");
}

function toGgAspectRatio(size?: string) {
    const value = size?.trim().toLowerCase();
    if (!value || value === "auto") return undefined;
    const parts = value.includes(":") ? value.split(":") : value.split(/[x*]/);
    const width = Number(parts[0]);
    const height = Number(parts[1]);
    if (!width || !height) return undefined;
    const target = width / height;
    return GG_ASPECT_RATIOS.reduce((best, item) => {
        const [currentWidth, currentHeight] = item.split(":").map(Number);
        const [bestWidth, bestHeight] = best.split(":").map(Number);
        return Math.abs(currentWidth / currentHeight - target) < Math.abs(bestWidth / bestHeight - target) ? item : best;
    });
}

function maxReferenceCount(model: VodModel) {
    if (model.modelName !== "GG") return 16;
    return model.modelVersion === "2.5" ? 3 : 14;
}

function resolveVodModel(model: string, quality?: string): VodModel {
    const name = model.trim().toLowerCase();
    if (name.includes("image2") || name.endsWith("_high") || name.endsWith("_medium") || name.endsWith("_low")) {
        return { modelName: "OG", modelVersion: resolveOgModelVersion(name, quality) };
    }
    if (name.includes("3.1")) return { modelName: "GG", modelVersion: "3.1" };
    if (name.includes("3.0") || /gg[_-]?3(?!\.1)/.test(name)) return { modelName: "GG", modelVersion: "3.0" };
    if (name.includes("2.5") || name.includes("gg") || name.includes("nano")) return { modelName: "GG", modelVersion: "2.5" };
    return { modelName: "OG", modelVersion: resolveOgModelVersion(name, quality) };
}

function resolveOgModelVersion(model: string, quality?: string) {
    const name = model.trim().toLowerCase();
    if (name.includes("image2_high") || name.endsWith("_high")) return "image2_high";
    if (name.includes("image2_low") || name.endsWith("_low")) return "image2_low";
    if (name.includes("image2_medium") || name.endsWith("_medium")) return "image2_medium";
    if (quality === "high") return "image2_high";
    if (quality === "low") return "image2_low";
    return "image2_medium";
}

function buildFileInfos(references: Array<{ dataUrl?: string }>, mask?: { dataUrl?: string } | null): FileInfo[] {
    const files: FileInfo[] = [];
    for (const image of references) {
        const base64 = toRawBase64(image.dataUrl || "");
        if (base64) files.push({ Type: "Base64", Base64: base64 });
    }
    if (mask?.dataUrl) {
        if (!files.length) throw new Error("蒙版编辑需要同时提供原图");
        files.push({ Type: "Base64", Base64: toRawBase64(mask.dataUrl), ReferenceType: "mask" });
    }
    return files;
}

function toRawBase64(dataUrl: string) {
    const index = dataUrl.indexOf(",");
    return index >= 0 ? dataUrl.slice(index + 1) : dataUrl;
}

export async function fileUrlToDataUrl(url: string, signal?: AbortSignal) {
    try {
        const response = await fetch(url, { signal });
        const mime = response.headers.get("content-type") || "image/png";
        const bytes = Buffer.from(await response.arrayBuffer());
        return `data:${mime};base64,${bytes.toString("base64")}`;
    } catch {
        return url;
    }
}
