import axios from "axios";

import i18n from "@/i18n";
import { signTencentCloudRequest } from "@/lib/tencent-cloud-api";
import type { AiConfig } from "@/stores/use-config-store";
import { TENCENT_VOD_DEFAULT_MODELS, TENCENT_VOD_HOST } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";
import { nanoid } from "nanoid";

const apiText = (key: string, options?: Record<string, unknown>) => i18n.t(`apiErrors.${key}`, options);
const SERVICE = "vod";
const API_VERSION = "2018-07-17";
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

type TencentCloudResponse<T> = { Response?: T & { Error?: { Code?: string; Message?: string }; RequestId?: string } };
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

export const TENCENT_VOD_MODEL_NAMES = TENCENT_VOD_DEFAULT_MODELS.map((model) => model.name);

export function isTencentVodConfig(config: Pick<AiConfig, "apiFormat">) {
    return config.apiFormat === "tencent-vod";
}

export function assertTencentVodReady(config: AiConfig) {
    if (!config.apiKey.trim()) throw new Error(apiText("tencentVodSecretRequired"));
    if (!config.secretKey?.trim()) throw new Error(apiText("tencentVodSecretRequired"));
    if (!config.subAppId?.trim()) throw new Error(apiText("tencentVodSubAppIdRequired"));
}

export async function requestTencentVodImages(config: AiConfig, prompt: string, references: ReferenceImage[], mask: ReferenceImage | undefined, count: number, quality: string | undefined, size: string | undefined, background: string | undefined, signal?: AbortSignal) {
    assertTencentVodReady(config);
    const images: Array<{ id: string; dataUrl: string }> = [];
    const total = Math.max(1, count);
    for (let index = 0; index < total; index += 1) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        images.push(await generateOne(config, prompt, references, mask, quality, size, background, signal));
    }
    return images;
}

async function generateOne(config: AiConfig, prompt: string, references: ReferenceImage[], mask: ReferenceImage | undefined, quality: string | undefined, size: string | undefined, background: string | undefined, signal?: AbortSignal) {
    const fileInfos = await buildFileInfos(references, mask);
    const additional: Record<string, string> = {};
    const ogSize = toOgSize(size);
    if (ogSize) additional.size = ogSize;
    if (background) additional.background = background;
    const created = await callVod<CreateTaskPayload>(config, "CreateAigcImageTask", {
        SubAppId: Number(config.subAppId),
        ModelName: "OG",
        ModelVersion: resolveOgModelVersion(config.model, quality),
        Prompt: prompt,
        EnhancePrompt: "Disabled",
        OutputConfig: { StorageMode: "Temporary" },
        ...(fileInfos.length ? { FileInfos: fileInfos } : {}),
        ...(Object.keys(additional).length ? { ExtInfo: JSON.stringify({ AdditionalParameters: JSON.stringify(additional) }) } : {}),
    }, signal);
    const taskId = created.TaskId?.trim();
    if (!taskId) throw new Error(apiText("tencentVodFailed"));
    const fileUrl = await pollTask(config, taskId, signal);
    return { id: nanoid(), dataUrl: await fileUrlToDataUrl(fileUrl, signal) };
}

async function pollTask(config: AiConfig, taskId: string, signal?: AbortSignal) {
    const started = Date.now();
    while (Date.now() - started < POLL_TIMEOUT_MS) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const detail = await callVod<DescribeTaskPayload>(config, "DescribeTaskDetail", { SubAppId: Number(config.subAppId), TaskId: taskId }, signal);
        const task = detail.AigcImageTask;
        if (task?.ErrCode || task?.ErrCodeExt) throw new Error(task.Message || task.ErrCodeExt || apiText("tencentVodFailed"));
        if (task?.Status === "FINISH" || detail.Status === "FINISH") {
            const fileUrl = task?.Output?.FileInfos?.map((item) => item.FileUrl).find(Boolean);
            if (!fileUrl) throw new Error(apiText("tencentVodNoImage"));
            return fileUrl;
        }
        await sleep(POLL_INTERVAL_MS, signal);
    }
    throw new Error(apiText("tencentVodTimeout"));
}

async function callVod<T>(config: AiConfig, action: string, payload: Record<string, unknown>, signal?: AbortSignal) {
    const body = JSON.stringify(payload);
    const signed = await signTencentCloudRequest({
        secretId: config.apiKey.trim(),
        secretKey: config.secretKey!.trim(),
        service: SERVICE,
        host: TENCENT_VOD_HOST,
        action,
        payload: body,
    });
    try {
        const response = await axios.post<TencentCloudResponse<T>>(vodEndpoint(config.baseUrl), body, {
            headers: {
                Authorization: signed.authorization,
                "Content-Type": signed.contentType,
                "X-TC-Action": action,
                "X-TC-Timestamp": String(signed.timestamp),
                "X-TC-Version": API_VERSION,
                "X-TC-Language": "zh-CN",
            },
            signal,
        });
        const result = response.data.Response;
        if (!result) throw new Error(apiText("tencentVodFailed"));
        if (result.Error?.Message || result.Error?.Code) throw new Error(result.Error.Message || result.Error.Code || apiText("tencentVodFailed"));
        return result;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const payload = error.response?.data as TencentCloudResponse<unknown> | undefined;
            const message = payload?.Response?.Error?.Message || payload?.Response?.Error?.Code;
            if (message) throw new Error(message);
        }
        throw error;
    }
}

function vodEndpoint(baseUrl: string) {
    const value = (baseUrl.trim() || "/tencent-vod").replace(/\/+$/, "");
    return value.startsWith("http") ? `${value}/` : value;
}

function toOgSize(size?: string) {
    const value = size?.trim();
    if (!value || value.toLowerCase() === "auto") return undefined;
    return value.replace(/\*/g, "x");
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

async function buildFileInfos(references: ReferenceImage[], mask?: ReferenceImage): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    for (const image of references) {
        files.push({ Type: "Base64", Base64: toRawBase64(image.dataUrl) });
    }
    if (mask) {
        if (!files.length) throw new Error(apiText("tencentVodMaskNeedsImage"));
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
        const response = await axios.get<Blob>(url, { responseType: "blob", signal });
        return blobToDataUrl(response.data);
    } catch {
        return url;
    }
}

function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
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
