import axios from "axios";

import i18n from "@/i18n";
import { signTencentCloudRequest } from "@/lib/tencent-cloud-api";
import { appApi } from "@/services/api/app-http";
import { fetchGeneration } from "@/services/api/generations";
import type { AiConfig } from "@/stores/use-config-store";
import { TENCENT_VOD_DEFAULT_MODELS, TENCENT_VOD_HOST } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";
import { nanoid } from "nanoid";

const apiText = (key: string, options?: Record<string, unknown>) => i18n.t(`apiErrors.${key}`, options);
const SERVICE = "vod";
const API_VERSION = "2018-07-17";
const POLL_INTERVAL_MS = 5000;
const GG_ASPECT_RATIOS = ["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const VIDEO_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "2:3", "3:2"];
const VIDEO_FAMILIES: Record<string, string> = { kling: "Kling", vidu: "Vidu", hailuo: "Hailuo", hunyuan: "Hunyuan", mingmou: "Mingmou", gv: "GV", os: "OS", pixverse: "PixVerse" };
const TENCENT_VOD_VIDEO_MODELS = [
    { name: "kling_1.6", modelName: "Kling", modelVersion: "1.6" },
    { name: "kling_2.0", modelName: "Kling", modelVersion: "2.0" },
    { name: "kling_2.1", modelName: "Kling", modelVersion: "2.1" },
    { name: "kling_2.5", modelName: "Kling", modelVersion: "2.5" },
    { name: "kling_2.6", modelName: "Kling", modelVersion: "2.6" },
    { name: "kling_o1", modelName: "Kling", modelVersion: "O1" },
    { name: "kling_3.0", modelName: "Kling", modelVersion: "3.0" },
    { name: "kling_3.0-omni", modelName: "Kling", modelVersion: "3.0-Omni" },
    { name: "vidu_q2", modelName: "Vidu", modelVersion: "q2" },
    { name: "vidu_q2-pro", modelName: "Vidu", modelVersion: "q2-pro" },
    { name: "vidu_q2-turbo", modelName: "Vidu", modelVersion: "q2-turbo" },
    { name: "vidu_q3", modelName: "Vidu", modelVersion: "q3" },
    { name: "vidu_q3-pro", modelName: "Vidu", modelVersion: "q3-pro" },
    { name: "vidu_q3-turbo", modelName: "Vidu", modelVersion: "q3-turbo" },
    { name: "hailuo_02", modelName: "Hailuo", modelVersion: "02" },
    { name: "hailuo_2.3", modelName: "Hailuo", modelVersion: "2.3" },
    { name: "hailuo_2.3-fast", modelName: "Hailuo", modelVersion: "2.3-fast" },
    { name: "hailuo_h3", modelName: "Hailuo", modelVersion: "H3" },
    { name: "hunyuan_1.5", modelName: "Hunyuan", modelVersion: "1.5" },
    { name: "mingmou_1.0", modelName: "Mingmou", modelVersion: "1.0" },
    { name: "gv_3.1", modelName: "GV", modelVersion: "3.1" },
    { name: "gv_3.1-fast", modelName: "GV", modelVersion: "3.1-fast" },
    { name: "os_2.0", modelName: "OS", modelVersion: "2.0" },
    { name: "pixverse_v5.6", modelName: "PixVerse", modelVersion: "v5.6" },
    { name: "pixverse_v6", modelName: "PixVerse", modelVersion: "v6" },
    { name: "pixverse_c1", modelName: "PixVerse", modelVersion: "c1" },
];

type VodModel = { modelName: "OG" | "GG"; modelVersion: string };
type VodVideoModel = { modelName: string; modelVersion: string };

type TencentCloudResponse<T> = { Response?: T & { Error?: { Code?: string; Message?: string }; RequestId?: string } };
type CreateTaskPayload = { TaskId?: string };
type AigcTaskPayload = {
    Status?: string;
    ErrCode?: number;
    ErrCodeExt?: string;
    Message?: string;
    Output?: { FileInfos?: Array<{ FileUrl?: string }> };
};
type DescribeTaskPayload = {
    Status?: string;
    AigcImageTask?: AigcTaskPayload;
    AigcVideoTask?: AigcTaskPayload;
};
type FileInfo = { Type: "Base64"; Base64: string; ReferenceType?: "mask" };
type VideoFileInfo = { Type: "Base64" | "Url"; Category: "Image" | "Video" | "Audio"; Base64?: string; Url?: string; Usage?: string };
type MediaRef = { dataUrl?: string; url?: string };

export const TENCENT_VOD_MODEL_NAMES = TENCENT_VOD_DEFAULT_MODELS.map((model) => model.name);

export function isTencentVodConfig(config: Pick<AiConfig, "apiFormat">) {
    return config.apiFormat === "tencent-vod";
}

export function assertTencentVodReady(config: AiConfig) {
    if (config.managed) return;
    if (!config.apiKey.trim()) throw new Error(apiText("tencentVodSecretRequired"));
    if (!config.secretKey?.trim()) throw new Error(apiText("tencentVodSecretRequired"));
    if (!config.subAppId?.trim()) throw new Error(apiText("tencentVodSubAppIdRequired"));
}

export async function requestTencentVodImages(config: AiConfig, prompt: string, references: ReferenceImage[], mask: ReferenceImage | undefined, count: number, quality: string | undefined, size: string | undefined, background: string | undefined, signal?: AbortSignal, jobId?: string, wait = true) {
    if (config.managed) return requestCompanyTencentVodImages(prompt, references, mask, count, quality, size, background, config.model, config.channelId, signal, jobId, wait);
    assertTencentVodReady(config);
    const images: Array<{ id: string; dataUrl: string }> = [];
    const total = Math.max(1, count);
    for (let index = 0; index < total; index += 1) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        images.push(await generateOne(config, prompt, references, mask, quality, size, background, signal));
    }
    return images;
}

