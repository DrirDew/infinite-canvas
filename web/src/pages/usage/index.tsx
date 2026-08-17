import { App, Button, InputNumber } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchMyUsage, type UsageSummary } from "@/services/api/usage";
import { useUserStore } from "@/stores/use-user-store";

export default function UsagePage() {
    const { t, i18n } = useTranslation();
    const { message } = App.useApp();
    const isAdmin = useUserStore((state) => state.user?.role === "admin");
    const users = useUserStore((state) => state.users);
    const loadUsers = useUserStore((state) => state.loadUsers);
    const adjustCredits = useUserStore((state) => state.adjustCredits);
    const [usage, setUsage] = useState<UsageSummary | null>(null);

    const refresh = useCallback(async () => {
        setUsage(await fetchMyUsage());
        if (useUserStore.getState().user?.role === "admin") await loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        void refresh().catch((error) => message.error(error instanceof Error ? error.message : t("usage.loadFailed")));
    }, [message, refresh, t]);

    const onSaveCredits = async (userId: string, creditBalance: number) => {
        try {
            await adjustCredits(userId, creditBalance);
            await refresh();
            message.success(t("auth.creditsSaved"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("auth.adjustCreditsFailed"));
        }
    };

    return (
        <main className="h-full overflow-y-auto bg-background">
            <div className="mx-auto max-w-6xl space-y-8 px-6 py-6">
                <div>
                    <h1 className="text-xl font-semibold text-stone-950 dark:text-stone-100">{t("usage.title")}</h1>
                    <p className="mt-1 text-sm text-stone-500">{t("usage.description")}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard label={t("usage.creditBalance")} value={usage?.creditBalance ?? 0} />
                    <StatCard label={t("usage.generatedCount")} value={usage?.generatedCount ?? 0} />
                    <StatCard label={t("usage.jobCount")} value={usage?.jobCount ?? 0} />
                </div>

                <section>
                    <h2 className="mb-3 text-base font-semibold">{t("usage.ledger")}</h2>
                    <div className="space-y-2">
                        {(usage?.entries || []).map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-4 py-3 dark:border-stone-800">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium">{t(entry.reason === "adjust" ? "usage.reasonAdjust" : "usage.reasonGenerate")}</div>
                                    <div className="mt-1 text-xs text-stone-500">{new Date(entry.createdAt).toLocaleString(i18n.resolvedLanguage, { hour12: false })}</div>
                                </div>
                                <div className={`shrink-0 text-sm font-semibold ${entry.delta < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                    {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                                </div>
                            </div>
                        ))}
                        {!usage?.entries.length ? <div className="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-700">{t("usage.emptyLedger")}</div> : null}
                    </div>
                </section>

                {isAdmin ? (
                    <section className="space-y-6">
                        <div>
                            <h2 className="text-base font-semibold">{t("usage.team")}</h2>
                            <p className="mt-1 text-xs text-stone-500">{t("usage.teamHint")}</p>
                        </div>
                        <div className="space-y-2">
                            {users.map((user) => (
                                <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 px-4 py-3 dark:border-stone-800">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold">{user.username}</div>
                                        <div className="mt-1 text-xs text-stone-500">
                                            {t(user.role === "admin" ? "auth.roleAdmin" : "auth.roleUser")} · {t("usage.generatedCount")} {user.generatedCount ?? 0}
                                        </div>
                                    </div>
                                    <CreditField value={user.creditBalance} onSave={(value) => onSaveCredits(user.id, value)} />
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}
            </div>
        </main>
    );
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-stone-200 px-4 py-4 dark:border-stone-800">
            <div className="text-xs text-stone-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-stone-950 dark:text-stone-100">{value}</div>
        </div>
    );
}

function CreditField({ value, onSave }: { value: number; onSave: (value: number) => Promise<void> }) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);
    return (
        <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-stone-500">{t("auth.credits")}</span>
            <InputNumber min={0} precision={0} size="small" className="w-24" value={draft} onChange={(next) => setDraft(Number(next) || 0)} onBlur={() => { if (draft !== value) void onSave(draft); }} />
        </div>
    );
}
