import { create } from "zustand";

import { createUserRequest, fetchCurrentUser, fetchUsers, loginRequest, logoutRequest, type SessionUser } from "@/services/api/auth";

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
    clearSession: () => set({ user: null, users: [], status: "ready" }),
}));
