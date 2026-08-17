import { appApi } from "@/services/api/app-http";

export type UsageEntry = {
    id: string;
    delta: number;
    reason: "generate" | "adjust" | string;
    jobId?: string | null;
    createdAt: number;
};

export type UsageSummary = {
    id: string;
    username: string;
    role: "admin" | "user";
    creditBalance: number;
    generatedCount: number;
    jobCount: number;
    entries: UsageEntry[];
};

export async function fetchMyUsage() {
    const response = await appApi.get<UsageSummary>("/api/usage/me");
    return response.data;
}
