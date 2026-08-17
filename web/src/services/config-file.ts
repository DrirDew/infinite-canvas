import { saveAs } from "file-saver";

import i18n from "@/i18n";
import { createSharedChannel, fetchSharedChannels, updateSharedChannel } from "@/services/api/channels";
import { isSecretMask, isSharedChannel, useConfigStore, type AiConfig, type ModelChannel, type WebdavSyncConfig } from "@/stores/use-config-store";
import { usePromptSourceStore, type PromptSourceSchedule } from "@/stores/use-prompt-source-store";
import { useUserStore } from "@/stores/use-user-store";
import type { PromptSource } from "@/services/api/prompt-source-presets";

type AppConfigFile = {
    app: "infinite-canvas";
    version: 1;
    exportedAt: string;
    config: AiConfig;
    webdav: WebdavSyncConfig;
    promptSources: {
        sources: PromptSource[];
        schedule: PromptSourceSchedule;
    };
};

function exportableChannel(channel: ModelChannel): ModelChannel {
    return {
        ...channel,
        apiKey: isSecretMask(channel.apiKey) ? "" : channel.apiKey,
        secretKey: isSecretMask(channel.secretKey) ? "" : channel.secretKey || "",
        subAppId: isSecretMask(channel.subAppId) ? "" : channel.subAppId || "",
    };
}

export function exportAppConfig() {
    const { config, webdav, personalChannels, sharedChannels } = useConfigStore.getState();
    const { sources, schedule } = usePromptSourceStore.getState();
    const isAdmin = useUserStore.getState().user?.role === "admin";
    const channels = (isAdmin ? [...sharedChannels, ...personalChannels] : personalChannels).map(exportableChannel);
    const data: AppConfigFile = {
        app: "infinite-canvas",
        version: 1,
        exportedAt: new Date().toISOString(),
        config: { ...config, channels },
        webdav,
        promptSources: { sources, schedule },
    };
    saveAs(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }), "infinite-canvas-config.json");
}

export async function importAppConfig(file: File) {
    let data: AppConfigFile;
    try {
        data = JSON.parse(await file.text()) as AppConfigFile;
    } catch {
        throw new Error(i18n.t("config.invalidFile"));
    }
    if (data.app !== "infinite-canvas" || data.version !== 1 || !data.config || !data.webdav || !data.promptSources) throw new Error(i18n.t("config.invalidFile"));
    const channels = data.config.channels || [];
    const personal = channels.filter((channel) => !isSharedChannel(channel)).map(exportableChannel);
    useConfigStore.setState({ config: { ...data.config, channels: [] }, webdav: data.webdav });
    useConfigStore.getState().setPersonalChannels(personal);
    usePromptSourceStore.setState(data.promptSources);
    if (useUserStore.getState().user?.role !== "admin") return;
    const shared = channels.filter(isSharedChannel).map(exportableChannel);
    for (const channel of shared) {
        try {
            await updateSharedChannel(channel);
        } catch {
            await createSharedChannel(channel);
        }
    }
    if (shared.length) useConfigStore.getState().setSharedChannels(await fetchSharedChannels());
}
