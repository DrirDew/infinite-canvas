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
};

export type GenerationJobRow = {
    id: string;
    user_id: string;
    kind: string;
    prompt: string;
    model: string;
    size: string;
    quality: string;
    count: number;
    status: "success" | "failed";
    error: string;
    duration_ms: number;
    success_count: number;
    fail_count: number;
    created_at: number;
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

export function toPublicUser(row: UserRow): PublicUser {
    return { id: row.id, username: row.username, role: row.role, creditBalance: row.credit_balance };
}
