import { create } from "zustand";

import { createUserRequest, fetchCurrentUser, fetchUsers, loginRequest, logoutRequest, adjustQuotasRequest, changePasswordRequest, deleteUserRequest, type QuotaPatch, type SessionUser } from "@/services/api/auth";
import { useConfigStore } from "@/stores/use-config-store";

type SessionStatus = "unknown" | "ready";

type UserStore = {
    status: SessionStatus;
    user: SessionUser | null;
    users: SessionUser[];
    restoreSession: () => Promise<void>;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    loadUsers: () => Promise<void>;
    createUser: (username: string, password: string) => Promise<void>;
    changePassword: (userId: string, currentPassword: string, newPassword: string) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    adjustQuotas: (userId: string, payload: { imageQuota?: number; videoQuota?: number }) => Promise<void>;
    applyQuota: (patch: QuotaPatch) => void;
    clearSession: () => void;
};

export const useUserStore = create<UserStore>()((set, get) => ({
    status: "unknown",
    user: null,
    users: [],
    restoreSession: async () => {
        try {
            set({ user: await fetchCurrentUser(), status: "ready" });
        } catch {
            set({ user: null, users: [], status: "ready" });
        }
    },
    login: async (username, password) => {
        useConfigStore.getState().clearPersonalChannels();
        set({ user: await loginRequest(username, password), status: "ready" });
    },
    logout: async () => {
        await logoutRequest();
        get().clearSession();
    },
    loadUsers: async () => {
        if (get().user?.role !== "admin") return;
        set({ users: await fetchUsers() });
    },
    createUser: async (username, password) => {
        const user = await createUserRequest(username, password);
        set({ users: [...get().users, user] });
    },
    changePassword: async (userId, currentPassword, newPassword) => {
        await changePasswordRequest(userId, currentPassword, newPassword);
    },
    deleteUser: async (userId) => {
        await deleteUserRequest(userId);
        set({ users: get().users.filter((item) => item.id !== userId) });
    },
    adjustQuotas: async (userId, payload) => {
        const user = await adjustQuotasRequest(userId, payload);
        set({
            users: get().users.map((item) => (item.id === user.id ? user : item)),
            user: get().user?.id === user.id ? { ...get().user!, ...user } : get().user,
        });
    },
    applyQuota: (patch) => {
        const user = get().user;
        if (!user) return;
        const next = { ...user };
        if (typeof patch.imageRemaining === "number") next.imageRemaining = patch.imageRemaining;
        if (typeof patch.videoRemaining === "number") next.videoRemaining = patch.videoRemaining;
        if (typeof patch.imageQuota === "number") next.imageQuota = patch.imageQuota;
        if (typeof patch.videoQuota === "number") next.videoQuota = patch.videoQuota;
        if (typeof patch.imageUsed === "number") next.imageUsed = patch.imageUsed;
        if (typeof patch.videoUsed === "number") next.videoUsed = patch.videoUsed;
        set({ user: next });
    },
    clearSession: () => {
        useConfigStore.getState().clearPersonalChannels();
        set({ user: null, users: [], status: "ready" });
    },
}));
