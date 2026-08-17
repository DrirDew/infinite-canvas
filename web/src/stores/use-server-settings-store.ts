import { create } from "zustand";

import { fetchAppSettings, updateAppSettings } from "@/services/api/settings";

type ServerSettingsStore = {
    storeMedia: boolean;
    loadSettings: () => Promise<void>;
    setStoreMedia: (storeMedia: boolean) => Promise<void>;
    clearSettings: () => void;
};

export const useServerSettingsStore = create<ServerSettingsStore>()((set) => ({
    storeMedia: true,
    loadSettings: async () => {
        try {
            set({ storeMedia: (await fetchAppSettings()).storeMedia });
        } catch {
            set({ storeMedia: true });
        }
    },
    setStoreMedia: async (storeMedia) => {
        set({ storeMedia: (await updateAppSettings({ storeMedia })).storeMedia });
    },
    clearSettings: () => set({ storeMedia: true }),
}));
