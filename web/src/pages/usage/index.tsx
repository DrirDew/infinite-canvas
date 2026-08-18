import { App, Button, Drawer, Tabs } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchTodayUsage } from "@/services/api/usage";
import type { SessionUser } from "@/services/api/auth";
import { QuotaPair } from "@/components/quota-pair";
import { UsageStatsPanel } from "@/pages/usage/usage-stats-panel";
import { useUserStore } from "@/stores/use-user-store";

export default function UsagePage() {
    const { t } = useTranslation();
    const isAdmin = useUserStore((state) => state.user?.role === "admin");
    const [tab, setTab] = useState("today");

    return (
        <main className="h-full overflow-y-auto bg-background">
            <div className="mx-auto max-w-6xl px-6 py-6">
                <div className="mb-5">
                    <h1 className="text-xl font-semibold text-stone-950 dark:text-stone-100">{t("usage.title")}</h1>
                    <p className="mt-1 text-sm text-stone-500">{t("usage.description")}</p>
                </div>
                <Tabs
                    activeKey={tab}
                    onChange={setTab}
                    items={[
                        { key: "today", label: t("usage.tabs.today"), children: <TodayUsage /> },
                        { key: "stats", label: t("usage.tabs.stats"), children: <UsageStatsPanel /> },
                    ].filter((item) => isAdmin || item.key !== "stats")}
                />
            </div>
        </main>
    );
}

function TodayUsage() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [users, setUsers] = useState<SessionUser[]>([]);
    const [detail, setDetail] = useState<SessionUser | null>(null);

    const refresh = useCallback(async () => {
        setUsers(await fetchTodayUsage());
    }, []);

    useEffect(() => {
        void refresh().catch((error) => message.error(error instanceof Error ? error.message : t("usage.loadFailed")));
    }, [message, refresh, t]);

    return (
        <>
            <div className="space-y-2">
                {users.map((user) => (
                    <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 px-4 py-3 dark:border-stone-800">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{user.username}</div>
                            <div className="mt-1">
                                <QuotaPair imageLabel={t("usage.imageRemaining")} videoLabel={t("usage.videoRemaining")} imageValue={user.imageRemaining} videoValue={user.videoRemaining} />
                            </div>
                        </div>
                        <Button size="small" onClick={() => setDetail(user)}>
                            {t("usage.viewDetails")}
                        </Button>
                    </div>
                ))}
                {!users.length ? <div className="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-700">{t("usage.emptyToday")}</div> : null}
            </div>
            <Drawer open={Boolean(detail)} width={960} title={detail ? t("usage.userTodayTitle", { username: detail.username }) : t("usage.viewDetails")} onClose={() => setDetail(null)} destroyOnHidden>
                {detail ? <UsageStatsPanel userId={detail.id} lockToday /> : null}
            </Drawer>
        </>
    );
}
