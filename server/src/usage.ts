import { findUserById, generatedCountForUser, jobCountByUser, listLedgerByUser } from "./db";
import { toPublicUser } from "./schema";

export function usageForUser(userId: string) {
    const row = findUserById(userId);
    if (!row) return null;
    return {
        ...toPublicUser(row, generatedCountForUser(userId)),
        jobCount: jobCountByUser(userId),
        entries: listLedgerByUser(userId).map((item) => ({
            id: item.id,
            delta: item.delta,
            reason: item.reason,
            jobId: item.job_id,
            createdAt: item.created_at,
        })),
    };
}
