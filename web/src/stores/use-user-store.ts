import { create } from "zustand";

import { createUserRequest, fetchCurrentUser, fetchUsers, loginRequest, logoutRequest, adjustCreditsRequest, type SessionUser } from "@/services/api/auth";
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
    adjustCredits: (userId: string, creditBalance: number) => Promise<void>;
    setCreditBalance: (creditBalance: number) => void;
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
    adjustCredits: async (userId, creditBalance) => {
        const user = await adjustCreditsRequest(userId, creditBalance);
        set({
            users: get().users.map((item) => (item.id === user.id ? user : item)),
            user: get().user?.id === user.id ? { ...get().user!, creditBalance: user.creditBalance } : get().user,
        });
    },
    setCreditBalance: (creditBalance) => {
        const user = get().user;
        if (user) set({ user: { ...user, creditBalance } });
    },
    clearSession: () => {
        useConfigStore.getState().clearPersonalChannels();
        set({ user: null, users: [], status: "ready" });
    },
}));
