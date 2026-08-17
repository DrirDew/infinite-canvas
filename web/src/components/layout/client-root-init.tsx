import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { App } from "antd";
import { useTranslation } from "react-i18next";

import { createModelChannel, useConfigStore } from "@/stores/use-config-store";
import { fetchCompanyChannels } from "@/services/api/company-channels";
import { usePromptSourceScheduler } from "@/hooks/use-prompt-source-scheduler";
import { useUserStore } from "@/stores/use-user-store";

export function ClientRootInit({ children }: { children: ReactNode }) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const handledConfigParams = useRef(false);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const setCompanyChannels = useConfigStore((state) => state.setCompanyChannels);
    const config = useConfigStore((state) => state.config);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const status = useUserStore((state) => state.status);
    const user = useUserStore((state) => state.user);
    const restoreSession = useUserStore((state) => state.restoreSession);
    const isAdmin = user?.role === "admin";

    usePromptSourceScheduler();

    useEffect(() => {
        void restoreSession();
    }, [restoreSession]);

    useEffect(() => {
        if (!user) {
            setCompanyChannels([]);
            return;
        }
        void fetchCompanyChannels().then(setCompanyChannels);
    }, [setCompanyChannels, user]);

    useEffect(() => {
        if (!isAdmin || handledConfigParams.current) return;
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
        const firstChannel = config.channels[0];
        updateConfig(
            "channels",
            firstChannel
                ? config.channels.map((channel, index) =>
                      index === 0
                          ? {
                                ...channel,
                                ...(baseUrl ? { baseUrl } : {}),
                                ...(apiKey ? { apiKey } : {}),
                            }
                          : channel,
                  )
                : [createModelChannel({ id: "default", name: t("config.channels.defaultName"), baseUrl: baseUrl || undefined, apiKey: apiKey || "" })],
        );
        if (baseUrl) updateConfig("baseUrl", baseUrl);
        if (apiKey) updateConfig("apiKey", apiKey);
        openConfigDialog(false);
        message.success(t("config.importedDirectConfig"));
    }, [config.channels, isAdmin, message, openConfigDialog, t, updateConfig]);

    if (status === "unknown") {
        return <div className="flex h-dvh items-center justify-center bg-background text-sm text-stone-500">{t("auth.restoring")}</div>;
    }

    return <>{children}</>;
}
