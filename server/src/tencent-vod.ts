import { signTencentCloudRequest } from "./sign";

const SERVICE = "vod";
const API_VERSION = "2018-07-17";
const HOST = "vod.tencentcloudapi.com";
const POLL_INTERVAL_MS = 5000;
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
type DescribeTaskPayload = {
    Status?: string;
    AigcImageTask?: {
        Status?: string;
        ErrCode?: number;
        ErrCodeExt?: string;
        Message?: string;
        Output?: { FileInfos?: Array<{ FileUrl?: string }> };
    };
};
type FileInfo = { Type: "Base64"; Base64: string; ReferenceType?: "mask" };

export type CompanyImageRequest = {
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
    return { id: COMPANY_TENCENT_VOD_CHANNEL_ID, apiFormat: "tencent-vod", models: TENCENT_VOD_MODELS };
}

export async function generateCompanyTencentVodImages(body: CompanyImageRequest, signal?: AbortSignal) {
    const credentials = tencentVodCredentials();
    if (!credentials) throw new Error("公司腾讯云点播未配置");
    const prompt = String(body.prompt || "").trim();
    if (!prompt) throw new Error("请输入提示词");
    const images: Array<{ id: string; dataUrl: string }> = [];
    const total = Math.max(1, Math.min(15, Math.floor(Number(body.count) || 1)));
    for (let index = 0; index < total; index += 1) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        images.push(await generateOne(credentials, prompt, body, signal));
    }
    return images;
}

async function generateOne(credentials: { secretId: string; secretKey: string; subAppId: string }, prompt: string, body: CompanyImageRequest, signal?: AbortSignal) {
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
        OutputConfig: outputConfig,
        ...(fileInfos.length ? { FileInfos: fileInfos } : {}),
        ...(Object.keys(additional).length ? { ExtInfo: JSON.stringify({ AdditionalParameters: JSON.stringify(additional) }) } : {}),
    }, signal);
    const taskId = created.TaskId?.trim();
    if (!taskId) throw new Error("腾讯云点播生图失败");
    const fileUrl = await pollTask(credentials, taskId, signal);
    return { id: crypto.randomUUID(), dataUrl: await fileUrlToDataUrl(fileUrl, signal) };
}

async function pollTask(credentials: { secretId: string; secretKey: string; subAppId: string }, taskId: string, signal?: AbortSignal) {
    while (true) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const detail = await callVod<DescribeTaskPayload>(credentials, "DescribeTaskDetail", { SubAppId: Number(credentials.subAppId), TaskId: taskId }, signal);
        const task = detail.AigcImageTask;
        const status = (task?.Status || detail.Status || "").toUpperCase();
        if (task?.ErrCode || task?.ErrCodeExt || status === "FAIL") throw new Error(task?.Message || task?.ErrCodeExt || "腾讯云点播生图失败");
        if (status === "FINISH") {
            const fileUrl = task?.Output?.FileInfos?.map((item) => item.FileUrl).find(Boolean);
            if (!fileUrl) throw new Error("腾讯云点播任务完成但没有返回图片");
            return fileUrl;
        }
        await sleep(POLL_INTERVAL_MS, signal);
    }
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

async function fileUrlToDataUrl(url: string, signal?: AbortSignal) {
    try {
        const response = await fetch(url, { signal });
        const mime = response.headers.get("content-type") || "image/png";
        const bytes = Buffer.from(await response.arrayBuffer());
        return `data:${mime};base64,${bytes.toString("base64")}`;
    } catch {
        return url;
    }
}

function sleep(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const timer = setTimeout(resolve, ms);
        const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}
