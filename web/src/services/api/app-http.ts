import axios from "axios";

export const appApi = axios.create({ withCredentials: true });

appApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            const url = String(error.config?.url || "");
            if (!url.includes("/api/auth/login") && !url.includes("/api/auth/me")) {
                void import("@/stores/use-user-store").then(({ useUserStore }) => {
                    useUserStore.getState().clearSession();
                    if (window.location.pathname !== "/login") window.location.assign("/login");
                });
            }
        }
        return Promise.reject(error);
    },
);
