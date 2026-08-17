import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";

import i18n from "@/i18n";

export type ApiCallFormat = "openai" | "gemini" | "ark" | "tencent-vod";
export type ModelCapability = "image" | "video" | "text" | "audio";
export type ReasoningEffort = "auto" | "low" | "medium" | "high" | "xhigh";

export type ChannelModel = {
    name: string;
    capability: ModelCapability;
    script?: string;
};

export type ModelChannel = {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    secretKey?: string;
    subAppId?: string;
    apiFormat: ApiCallFormat;
    models: ChannelModel[];
    shared?: boolean;
    managed?: boolean;
    hasSecrets?: boolean;
};

export type AiConfig = {
    channelMode: "remote" | "local";
    baseUrl: string;
    apiKey: string;
    secretKey?: string;
    subAppId?: string;
    apiFormat: ApiCallFormat;
    managed?: boolean;
    channels: ModelChannel[];
    model: string;
    imageModel: string;
    videoModel: string;
    textModel: string;
    audioModel: string;
    audioVoice: string;
    audioFormat: string;
    audioSpeed: string;
    audioInstructions: string;
    videoSeconds: string;
    vquality: string;
    videoGenerateAudio: string;
    videoWatermark: string;
    systemPrompt: string;
    reasoningEffort: ReasoningEffort;
    models: string[];
    quality: string;
    size: string;
    background: string;
    count: string;
    canvasImageCount: string;
    channelId?: string;
};

export type WebdavSyncConfig = {
    url: string;
    username: string;
    password: string;
    directory: string;
    lastSyncedAt: string;
};
export type ConfigTabKey = "channels" | "preferences" | "prompt-sources" | "webdav" | "local-storage" | "server-storage" | "team";

export const CONFIG_STORE_KEY = "infinite-canvas:ai_config_store";
const PERSONAL_CHANNELS_KEY = "infinite-canvas:personal_channels";
const CHANNEL_MODEL_SEPARATOR = "::";
const OPENAI_BASE_URL = "https://api.openai.com";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
export const TENCENT_VOD_HOST = "vod.tencentcloudapi.com";
export const TENCENT_VOD_BASE_URL = "/tencent-vod";
export const COMPANY_TENCENT_VOD_CHANNEL_ID = "company-tencent-vod";
export const TENCENT_VOD_DEFAULT_MODELS: ChannelModel[] = [
    { name: "image2_low", capability: "image" },
    { name: "image2_medium", capability: "image" },
    { name: "image2_high", capability: "image" },
    { name: "gg_2.5", capability: "image" },
    { name: "gg_3.0", capability: "image" },
    { name: "gg_3.1", capability: "image" },
];

export const defaultConfig: AiConfig = {
    channelMode: "local",
    baseUrl: OPENAI_BASE_URL,
    apiKey: "",
    apiFormat: "openai",
    channels: [],
    model: "",
    imageModel: "",
    videoModel: "",
    textModel: "",
    audioModel: "",
    audioVoice: "alloy",
    audioFormat: "mp3",
    audioSpeed: "1",
    audioInstructions: "",
    videoSeconds: "6",
    vquality: "720",
    videoGenerateAudio: "true",
    videoWatermark: "false",
    systemPrompt: "",
    reasoningEffort: "auto",
    models: [],
    quality: "auto",
    size: "1:1",
    background: "",
    count: "1",
    canvasImageCount: "3",
};

export const defaultWebdavSyncConfig: WebdavSyncConfig = {
    url: "",
    username: "",
    password: "",
    directory: "infinite-canvas",
    lastSyncedAt: "",
};

type ConfigStore = {
    config: AiConfig;
    sharedChannels: ModelChannel[];
    personalChannels: ModelChannel[];
    webdav: WebdavSyncConfig;
    isConfigOpen: boolean;
    configTab: ConfigTabKey;
    shouldPromptContinue: boolean;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
    setSharedChannels: (channels: ModelChannel[]) => void;
    setPersonalChannels: (channels: ModelChannel[]) => void;
    clearPersonalChannels: () => void;
    updateWebdavConfig: <K extends keyof WebdavSyncConfig>(key: K, value: WebdavSyncConfig[K]) => void;
    isAiConfigReady: (config: AiConfig, model: string) => boolean;
    openConfigDialog: (shouldPromptContinue?: boolean, tab?: ConfigTabKey) => void;
    setConfigDialogOpen: (isOpen: boolean) => void;
    clearPromptContinue: () => void;
};

