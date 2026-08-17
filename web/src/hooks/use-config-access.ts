import { useConfigStore, type ConfigTabKey } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

export function isAdminUser() {
    return useUserStore.getState().user?.role === "admin";
}

export function useConfigAccess() {
    const isAdmin = useUserStore((state) => state.user?.role === "admin");
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const requestConfig = (shouldPromptContinue = false, tab?: ConfigTabKey) => {
        openConfigDialog(shouldPromptContinue, tab);
    };
    return { isAdmin, requestConfig };
}