export async function requestTencentVodVideo(config: AiConfig, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], options?: { signal?: AbortSignal; jobId?: string; wait?: boolean }) {
    const wait = options?.wait !== false;
    const images = await Promise.all(references.map(async (image) => ({ ...image, dataUrl: await hydrateMediaUrl(image.dataUrl) })));
    const videos = await Promise.all(videoReferences.map(async (item) => ({ ...item, url: await hydrateMediaUrl(item.url) })));
    const audios = await Promise.all(audioReferences.map(async (item) => ({ ...item, url: await hydrateMediaUrl(item.url) })));
    if (config.managed) return requestCompanyTencentVodVideo(config, prompt, images, videos, audios, options?.signal, options?.jobId, wait);
    assertTencentVodReady(config);
    const taskId = await createPersonalVideoTask(config, prompt, images, videos, audios, options?.signal);
    if (!wait) return { taskId, url: "" };
    return { taskId, url: await pollTask(config, taskId, options?.signal, "video") };
}

export async function pollTencentVodVideoTask(config: AiConfig, taskId: string, signal?: AbortSignal) {
    const detail = await callVod<DescribeTaskPayload>(config, "DescribeTaskDetail", { SubAppId: Number(config.subAppId), TaskId: taskId }, signal);
    const task = detail.AigcVideoTask || detail.AigcImageTask;
    const status = (task?.Status || detail.Status || "").toUpperCase();
    if (task?.ErrCode || task?.ErrCodeExt || status === "FAIL") throw new Error(task?.Message || task?.ErrCodeExt || apiText("tencentVodFailed"));
    if (status === "FINISH") {
        const fileUrl = task?.Output?.FileInfos?.map((item) => item.FileUrl).find(Boolean);
        if (!fileUrl) throw new Error(apiText("tencentVodNoVideo"));
        return fileUrl;
    }
    return "";
}