const VIDEO_KEYWORDS = ["seedance", "video", "sora", "veo", "kling", "wan", "hailuo"];
const AUDIO_KEYWORDS = ["audio", "tts", "speech", "voice", "music", "sound"];
const IMAGE_KEYWORDS = ["seedream", "gpt-image", "image2", "gg_2.5", "gg_3.0", "gg_3.1", "nano-banana", "image", "dall-e", "dalle", "imagen", "flux", "sdxl", "stable-diffusion", "midjourney"];

/** Best-effort default capability for a freshly fetched model name; user can override in the channel editor. */
export function guessCapability(name: string): ModelCapability {
    const value = name.toLowerCase();
    if (VIDEO_KEYWORDS.some((keyword) => value.includes(keyword))) return "video";
    if (AUDIO_KEYWORDS.some((keyword) => value.includes(keyword))) return "audio";
    if (IMAGE_KEYWORDS.some((keyword) => value.includes(keyword))) return "image";
    return "text";
}

function findChannelModel(config: AiConfig, value: string): { channel: ModelChannel; model: ChannelModel } | null {
    const decoded = decodeChannelModel(value);
    const name = decoded?.model || value;
    const channel = decoded ? config.channels.find((item) => item.id === decoded.channelId) : config.channels.find((item) => item.models.some((model) => model.name === name));
    const model = channel?.models.find((item) => item.name === name);
    return channel && model ? { channel, model } : null;
}

export function modelCapabilityOf(config: AiConfig, value: string): ModelCapability | undefined {
    return findChannelModel(config, value)?.model.capability;
}

export function modelMatchesCapability(config: AiConfig, value: string, capability?: ModelCapability) {
    if (!capability) return true;
    return modelCapabilityOf(config, value) === capability;
}

export function resolveModelForCapability(config: AiConfig, currentModel: string | undefined, capability: ModelCapability) {
    const defaultModel = capability === "image" ? config.imageModel : capability === "video" ? config.videoModel : capability === "audio" ? config.audioModel : config.textModel;
    const fallbackModel = capability === "image" ? defaultConfig.imageModel : capability === "video" ? defaultConfig.videoModel : capability === "audio" ? defaultConfig.audioModel : defaultConfig.textModel;
    if (currentModel && modelMatchesCapability(config, currentModel, capability)) return currentModel;
    if (defaultModel && modelMatchesCapability(config, defaultModel, capability)) return defaultModel;
    return fallbackModel;
}

export function selectableModelsByCapability(config: AiConfig, capability?: ModelCapability) {
    if (!capability) return config.models;
    return config.channels.flatMap((channel) => channel.models.filter((model) => model.capability === capability).map((model) => encodeChannelModel(channel.id, model.name)));
}

/** The user script (if any) attached to a model; empty string means use the system default call. */
export function resolveModelScript(config: AiConfig, value: string) {
    return findChannelModel(config, value)?.model.script?.trim() || "";
}

function isAiConfigReady(config: AiConfig, model: string) {
    const channel = resolveModelChannel(config, model);
    if (!model.trim()) return false;
    if (isSharedChannel(channel)) return channel.apiFormat === "tencent-vod" && channel.models.length > 0 && Boolean(channel.hasSecrets);
    if (!channel.apiKey.trim()) return false;
    if (channel.apiFormat === "tencent-vod") return Boolean(channel.secretKey?.trim() && channel.subAppId?.trim());
    return Boolean(channel.baseUrl.trim());
}

function readPersonalChannels(): ModelChannel[] {
    if (typeof sessionStorage === "undefined") return [];
    try {
        const parsed = JSON.parse(sessionStorage.getItem(PERSONAL_CHANNELS_KEY) || "[]") as ModelChannel[];
        return Array.isArray(parsed) ? parsed.filter((channel) => channel && !channel.shared) : [];
    } catch {
        return [];
    }
}

function writePersonalChannels(channels: ModelChannel[]) {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(PERSONAL_CHANNELS_KEY, JSON.stringify(channels.filter((channel) => !channel.shared)));
}

