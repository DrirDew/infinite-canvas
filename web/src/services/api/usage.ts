import { appApi } from "@/services/api/app-http";
import type { SessionUser } from "@/services/api/auth";

export type UsageKind = "image" | "video";

export type UsageStats = {
    kind: UsageKind;
    from: number;
    to: number;
    totalAmount: number;
    taskCount: number;
    buckets: string[];
    series: Array<{ model: string; values: number[] }>;
    breakdown: Array<{ channelId: string; channelName: string; model: string; amount: number; taskCount: number }>;
    shares: Array<{ channelId: string; channelName: string; model: string; amount: number; percent: number }>;
};

export async function fetchTodayUsage() {
    const response = await appApi.get<{ users?: SessionUser[] }>("/api/usage/today");
    return response.data.users || [];
}

export async function fetchUsageStats(params: { kind: UsageKind; from: number; to: number; userId?: string }) {
    const response = await appApi.get<UsageStats>("/api/usage/stats", { params });
    return response.data;
}
