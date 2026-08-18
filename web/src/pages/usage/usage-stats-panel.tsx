import { App, Button, DatePicker, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { saveAs } from "file-saver";
import { Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { fetchUsageStats, type UsageKind, type UsageStats } from "@/services/api/usage";

type DatePreset = "today" | "yesterday" | "last7" | "last30" | "custom";

const CHART_COLORS = ["#1677ff", "#52c41a", "#faad14", "#13c2c2", "#eb2f96", "#722ed1", "#fa541c", "#2f54eb"];

function shanghaiDate(at = Date.now()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

function shanghaiDayStart(date: string) {
    return Date.parse(`${date}T00:00:00+08:00`);
}

function shiftDate(date: string, days: number) {
    return shanghaiDate(shanghaiDayStart(date) + days * 24 * 60 * 60 * 1000);
}

function rangeForPreset(preset: DatePreset, custom?: [string, string]) {
    const today = shanghaiDate();
    if (preset === "yesterday") {
        const yesterday = shiftDate(today, -1);
        return { from: shanghaiDayStart(yesterday), to: shanghaiDayStart(today) };
    }
    if (preset === "last7") return { from: shanghaiDayStart(shiftDate(today, -6)), to: shanghaiDayStart(shiftDate(today, 1)) };
    if (preset === "last30") return { from: shanghaiDayStart(shiftDate(today, -29)), to: shanghaiDayStart(shiftDate(today, 1)) };
    if (preset === "custom" && custom) return { from: shanghaiDayStart(custom[0]), to: shanghaiDayStart(shiftDate(custom[1], 1)) };
    return { from: shanghaiDayStart(today), to: shanghaiDayStart(shiftDate(today, 1)) };
}

function downloadCsv(filename: string, rows: string[][]) {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    saveAs(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }), filename);
}

export function UsageStatsPanel({ userId, lockToday = false }: { userId?: string; lockToday?: boolean }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [kind, setKind] = useState<UsageKind>("image");
    const [preset, setPreset] = useState<DatePreset>("today");
    const [customRange, setCustomRange] = useState<[string, string]>(() => {
        const today = shanghaiDate();
        return [today, today];
    });
    const [stats, setStats] = useState<UsageStats | null>(null);

    const range = useMemo(() => rangeForPreset(lockToday ? "today" : preset, customRange), [customRange, lockToday, preset]);

    const refresh = useCallback(async () => {
        setStats(await fetchUsageStats({ kind, from: range.from, to: range.to, userId }));
    }, [kind, range.from, range.to, userId]);

    useEffect(() => {
        void refresh().catch((error) => message.error(error instanceof Error ? error.message : t("usage.loadFailed")));
    }, [message, refresh, t]);

    const pickerValue = useMemo((): [Dayjs, Dayjs] => {
        return [dayjs(range.from), dayjs(range.to - 1)];
    }, [range.from, range.to]);

    const amountUnit = kind === "video" ? t("usage.unitSeconds") : t("usage.unitImages");
    const isVideo = kind === "video";

    const breakdownColumns: ColumnsType<UsageStats["breakdown"][number]> = [
        { title: t("usage.channel"), dataIndex: "channelName", render: (value: string) => value || t("usage.unknownChannel") },
        { title: t("usage.modelType"), dataIndex: "model" },
        { title: isVideo ? t("usage.videoDuration") : t("usage.imageCount"), dataIndex: "amount" },
        { title: isVideo ? t("usage.videoTaskCount") : t("usage.imageTaskCount"), dataIndex: "taskCount" },
    ];

    const shareColumns: ColumnsType<UsageStats["shares"][number]> = [
        { title: t("usage.channel"), dataIndex: "channelName", render: (value: string) => value || t("usage.unknownChannel") },
        { title: t("usage.model"), dataIndex: "model" },
        { title: t("usage.share"), dataIndex: "percent", render: (value: number) => `${value}%` },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <Select
                    className="w-36"
                    value={kind}
                    onChange={setKind}
                    options={[
                        { value: "image", label: t("usage.kindImage") },
                        { value: "video", label: t("usage.kindVideo") },
                    ]}
                />
                {lockToday ? null : (
                    <>
                        <div className="flex flex-wrap gap-1">
                            {(["today", "yesterday", "last7", "last30"] as const).map((item) => (
                                <Button key={item} type={preset === item ? "primary" : "default"} onClick={() => setPreset(item)}>
                                    {t(`usage.preset.${item}`)}
                                </Button>
                            ))}
                        </div>
                        <DatePicker.RangePicker
                            value={pickerValue}
                            allowClear={false}
                            onChange={(dates) => {
                                if (!dates?.[0] || !dates[1]) return;
                                setCustomRange([dates[0].format("YYYY-MM-DD"), dates[1].format("YYYY-MM-DD")]);
                                setPreset("custom");
                            }}
                        />
                    </>
                )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label={isVideo ? t("usage.videoTotalDuration") : t("usage.imageTotal")} value={`${stats?.totalAmount ?? 0} ${amountUnit}`} />
                <StatCard label={isVideo ? t("usage.videoTasks") : t("usage.imageTasks")} value={t("usage.taskTimes", { count: stats?.taskCount ?? 0 })} />
            </div>

            <Panel
                title={isVideo ? t("usage.chartTitleVideo") : t("usage.chartTitleImage")}
                onDownload={() =>
                    downloadCsv("usage-chart.csv", [
                        [t("usage.time"), ...(stats?.series.map((item) => item.model) || [])],
                        ...(stats?.buckets.map((bucket, index) => [bucket, ...(stats.series.map((item) => String(item.values[index] || 0)) || [])]) || []),
                    ])
                }
            >
                <UsageLineChart buckets={stats?.buckets || []} series={stats?.series || []} />
            </Panel>

            <div className="grid gap-3 xl:grid-cols-2">
                <Panel
                    title={isVideo ? t("usage.breakdownTitleVideo") : t("usage.breakdownTitleImage")}
                    onDownload={() =>
                        downloadCsv("usage-models.csv", [
                            [t("usage.channel"), t("usage.modelType"), isVideo ? t("usage.videoDuration") : t("usage.imageCount"), isVideo ? t("usage.videoTaskCount") : t("usage.imageTaskCount")],
                            ...(stats?.breakdown.map((item) => [item.channelName || t("usage.unknownChannel"), item.model, String(item.amount), String(item.taskCount)]) || []),
                        ])
                    }
                >
                    <Table rowKey={(row) => `${row.channelId}-${row.model}`} size="small" pagination={false} columns={breakdownColumns} dataSource={stats?.breakdown || []} />
                </Panel>
                <Panel
                    title={isVideo ? t("usage.shareTitleVideo") : t("usage.shareTitleImage")}
                    onDownload={() =>
                        downloadCsv("usage-share.csv", [
                            [t("usage.channel"), t("usage.model"), t("usage.share")],
                            ...(stats?.shares.map((item) => [item.channelName || t("usage.unknownChannel"), item.model, `${item.percent}%`]) || []),
                        ])
                    }
                >
                    <Table rowKey={(row) => `${row.channelId}-${row.model}`} size="small" pagination={false} columns={shareColumns} dataSource={stats?.shares || []} />
                </Panel>
            </div>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-stone-200 px-4 py-4 dark:border-stone-800">
            <div className="text-xs text-stone-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-stone-950 dark:text-stone-100">{value}</div>
        </div>
    );
}

function Panel({ title, onDownload, children }: { title: string; onDownload: () => void; children: ReactNode }) {
    return (
        <div className="rounded-lg border border-stone-200 dark:border-stone-800">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="text-sm font-semibold">{title}</div>
                <Button type="text" size="small" icon={<Download className="size-4" />} onClick={onDownload} />
            </div>
            <div className="px-4 pb-4">{children}</div>
        </div>
    );
}

function UsageLineChart({ buckets, series }: { buckets: string[]; series: Array<{ model: string; values: number[] }> }) {
    const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
    const width = 960;
    const height = 280;
    const pad = { left: 44, right: 16, top: 16, bottom: 36 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const max = Math.max(1, ...series.flatMap((item) => item.values));
    const xAt = (index: number) => pad.left + (buckets.length <= 1 ? innerW / 2 : (index / Math.max(1, buckets.length - 1)) * innerW);
    const yAt = (value: number) => pad.top + innerH - (value / max) * innerH;
    const labelStep = buckets.length > 16 ? 3 : buckets.length > 8 ? 2 : 1;
    const flipX = hover ? hover.x > window.innerWidth - 240 : false;
    const flipY = hover ? hover.y > window.innerHeight - 180 : false;

    return (
        <div>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="h-64 w-full"
                onMouseLeave={() => setHover(null)}
                onMouseMove={(event) => {
                    if (!buckets.length) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const x = ((event.clientX - rect.left) / rect.width) * width;
                    let nearest = 0;
                    let distance = Infinity;
                    buckets.forEach((_, index) => {
                        const next = Math.abs(xAt(index) - x);
                        if (next < distance) {
                            distance = next;
                            nearest = index;
                        }
                    });
                    setHover({ index: nearest, x: event.clientX, y: event.clientY });
                }}
            >
                {[0, 0.5, 1].map((tick) => {
                    const value = max * tick;
                    const y = yAt(value);
                    return (
                        <g key={tick}>
                            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="stroke-stone-200 dark:stroke-stone-700" strokeWidth="1" />
                            <text x={pad.left - 8} y={y + 4} textAnchor="end" className="fill-stone-400" fontSize="11">
                                {tick === 1 ? max : tick === 0 ? 0 : Number(value.toFixed(max >= 2 ? 0 : 1))}
                            </text>
                        </g>
                    );
                })}
                {buckets.map((bucket, index) =>
                    index % labelStep === 0 ? (
                        <text key={bucket} x={xAt(index)} y={height - 10} textAnchor="middle" className="fill-stone-400" fontSize="11">
                            {bucket}
                        </text>
                    ) : null,
                )}
                {series.map((item, seriesIndex) => {
                    const points = item.values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(" ");
                    return <polyline key={item.model} fill="none" stroke={CHART_COLORS[seriesIndex % CHART_COLORS.length]} strokeWidth="2" points={points} />;
                })}
                {hover !== null && buckets[hover.index] ? (
                    <>
                        <line x1={xAt(hover.index)} x2={xAt(hover.index)} y1={pad.top} y2={pad.top + innerH} className="stroke-stone-300 dark:stroke-stone-600" strokeDasharray="4 4" />
                        {series.map((item, seriesIndex) => (
                            <circle key={item.model} cx={xAt(hover.index)} cy={yAt(item.values[hover.index] || 0)} r="3.5" fill={CHART_COLORS[seriesIndex % CHART_COLORS.length]} />
                        ))}
                    </>
                ) : null}
            </svg>
            {hover !== null && buckets[hover.index] && series.length ? (
                <div
                    className="pointer-events-none fixed z-50 min-w-40 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-stone-700 dark:bg-stone-900"
                    style={{ left: hover.x, top: hover.y, transform: `translate(${flipX ? "calc(-100% - 12px)" : "12px"}, ${flipY ? "calc(-100% - 12px)" : "12px"})` }}
                >
                    <div className="mb-1.5 font-medium text-stone-950 dark:text-stone-100">{buckets[hover.index]}</div>
                    {series.map((item, index) => (
                        <div key={item.model} className="flex items-center justify-between gap-4 py-0.5 text-stone-600 dark:text-stone-300">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="size-2 shrink-0 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                                {item.model}
                            </span>
                            <span className="tabular-nums">{item.values[hover.index] || 0}</span>
                        </div>
                    ))}
                </div>
            ) : null}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-stone-500">
                {series.map((item, index) => (
                    <span key={item.model} className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                        {item.model}
                    </span>
                ))}
            </div>
        </div>
    );
}
