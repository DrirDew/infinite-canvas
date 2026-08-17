import { App, Switch } from "antd";
import { Server } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useServerSettingsStore } from "@/stores/use-server-settings-store";
import { useUserStore } from "@/stores/use-user-store";

export function ConfigServerStorage() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const isAdmin = useUserStore((state) => state.user?.role === "admin");
    const storeMedia = useServerSettingsStore((state) => state.storeMedia);
    const setStoreMedia = useServerSettingsStore((state) => state.setStoreMedia);

    return (
        <section className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
            <div className="flex items-center gap-2 text-sm font-semibold">
                <Server className="size-4" />
                {t("config.serverStorage.title")}
            </div>
            <div className="mt-1 text-xs text-stone-500">{t("config.serverStorage.description")}</div>
            <div className="mt-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="text-sm font-medium">{t("config.serverStorage.storeMedia")}</div>
                    <div className="mt-1 text-xs text-stone-500">{t("config.serverStorage.storeMediaDescription")}</div>
                </div>
                <Switch
                    className="shrink-0"
                    checked={storeMedia}
                    disabled={!isAdmin}
                    onChange={(checked) => {
                        void setStoreMedia(checked)
                            .then(() => message.success(t("config.saved")))
                            .catch(() => message.error(t("config.serverStorage.saveFailed")));
                    }}
                />
            </div>
        </section>
    );
}
