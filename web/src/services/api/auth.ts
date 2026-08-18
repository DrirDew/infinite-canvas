import { appApi } from "@/services/api/app-http";

export type UserRole = "admin" | "user";

export type SessionUser = {
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

export type QuotaPatch = {
    imageRemaining?: number;
    videoRemaining?: number;
    imageQuota?: number;
    videoQuota?: number;
    imageUsed?: number;
    videoUsed?: number;
};

function errorMessage(error: unknown, fallback: string) {
    if (axiosErrorMessage(error)) return axiosErrorMessage(error);
    return error instanceof Error ? error.message : fallback;
}

function axiosErrorMessage(error: unknown) {
    if (!error || typeof error !== "object" || !("response" in error)) return "";
    const data = (error as { response?: { data?: { error?: string } } }).response?.data;
    return data?.error || "";
}

export async function loginRequest(username: string, password: string) {
    try {
        const response = await appApi.post<SessionUser>("/api/auth/login", { username, password });
        return response.data;
    } catch (error) {
        throw new Error(errorMessage(error, "登录失败"));
    }
}

export async function logoutRequest() {
    try {
        await appApi.post("/api/auth/logout");
    } catch {
        // Clearing the local session still logs the user out of this browser.
    }
}

export async function fetchCurrentUser() {
    const response = await appApi.get<SessionUser>("/api/auth/me");
    return response.data;
}

export async function fetchUsers() {
    const response = await appApi.get<{ users?: SessionUser[] }>("/api/users");
    return response.data.users || [];
}

export async function createUserRequest(username: string, password: string) {
    try {
        const response = await appApi.post<SessionUser>("/api/users", { username, password });
        return response.data;
    } catch (error) {
        throw new Error(errorMessage(error, "创建用户失败"));
    }
}

export async function changePasswordRequest(userId: string, currentPassword: string, newPassword: string) {
    try {
        await appApi.patch(`/api/users/${userId}/password`, { currentPassword, newPassword });
    } catch (error) {
        throw new Error(errorMessage(error, "修改密码失败"));
    }
}

export async function deleteUserRequest(userId: string) {
    try {
        await appApi.delete(`/api/users/${userId}`);
    } catch (error) {
        throw new Error(errorMessage(error, "删除用户失败"));
    }
}

export async function adjustQuotasRequest(userId: string, payload: { imageQuota?: number; videoQuota?: number }) {
    try {
        const response = await appApi.patch<SessionUser>(`/api/users/${userId}/credits`, payload);
        return response.data;
    } catch (error) {
        throw new Error(errorMessage(error, "调整额度失败"));
    }
}
