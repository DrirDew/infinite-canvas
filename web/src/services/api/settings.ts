import { appApi } from "@/services/api/app-http";

export type AppSettings = {
    storeMedia: boolean;
};

export async function fetchAppSettings() {
    const response = await appApi.get<AppSettings>("/api/settings");
    return response.data;
}

export async function updateAppSettings(input: AppSettings) {
    const response = await appApi.patch<AppSettings>("/api/settings", input);
    return response.data;
}