function applyChannels(config: AiConfig, sharedChannels: ModelChannel[], personalChannels: ModelChannel[]): AiConfig {
    const merged = mergeConfigChannels(config, sharedChannels, personalChannels);
    return {
        ...merged,
        imageModel: pickReadyModel(merged, "image", merged.imageModel),
        videoModel: pickReadyModel(merged, "video", merged.videoModel),
        textModel: pickReadyModel(merged, "text", merged.textModel),
        audioModel: pickReadyModel(merged, "audio", merged.audioModel),
    };
}

export const useConfigStore = create<ConfigStore>()(
    persist(
        (set, get) => ({
            config: defaultConfig,
            sharedChannels: [],
            personalChannels: readPersonalChannels(),
            webdav: defaultWebdavSyncConfig,
            isConfigOpen: false,
            configTab: "channels",
            shouldPromptContinue: false,
            updateConfig: (key, value) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        [key]: value,
                    },
                })),
            setSharedChannels: (channels) => {
                const sharedChannels = channels.filter(isSharedChannel).map((channel) => createModelChannel({ ...channel, shared: true }));
                const current = get();
                set({
                    sharedChannels,
                    config: applyChannels(current.config, sharedChannels, current.personalChannels),
                });
            },
            setPersonalChannels: (channels) => {
                const personalChannels = channels.filter((channel) => !isSharedChannel(channel)).map((channel) => createModelChannel({ ...channel, shared: false }));
                writePersonalChannels(personalChannels);
                const current = get();
                set({
                    personalChannels,
                    config: applyChannels(current.config, current.sharedChannels, personalChannels),
                });
            },
            clearPersonalChannels: () => {
                writePersonalChannels([]);
                const current = get();
                set({
                    personalChannels: [],
                    config: applyChannels(current.config, current.sharedChannels, []),
                });
            },
            updateWebdavConfig: (key, value) =>
                set((state) => ({
                    webdav: {
                        ...state.webdav,
                        [key]: value,
                    },
                })),
            isAiConfigReady: (config, model) => isAiConfigReady(config, model),
            openConfigDialog: (shouldPromptContinue = false, configTab = "channels") => set({ isConfigOpen: true, shouldPromptContinue, configTab }),
            setConfigDialogOpen: (isConfigOpen) => set({ isConfigOpen }),
            clearPromptContinue: () => set({ shouldPromptContinue: false }),
        }),
        {
            name: CONFIG_STORE_KEY,
            partialize: (state) => ({ config: { ...state.config, channels: [], apiKey: "", secretKey: "", subAppId: "", channelId: undefined }, webdav: state.webdav }),
            merge: (persisted, current) => {
                const persistedState = (persisted || {}) as Partial<ConfigStore>;
                const persistedConfig = (persistedState.config || {}) as Partial<AiConfig>;
                const persistedWebdav = (persistedState.webdav || {}) as Partial<WebdavSyncConfig>;
                const config = { ...defaultConfig, ...persistedConfig, channels: [], apiKey: "", secretKey: "", subAppId: "", channelId: undefined };
                const personalChannels = readPersonalChannels().map((channel) => createModelChannel({ ...channel, shared: false }));
                return {
                    ...current,
                    sharedChannels: current.sharedChannels || [],
                    personalChannels,
                    webdav: { ...defaultWebdavSyncConfig, ...persistedWebdav },
                    config: {
                        ...config,
                        channelMode: "local",
                        apiFormat: normalizeApiFormat(config.apiFormat),
                        channels: [],
                        models: [],
                        imageModel: config.imageModel || config.model || "",
                        videoModel: config.videoModel || "",
                        textModel: config.textModel || config.model || "",
                        audioModel: config.audioModel || "",
                        audioVoice: config.audioVoice || defaultConfig.audioVoice,
                        audioFormat: config.audioFormat || defaultConfig.audioFormat,
                        audioSpeed: config.audioSpeed || defaultConfig.audioSpeed,
                        audioInstructions: config.audioInstructions || "",
                        reasoningEffort: config.reasoningEffort || "auto",
                        videoSeconds: config.videoSeconds || "6",
                        vquality: config.vquality || "720",
                        videoGenerateAudio: config.videoGenerateAudio || "true",
                        videoWatermark: config.videoWatermark || "false",
                        canvasImageCount: config.canvasImageCount || "3",
                    },
                };
            },
        },
    ),
);

