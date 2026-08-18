import { ensureQuotaDay, findUserById, listChannels, listSuccessJobs, shanghaiDate, shanghaiDayStart } from "./db";
import { toPublicUser, type QuotaKind } from "./schema";
import { publicUsers } from "./users";

function parseExtra(raw: string | undefined) {
    try {
        const value = JSON.parse(raw || "{}");
        return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

function jobModel(job: { model: string; quality: string }) {
    return [job.model, job.quality].filter((item) => item && item !== "auto").join("_") || job.model || "unknown";
}

function jobAmount(job: { extra_json: string; success_count: number }, kind: QuotaKind) {
    const extra = parseExtra(job.extra_json);
    if (kind === "video") return Math.max(0, Number(extra.videoSeconds) || 0) * Math.max(1, job.success_count || 0);
    return Math.max(0, job.success_count || 0);
}

function shanghaiHourLabel(at: number) {
    const hour = Math.floor((at - shanghaiDayStart(shanghaiDate(at))) / (60 * 60 * 1000));
    return `${String(Math.min(23, Math.max(0, hour))).padStart(2, "0")}:00`;
}

function bucketKey(at: number, hourly: boolean) {
    return hourly ? shanghaiHourLabel(at) : shanghaiDate(at);
}

function buildBuckets(from: number, to: number) {
    const hourly = to - from <= 36 * 60 * 60 * 1000;
    if (hourly) return { hourly, buckets: Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`) };
    const buckets: string[] = [];
    for (let at = from; at < to; at += 24 * 60 * 60 * 1000) buckets.push(shanghaiDate(at));
    return { hourly, buckets };
}

export function usageForUser(userId: string) {
    const row = ensureQuotaDay(userId);
    return row ? toPublicUser(row) : null;
}

export function usageToday(actorId: string, isAdmin: boolean) {
    if (isAdmin) return { users: publicUsers() };
    const row = ensureQuotaDay(actorId);
    return { users: row ? [toPublicUser(row)] : [] };
}

export function usageStats(kind: QuotaKind, from: number, to: number, userId?: string) {
    const jobs = listSuccessJobs(kind, from, to, userId || undefined);
    const channels = new Map(listChannels().map((row) => [row.id, row.name]));
    const { hourly, buckets } = buildBuckets(from, to);
    const bucketIndex = new Map(buckets.map((key, index) => [key, index]));
    const seriesMap = new Map<string, number[]>();
    const breakdownMap = new Map<string, { channelId: string; channelName: string; model: string; amount: number; taskCount: number }>();
    let totalAmount = 0;

    for (const job of jobs) {
        const at = job.finished_at || job.updated_at || job.created_at;
        const key = bucketKey(at, hourly);
        const index = bucketIndex.get(key);
        const model = jobModel(job);
        const amount = jobAmount(job, kind);
        const extra = parseExtra(job.extra_json);
        const channelId = String(extra.channelId || "");
        const channelName = channels.get(channelId) || "";
        totalAmount += amount;
        if (index !== undefined) {
            const values = seriesMap.get(model) || Array.from({ length: buckets.length }, () => 0);
            values[index] += amount;
            seriesMap.set(model, values);
        }
        const breakdownKey = `${channelId}\t${model}`;
        const current = breakdownMap.get(breakdownKey) || { channelId, channelName, model, amount: 0, taskCount: 0 };
        current.amount += amount;
        current.taskCount += 1;
        breakdownMap.set(breakdownKey, current);
    }

    const breakdown = [...breakdownMap.values()].toSorted((a, b) => b.amount - a.amount || a.model.localeCompare(b.model));
    const shares = breakdown.map((item) => ({
        channelId: item.channelId,
        channelName: item.channelName,
        model: item.model,
        amount: item.amount,
        percent: totalAmount ? Math.round((item.amount / totalAmount) * 10000) / 100 : 0,
    }));

    return {
        kind,
        from,
        to,
        totalAmount,
        taskCount: jobs.length,
        buckets,
        series: [...seriesMap.entries()].map(([model, values]) => ({ model, values })),
        breakdown,
        shares,
    };
}

export function resolveStatsUserId(actorId: string, isAdmin: boolean, requestedUserId: string) {
    if (!isAdmin) return actorId;
    return requestedUserId && findUserById(requestedUserId) ? requestedUserId : "";
}
