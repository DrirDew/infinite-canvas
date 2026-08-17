import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { App } from "antd";
import { useTranslation } from "react-i18next";

import { createModelChannel, useConfigStore } from "@/stores/use-config-store";
import { fetchSharedChannels } from "@/services/api/channels";
import { usePromptSourceScheduler } from "@/hooks/use-prompt-source-scheduler";
import { useUserStore } from "@/stores/use-user-store";
import { useServerSettingsStore } from "@/stores/use-server-settings-store";

export function ClientRootInit({ children }: { children: ReactNode }) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const handledConfigParams = useRef(false);
    const setSharedChannels = useConfigStore((state) => state.setSharedChannels);
    const setPersonalChannels = useConfigStore((state) => state.setPersonalChannels);
    const clearPersonalChannels = useConfigStore((state) => state.clearPersonalChannels);
    const personalChannels = useConfigStore((state) => state.personalChannels);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const status = useUserStore((state) => state.status);
    const user = useUserStore((state) => state.user);
    const restoreSession = useUserStore((state) => state.restoreSession);
    const loadSettings = useServerSettingsStore((state) => state.loadSettings);
    const clearSettings = useServerSettingsStore((state) => state.clearSettings);

    usePromptSourceScheduler();

    useEffect(() => {
        void restoreSession();
    }, [restoreSession]);

    useEffect(() => {
        if (status !== "ready") return;
        if (!user) {
            setSharedChannels([]);
            clearPersonalChannels();
            clearSettings();
            return;
        }
        void loadSettings();
        void fetchSharedChannels()
            .then(setSharedChannels)
            .catch(() => setSharedChannels([]));
    }, [clearPersonalChannels, clearSettings, loadSettings, setSharedChannels, status, user]);

    useEffect(() => {
        if (!user || handledConfigParams.current) return;
        const searchParams = new URLSearchParams(window.location.search);
        const baseUrl = searchParams.get("baseUrl") || searchParams.get("baseurl");
        const apiKey = searchParams.get("apiKey") || searchParams.get("apikey");
        if (!baseUrl && !apiKey) return;
        handledConfigParams.current = true;
        searchParams.delete("baseUrl");
        searchParams.delete("baseurl");
        searchParams.delete("apiKey");
        searchParams.delete("apikey");
        window.history.replaceState(null, "", `${window.location.pathname}${searchParams.size ? `?${searchParams}` : ""}${window.location.hash}`);
        const target = personalChannels[0] || createModelChannel({ name: t("config.channels.newName"), baseUrl: baseUrl || undefined, apiKey: apiKey || "" });
        const next = personalChannels.some((channel) => channel.id === target.id)
            ? personalChannels.map((channel) => (channel.id === target.id ? { ...channel, ...(baseUrl ? { baseUrl } : {}), ...(apiKey ? { apiKey } : {}) } : channel))
            : [...personalChannels, { ...target, ...(baseUrl ? { baseUrl } : {}), ...(apiKey ? { apiKey } : {}) }];
        setPersonalChannels(next);
        openConfigDialog(false);
        message.success(t("config.importedDirectConfig"));
    }, [message, openConfigDialog, personalChannels, setPersonalChannels, t, user]);

    if (status === "unknown") {
        return <div className="flex h-dvh items-center justify-center bg-background text-sm text-stone-500">{t("auth.restoring")}</div>;
    }

    return <>{children}</>;
}