export function useEffectiveConfig() {
    const config = useConfigStore((state) => state.config);
    const sharedChannels = useConfigStore((state) => state.sharedChannels);
    const personalChannels = useConfigStore((state) => state.personalChannels);
    return useMemo(() => getEffectiveConfigFrom(config, sharedChannels, personalChannels), [config, personalChannels, sharedChannels]);
}

export function getEffectiveConfig() {
    const { config, sharedChannels, personalChannels } = useConfigStore.getState();
    return getEffectiveConfigFrom(config, sharedChannels, personalChannels);
}

function getEffectiveConfigFrom(config: AiConfig, sharedChannels: ModelChannel[], personalChannels: ModelChannel[]) {
    return mergeConfigChannels({ ...config, channelMode: "local" as const }, sharedChannels, personalChannels);
}

export function isSharedChannel(channel: Pick<ModelChannel, "shared" | "managed">) {
    return Boolean(channel.shared || channel.managed);
}

export function isManagedChannel(channel: Pick<ModelChannel, "shared" | "managed">) {
    return isSharedChannel(channel);
}

export function mergeConfigChannels(config: AiConfig, sharedChannels: ModelChannel[], personalChannels: ModelChannel[]): AiConfig {
    const shared = sharedChannels.filter(isSharedChannel).map((channel) => createModelChannel({ ...channel, shared: true }));
    const personal = personalChannels.filter((channel) => !isSharedChannel(channel)).map((channel) => createModelChannel({ ...channel, shared: false }));
    const channels = [...shared, ...personal];
    return { ...config, channels, models: modelOptionsFromChannels(channels) };
}

function pickReadyModel(config: AiConfig, capability: ModelCapability, current: string) {
    if (current && isAiConfigReady(config, current) && modelMatchesCapability(config, current, capability)) return current;
    return selectableModelsByCapability(config, capability).find((model) => isAiConfigReady(config, model)) || current;
}

/** Normalize a mixed list of raw model names or model objects into deduped ChannelModel entries. */
export function normalizeChannelModels(models: Array<string | ChannelModel> | undefined): ChannelModel[] {
    const seen = new Set<string>();
    const result: ChannelModel[] = [];
    for (const item of models || []) {
        const name = (typeof item === "string" ? item : item?.name || "").trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const capability = typeof item === "string" ? guessCapability(name) : item.capability || guessCapability(name);
        const script = typeof item === "string" ? undefined : item.script?.trim() || undefined;
        result.push({ name, capability, script });
    }
    return result;
}

export const SECRET_MASK = "****************";

export function isSecretMask(value?: string) {
    return /^\*+$/.test((value || "").trim());
}

export function createModelChannel(channel?: Partial<ModelChannel>): ModelChannel {
    const apiFormat = normalizeApiFormat(channel?.apiFormat);
    const models = normalizeChannelModels(channel?.models);
    const shared = Boolean(channel?.shared || channel?.managed);
    const hidden = shared && Boolean(channel?.hasSecrets);
    return {
        id: channel?.id?.trim() || nanoid(),
        name: channel?.name?.trim() || i18n.t("config.channels.newName"),
        baseUrl: channel?.baseUrl?.trim() || defaultBaseUrlForApiFormat(apiFormat),
        apiKey: channel?.apiKey || (hidden ? SECRET_MASK : ""),
        secretKey: channel?.secretKey || (hidden && apiFormat === "tencent-vod" ? SECRET_MASK : ""),
        subAppId: channel?.subAppId || (hidden && apiFormat === "tencent-vod" ? SECRET_MASK : ""),
        apiFormat,
        shared,
        managed: shared,
        hasSecrets: Boolean(channel?.hasSecrets),
        models: apiFormat === "tencent-vod" && !models.length ? TENCENT_VOD_DEFAULT_MODELS : models,
    };
}

export function encodeChannelModel(channelId: string, model: string) {
    return `${channelId}${CHANNEL_MODEL_SEPARATOR}${model.trim()}`;
}

