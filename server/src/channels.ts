import { channelCount, deleteChannel, findChannelById, insertChannel, listChannels, updateChannel } from "./db";
import type { ChannelRow } from "./schema";
import { COMPANY_TENCENT_VOD_CHANNEL_ID, TENCENT_VOD_MODELS, tencentVodCredentials } from "./tencent-vod";

const API_FORMATS = new Set(["openai", "gemini", "ark", "tencent-vod"]);

export type ChannelInput = {
    id?: string;
    name?: string;
    apiFormat?: string;
    baseUrl?: string;
    apiKey?: string;
    secretKey?: string;
    subAppId?: string;
    models?: Array<{ name?: string; capability?: string; script?: string }>;
};

export type PublicChannel = {
    id: string;
    name: string;
    apiFormat: string;
    baseUrl: string;
    models: Array<{ name: string; capability: string; script?: string }>;
    hasSecrets: boolean;
    apiKey?: string;
    secretKey?: string;
    subAppId?: string;
};

function parseModels(raw: string) {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.flatMap((item) => {
            const name = String((item as { name?: string })?.name || "").trim();
            if (!name) return [];
            const capability = String((item as { capability?: string })?.capability || "image");
            const script = String((item as { script?: string })?.script || "").trim();
            return [{ name, capability, ...(script ? { script } : {}) }];
        });
    } catch {
        return [];
    }
}

function normalizeModels(models: ChannelInput["models"], apiFormat: string) {
    const result = (models || []).flatMap((item) => {
        const name = String(item?.name || "").trim();
        if (!name) return [];
        const capability = String(item?.capability || "image");
        const script = String(item?.script || "").trim();
        return [{ name, capability, ...(script ? { script } : {}) }];
    });
    if (apiFormat === "tencent-vod" && !result.length) return TENCENT_VOD_MODELS;
    return apiFormat === "tencent-vod" ? mergeTencentDefaultModels(result) : result;
}

function mergeTencentDefaultModels(models: Array<{ name: string; capability: string; script?: string }>) {
    if (!models.length) return TENCENT_VOD_MODELS;
    if (models.some((item) => item.capability === "video")) return models;
    const names = new Set(models.map((item) => item.name));
    return [...models, ...TENCENT_VOD_MODELS.filter((item) => item.capability === "video" && !names.has(item.name))];
}

function normalizeFormat(value: unknown) {
    const format = String(value || "");
    if (!API_FORMATS.has(format)) throw new Error("不支持的渠道协议");
    return format;
}

function keepSecret(input: string | undefined, current: string) {
    const value = String(input || "").trim();
    if (!value || /^\*+$/.test(value)) return current;
    return value;
}

function hasSecrets(row: ChannelRow) {
    if (row.api_format === "tencent-vod") return Boolean(row.api_key || row.secret_key || row.sub_app_id || tencentVodCredentials());
    return Boolean(row.api_key);
}

function resolvedSecrets(row: ChannelRow) {
    const env = tencentVodCredentials();
    if (row.api_format === "tencent-vod") {
        return {
            apiKey: row.api_key.trim() || env?.secretId || "",
            secretKey: row.secret_key.trim() || env?.secretKey || "",
            subAppId: row.sub_app_id.trim() || env?.subAppId || "",
        };
    }
    return { apiKey: row.api_key, secretKey: row.secret_key, subAppId: row.sub_app_id };
}

export function toPublicChannel(row: ChannelRow, reveal = false): PublicChannel {
    const secrets = reveal ? resolvedSecrets(row) : { apiKey: "", secretKey: "", subAppId: "" };
    return {
        id: row.id,
        name: row.name,
        apiFormat: row.api_format,
        baseUrl: row.base_url,
        models: row.api_format === "tencent-vod" ? mergeTencentDefaultModels(parseModels(row.models_json)) : parseModels(row.models_json),
        hasSecrets: hasSecrets(row),
        apiKey: secrets.apiKey,
        secretKey: secrets.secretKey,
        subAppId: secrets.subAppId,
    };
}

