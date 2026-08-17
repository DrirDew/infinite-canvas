import { Navigate, Outlet } from "react-router-dom";

import { useUserStore } from "@/stores/use-user-store";

export function RequireAuth() {
    const user = useUserStore((state) => state.user);
    if (!user) return <Navigate to="/login" replace />;
    return <Outlet />;
}

export function RequireAdmin() {
    const role = useUserStore((state) => state.user?.role);
    if (role !== "admin") return <Navigate to="/" replace />;
    return <Outlet />;
}