export function isChannelModelValue(value: string) {
    return value.includes(CHANNEL_MODEL_SEPARATOR);
}

export function decodeChannelModel(value: string) {
    const index = value.indexOf(CHANNEL_MODEL_SEPARATOR);
    if (index < 0) return null;
    return { channelId: value.slice(0, index), model: value.slice(index + CHANNEL_MODEL_SEPARATOR.length) };
}

export function modelOptionName(value: string) {
    return decodeChannelModel(value)?.model || value;
}

export function modelOptionLabel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    if (!decoded) return value;
    const channel = config.channels.find((item) => item.id === decoded.channelId);
    return channel ? `${decoded.model}（${channel.name}）` : decoded.model;
}

export function modelOptionsFromChannels(channels: ModelChannel[]) {
    return uniqueModelOptions(channels.flatMap((channel) => channel.models.map((model) => encodeChannelModel(channel.id, model.name))));
}

export function normalizeModelOptionValue(value: string | undefined, channels: ModelChannel[]) {
    const model = (value || "").trim();
    if (!model) return "";
    const decoded = decodeChannelModel(model);
    if (decoded) {
        const channel = channels.find((item) => item.id === decoded.channelId);
        if (channel && isSharedChannel(channel)) return model;
        return channel && channel.models.some((item) => item.name === decoded.model) ? model : "";
    }
    const channel = channels.find((item) => item.models.some((entry) => entry.name === model)) || channels[0];
    return channel && channel.models.some((item) => item.name === model) ? encodeChannelModel(channel.id, model) : model;
}

export function resolveModelChannel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    const model = decoded?.model || value;
    const matched = decoded ? config.channels.find((channel) => channel.id === decoded.channelId) : config.channels.find((channel) => channel.models.some((item) => item.name === model));
    return matched || config.channels[0] || createModelChannel({ id: "default", name: i18n.t("config.channels.defaultName"), baseUrl: config.baseUrl, apiKey: config.apiKey, apiFormat: config.apiFormat, models: config.models.map(modelOptionName).map((name) => ({ name, capability: guessCapability(name) })) });
}

export function resolveModelRequestConfig(config: AiConfig, value: string) {
    const channel = resolveModelChannel(config, value);
    return {
        ...config,
        model: modelOptionName(value || config.model),
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
        secretKey: channel.secretKey || "",
        subAppId: channel.subAppId || "",
        apiFormat: channel.apiFormat,
        managed: isSharedChannel(channel),
        channelId: isSharedChannel(channel) ? channel.id : undefined,
    };
}

export function defaultBaseUrlForApiFormat(apiFormat: ApiCallFormat) {
    if (apiFormat === "gemini") return GEMINI_BASE_URL;
    if (apiFormat === "ark") return ARK_BASE_URL;
    if (apiFormat === "tencent-vod") return TENCENT_VOD_BASE_URL;
    return OPENAI_BASE_URL;
}

function normalizeApiFormat(apiFormat: unknown): ApiCallFormat {
    return apiFormat === "gemini" || apiFormat === "ark" || apiFormat === "tencent-vod" ? apiFormat : "openai";
}

function uniqueModelOptions(models: string[]) {
    return Array.from(new Set((models || []).map((model) => model.trim()).filter(Boolean)));
}

export function buildApiUrl(baseUrl: string, path: string) {
    let normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    normalizedBaseUrl = normalizeArkPlanBaseUrl(normalizedBaseUrl);
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/api/v3") || lowerBaseUrl.endsWith("/api/plan/v3") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
    return `${apiBaseUrl}${path}`;
}

function normalizeArkPlanBaseUrl(baseUrl: string) {
    try {
        const url = new URL(baseUrl);
        const path = url.pathname.replace(/\/+$/, "");
        const lowerPath = path.toLowerCase();
        const arkPlanIndex = lowerPath.indexOf("/api/plan/v3");
        if (arkPlanIndex < 0) return baseUrl;
        const end = arkPlanIndex + "/api/plan/v3".length;
        if (lowerPath.length !== end && lowerPath[end] !== "/") return baseUrl;
        url.pathname = path.slice(0, end);
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/+$/, "");
    } catch {
        return baseUrl;
    }
}
