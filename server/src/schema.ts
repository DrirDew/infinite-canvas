export type UserRole = "admin" | "user";

export type QuotaKind = "image" | "video";

export type UserRow = {
    id: string;
    username: string;
    password_hash: string;
    role: UserRole;
    image_quota: number;
    video_quota: number;
    image_used: number;
    video_used: number;
    quota_date: string;
    created_at: number;
};

export type SessionRow = {
    id: string;
    user_id: string;
    expires_at: number;
    created_at: number;
};

export type PublicUser = {
    id: string;
    username: string;
    role: UserRole;
    imageQuota: number;
    videoQuota: number;
    imageUsed: number;
    videoUsed: number;
    imageRemaining: number;
    videoRemaining: number;
};

export type GenerationJobStatus = "draft" | "running" | "success" | "failed";

export type GenerationJobRow = {
    id: string;
    user_id: string;
    kind: string;
    prompt: string;
    model: string;
    size: string;
    quality: string;
    count: number;
    status: GenerationJobStatus;
    error: string;
    duration_ms: number;
    success_count: number;
    fail_count: number;
    extra_json: string;
    created_at: number;
    updated_at: number;
    started_at: number;
    finished_at: number;
};

export type GenerationAssetRole = "result" | "image-ref" | "video-ref" | "audio-ref";

export type GenerationAssetRow = {
    id: string;
    job_id: string;
    item_index: number;
    role: GenerationAssetRole | string;
    mime: string;
    path: string;
    width: number;
    height: number;
    bytes: number;
};

export type LedgerRow = {
    id: string;
    user_id: string;
    job_id: string | null;
    delta: number;
    reason: string;
    created_at: number;
};

export type ChannelRow = {
    id: string;
    name: string;
    api_format: string;
    base_url: string;
    api_key: string;
    secret_key: string;
    sub_app_id: string;
    models_json: string;
    created_at: number;
    updated_at: number;
};

function remainingOf(quota: number, used: number) {
    return Math.max(0, (Number(quota) || 0) - (Number(used) || 0));
}

export function toPublicUser(row: UserRow): PublicUser {
    return {
        id: row.id,
        username: row.username,
        role: row.role,
        imageQuota: row.image_quota || 0,
        videoQuota: row.video_quota || 0,
        imageUsed: row.image_used || 0,
        videoUsed: row.video_used || 0,
        imageRemaining: remainingOf(row.image_quota, row.image_used),
        videoRemaining: remainingOf(row.video_quota, row.video_used),
    };
}

export function quotaEventFields(row: UserRow) {
    const user = toPublicUser(row);
    return { imageRemaining: user.imageRemaining, videoRemaining: user.videoRemaining };
}
