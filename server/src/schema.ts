export type UserRole = "admin" | "user";

export type UserRow = {
    id: string;
    username: string;
    password_hash: string;
    role: UserRole;
    credit_balance: number;
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
    creditBalance: number;
    generatedCount: number;
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

export type GenerationAssetRow = {
    id: string;
    job_id: string;
    item_index: number;
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

export function toPublicUser(row: UserRow, generatedCount = 0): PublicUser {
    return { id: row.id, username: row.username, role: row.role, creditBalance: row.credit_balance, generatedCount };
}