async function requestCompanyTencentVodVideo(config: AiConfig, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], signal: AbortSignal | undefined, jobId: string | undefined, wait: boolean) {
    const response = await appApi.post<{ id?: string; status?: string; error?: string; creditBalance?: number }>("/api/tencent-vod/videos", {
        channelId: config.channelId,
        jobId,
        model: config.model,
        prompt,
        references: references.map((image) => ({ dataUrl: image.dataUrl })),
        videoReferences: videoReferences.map((item) => (/^https?:\/\//i.test(item.url) ? { url: item.url } : { dataUrl: item.url })),
        audioReferences: audioReferences.map((item) => (/^https?:\/\//i.test(item.url) ? { url: item.url } : { dataUrl: item.url })),
        quality: config.vquality,
        size: config.size,
        seconds: config.videoSeconds,
        generateAudio: config.videoGenerateAudio,
        watermark: config.videoWatermark,
    }, { signal, timeout: 0 });
    if (typeof response.data.creditBalance === "number") {
        void import("@/stores/use-user-store").then(({ useUserStore }) => useUserStore.getState().setCreditBalance(response.data.creditBalance!));
    }
    if (response.data.status === "running" && response.data.id) {
        if (!wait) return { taskId: response.data.id, url: "" };
        return { taskId: response.data.id, url: await waitForCompanyVideo(response.data.id, signal) };
    }
    throw new Error(response.data.error || apiText("tencentVodNoVideo"));
}

async function waitForCompanyVideo(jobId: string, signal?: AbortSignal) {
    while (true) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const job = await fetchGeneration(jobId);
        if (job.status === "success" || job.status === "failed") {
            const url = job.assets.find((asset) => asset.mime.startsWith("video/"))?.url || (job.resultUrls || []).find((item) => /^https?:\/\//i.test(item)) || "";
            if (!url) throw new Error(job.error || apiText("tencentVodNoVideo"));
            return url;
        }
        await sleep(1000, signal);
    }
}

async function createPersonalVideoTask(config: AiConfig, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], signal?: AbortSignal) {
    const resolved = resolveVodVideoModel(config.model);
    const created = await callVod<CreateTaskPayload>(config, "CreateAigcVideoTask", {
        SubAppId: Number(config.subAppId),
        ModelName: resolved.modelName,
        ModelVersion: resolved.modelVersion,
        Prompt: prompt,
        EnhancePrompt: "Disabled",
        OutputConfig: buildVideoOutputConfig(resolved.modelName, config),
        ...videoFileInfosPayload(references, videoReferences, audioReferences),
    }, signal);
    const taskId = created.TaskId?.trim();
    if (!taskId) throw new Error(apiText("tencentVodFailed"));
    return taskId;
}

async function requestCompanyTencentVodImages(prompt: string, references: ReferenceImage[], mask: ReferenceImage | undefined, count: number, quality: string | undefined, size: string | undefined, background: string | undefined, model: string, channelId: string | undefined, signal?: AbortSignal, jobId?: string, wait = true) {
    const response = await appApi.post<{ id?: string; status?: string; images?: Array<{ id?: string; dataUrl?: string }>; error?: string; creditBalance?: number }>("/api/tencent-vod/images", {
        channelId,
        jobId,
        model,
        prompt,
        references: references.map((image) => ({ dataUrl: image.dataUrl })),
        mask: mask ? { dataUrl: mask.dataUrl } : undefined,
        count,
        quality,
        size,
        background,
    }, { signal, timeout: 0 });
    if (typeof response.data.creditBalance === "number") {
        void import("@/stores/use-user-store").then(({ useUserStore }) => useUserStore.getState().setCreditBalance(response.data.creditBalance!));
    }
    const images = (response.data.images || []).filter((image) => image.dataUrl).map((image) => ({ id: image.id || nanoid(), dataUrl: image.dataUrl! }));
    if (images.length) return images;
    if (response.data.status === "running" && response.data.id) {
        if (!wait) return [];
        return waitForCompanyImages(response.data.id, signal);
    }
    throw new Error(response.data.error || apiText("tencentVodNoImage"));
}

async function waitForCompanyImages(jobId: string, signal?: AbortSignal) {
    while (true) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const job = await fetchGeneration(jobId);
        if (job.status === "success" || job.status === "failed") {
            const images = [
                ...job.assets.filter((asset) => !asset.mime.startsWith("video/") && !asset.mime.startsWith("audio/")).map((asset) => ({ id: `${job.id}-${asset.index}`, dataUrl: asset.url })),
                ...(job.resultUrls || []).filter((url) => /^https?:\/\//i.test(url)).map((url, index) => ({ id: `${job.id}-url-${index}`, dataUrl: url })),
            ];
            if (!images.length) throw new Error(job.error || apiText("tencentVodNoImage"));
            return images;
        }
        await sleep(1000, signal);
    }
}

async function generateOne(config: AiConfig, prompt: string, references: ReferenceImage[], mask: ReferenceImage | undefined, quality: string | undefined, size: string | undefined, background: string | undefined, signal?: AbortSignal) {
    const resolved = resolveVodModel(config.model, quality);
    const isGg = resolved.modelName === "GG";
    if (isGg && mask) throw new Error(apiText("maskModelUnsupported"));
    const fileInfos = await buildFileInfos(references.slice(0, maxReferenceCount(resolved)), isGg ? undefined : mask);
    const additional: Record<string, string> = {};
    const outputConfig: Record<string, string> = { StorageMode: "Temporary" };
    if (isGg) {
        const aspectRatio = toGgAspectRatio(size);
        if (aspectRatio) outputConfig.AspectRatio = aspectRatio;
    } else {
        const ogSize = toOgSize(size);
        if (ogSize) additional.size = ogSize;
        if (background) additional.background = background;
    }
    const created = await callVod<CreateTaskPayload>(config, "CreateAigcImageTask", {
        SubAppId: Number(config.subAppId),
        ModelName: resolved.modelName,
        ModelVersion: resolved.modelVersion,
        Prompt: prompt,
        EnhancePrompt: "Disabled",
        OutputConfig: outputConfig,
        ...(fileInfos.length ? { FileInfos: fileInfos } : {}),
        ...(Object.keys(additional).length ? { ExtInfo: JSON.stringify({ AdditionalParameters: JSON.stringify(additional) }) } : {}),
    }, signal);
    const taskId = created.TaskId?.trim();
    if (!taskId) throw new Error(apiText("tencentVodFailed"));
    const fileUrl = await pollTask(config, taskId, signal);
    return { id: nanoid(), dataUrl: await fileUrlToDataUrl(fileUrl, signal) };
}

async function pollTask(config: AiConfig, taskId: string, signal?: AbortSignal, kind: "image" | "video" = "image") {
    while (true) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const detail = await callVod<DescribeTaskPayload>(config, "DescribeTaskDetail", { SubAppId: Number(config.subAppId), TaskId: taskId }, signal);
        const task = kind === "video" ? detail.AigcVideoTask : detail.AigcImageTask;
        const status = (task?.Status || detail.Status || "").toUpperCase();
        if (task?.ErrCode || task?.ErrCodeExt || status === "FAIL") throw new Error(task?.Message || task?.ErrCodeExt || apiText("tencentVodFailed"));
        if (status === "FINISH") {
            const fileUrl = task?.Output?.FileInfos?.map((item) => item.FileUrl).find(Boolean);
            if (!fileUrl) throw new Error(kind === "video" ? apiText("tencentVodNoVideo") : apiText("tencentVodNoImage"));
            return fileUrl;
        }
        await sleep(POLL_INTERVAL_MS, signal);
    }
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

function resolveVodVideoModel(model: string): VodVideoModel {
    const name = model.trim();
    const lower = name.toLowerCase();
    const known = TENCENT_VOD_VIDEO_MODELS.find((item) => item.name === lower);
    if (known) return { modelName: known.modelName, modelVersion: known.modelVersion };
    const matched = /^([a-z]+)[_-](.+)$/i.exec(name);
    const family = matched ? VIDEO_FAMILIES[matched[1].toLowerCase()] : undefined;
    if (!family || !matched) throw new Error(apiText("tencentVodFailed"));
    return { modelName: family, modelVersion: canonicalVideoVersion(family, matched[2]) };
}

function canonicalVideoVersion(modelName: string, version: string) {
    const value = version.trim();
    if (modelName === "Kling" && /^o1$/i.test(value)) return "O1";
    if (modelName === "Kling" && /3\.0[-_]?omni/i.test(value)) return "3.0-Omni";
    if (modelName === "Hailuo" && /^h3$/i.test(value)) return "H3";
    return value;
}

function buildVideoOutputConfig(modelName: string, config: AiConfig) {
    const output: Record<string, string | number> = { StorageMode: "Temporary" };
    const duration = Number(config.videoSeconds);
    if (Number.isFinite(duration) && duration > 0) output.Duration = duration;
    output.Resolution = toVideoResolution(config.vquality, modelName);
    const aspectRatio = toVideoAspectRatio(config.size);
    if (aspectRatio) output.AspectRatio = aspectRatio;
    output.AudioGeneration = String(config.videoGenerateAudio).toLowerCase() === "false" ? "Disabled" : "Enabled";
    if (String(config.videoWatermark).toLowerCase() === "true") output.LogoAdd = "Enabled";
    return output;
}

function toVideoResolution(quality: string | undefined, modelName: string) {
    const value = String(quality || "").trim().toLowerCase();
    if (modelName === "Hailuo") return value.includes("1080") || value === "high" ? "1080P" : "768P";
    if (modelName === "PixVerse") {
        if (value.includes("1080") || value === "high") return "1080p";
        if (value.includes("540") || value.includes("480") || value === "low") return "540p";
        return "720p";
    }
    if (value.includes("1080") || value === "high") return "1080P";
    return "720P";
}

function toVideoAspectRatio(size?: string) {
    const value = size?.trim().toLowerCase();
    if (!value || value === "auto") return undefined;
    const parts = value.includes(":") ? value.split(":") : value.split(/[x*]/);
    const width = Number(parts[0]);
    const height = Number(parts[1]);
    if (!width || !height) return VIDEO_ASPECT_RATIOS.includes(value) ? value : undefined;
    const target = width / height;
    return VIDEO_ASPECT_RATIOS.reduce((best, item) => {
        const [currentWidth, currentHeight] = item.split(":").map(Number);
        const [bestWidth, bestHeight] = best.split(":").map(Number);
        return Math.abs(currentWidth / currentHeight - target) < Math.abs(bestWidth / bestHeight - target) ? item : best;
    });
}

function videoFileInfosPayload(images: ReferenceImage[], videos: ReferenceVideo[], audios: ReferenceAudio[]) {
    const files: VideoFileInfo[] = [];
    const firstFrame = images.length > 0 && videos.length === 0;
    images.forEach((item, index) => {
        const file = toVideoFileInfo({ dataUrl: item.dataUrl, url: item.dataUrl }, "Image");
        if (!file) return;
        file.Usage = firstFrame && index === 0 ? "FirstFrame" : firstFrame && index === 1 ? "LastFrame" : "Reference";
        files.push(file);
    });
    videos.forEach((item) => {
        const file = toVideoFileInfo({ url: item.url }, "Video");
        if (file) files.push({ ...file, Usage: "Reference" });
    });
    audios.forEach((item) => {
        const file = toVideoFileInfo({ url: item.url }, "Audio");
        if (file) files.push(file);
    });
    return files.length ? { FileInfos: files } : {};
}

function toVideoFileInfo(item: MediaRef, category: VideoFileInfo["Category"]): VideoFileInfo | null {
    const source = String(item.url || item.dataUrl || "").trim();
    if (/^https?:\/\//i.test(source)) return { Type: "Url", Category: category, Url: source };
    const base64 = toRawBase64(source);
    if (!base64 || base64.startsWith("blob:") || base64.startsWith("asset:")) return null;
    return { Type: "Base64", Category: category, Base64: base64 };
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

async function hydrateMediaUrl(url: string) {
    if (!url || /^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
    try {
        return blobToDataUrl(await (await fetch(url)).blob());
    } catch {
        return url;
    }
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