export function publicChannels(reveal = false) {
    return listChannels().map((row) => toPublicChannel(row, reveal));
}

export function resolveTencentCredentials(row: ChannelRow) {
    const env = tencentVodCredentials();
    const secretId = row.api_key.trim() || env?.secretId || "";
    const secretKey = row.secret_key.trim() || env?.secretKey || "";
    const subAppId = row.sub_app_id.trim() || env?.subAppId || "";
    if (!secretId || !secretKey || !subAppId) return null;
    return { secretId, secretKey, subAppId };
}

export function resolveSharedTencentChannel(channelId?: string) {
    const channels = listChannels();
    const row = channelId?.trim() ? findChannelById(channelId.trim()) : channels.find((item) => item.api_format === "tencent-vod") || channels[0] || null;
    if (!row) throw new Error("共享渠道不存在");
    if (row.api_format !== "tencent-vod") throw new Error("该共享渠道不是腾讯云点播");
    const credentials = resolveTencentCredentials(row);
    if (!credentials) throw new Error("公司腾讯云点播未配置");
    return { row, credentials };
}

export function bootstrapChannels() {
    if (channelCount() === 0) {
        const env = tencentVodCredentials();
        const now = Date.now();
        insertChannel({
            id: COMPANY_TENCENT_VOD_CHANNEL_ID,
            name: "腾讯云",
            api_format: "tencent-vod",
            base_url: "/tencent-vod",
            api_key: env?.secretId || "",
            secret_key: env?.secretKey || "",
            sub_app_id: env?.subAppId || "",
            models_json: JSON.stringify(TENCENT_VOD_MODELS),
            created_at: now,
            updated_at: now,
        });
        return;
    }
    for (const row of listChannels()) {
        if (row.api_format !== "tencent-vod") continue;
        const models = mergeTencentDefaultModels(parseModels(row.models_json));
        if (JSON.stringify(models) === row.models_json) continue;
        updateChannel({ ...row, models_json: JSON.stringify(models), updated_at: Date.now() });
    }
}

export function createSharedChannel(input: ChannelInput) {
    const apiFormat = normalizeFormat(input.apiFormat);
    const name = String(input.name || "").trim() || "未命名渠道";
    const now = Date.now();
    const row: ChannelRow = {
        id: crypto.randomUUID(),
        name,
        api_format: apiFormat,
        base_url: String(input.baseUrl || "").trim(),
        api_key: keepSecret(input.apiKey, ""),
        secret_key: keepSecret(input.secretKey, ""),
        sub_app_id: String(input.subAppId || "").trim(),
        models_json: JSON.stringify(normalizeModels(input.models, apiFormat)),
        created_at: now,
        updated_at: now,
    };
    insertChannel(row);
    return toPublicChannel(row, true);
}

export function patchSharedChannel(id: string, input: ChannelInput) {
    const current = findChannelById(id);
    if (!current) throw new Error("共享渠道不存在");
    const apiFormat = input.apiFormat ? normalizeFormat(input.apiFormat) : current.api_format;
    const next: ChannelRow = {
        ...current,
        name: input.name != null ? String(input.name).trim() || current.name : current.name,
        api_format: apiFormat,
        base_url: input.baseUrl != null ? String(input.baseUrl).trim() : current.base_url,
        api_key: keepSecret(input.apiKey, current.api_key),
        secret_key: keepSecret(input.secretKey, current.secret_key),
        sub_app_id: keepSecret(input.subAppId, current.sub_app_id),
        models_json: input.models ? JSON.stringify(normalizeModels(input.models, apiFormat)) : current.models_json,
        updated_at: Date.now(),
    };
    updateChannel(next);
    return toPublicChannel(next, true);
}

export function removeSharedChannel(id: string) {
    const current = findChannelById(id);
    if (!current) throw new Error("共享渠道不存在");
    deleteChannel(id);
}
