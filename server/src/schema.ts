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

export function toPublicUser(row: UserRow): PublicUser {
    return { id: row.id, username: row.username, role: row.role, creditBalance: row.credit_balance };
}
