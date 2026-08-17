import { createBrowserRouter, Outlet } from "react-router-dom";

import { AnalyticsTracker } from "@/components/layout/analytics-tracker";
import { RequireAdmin, RequireAuth } from "@/components/layout/require-auth";
import UserLayout from "@/layouts/user-layout";
import AssetsPage from "@/pages/assets";
import CanvasPage from "@/pages/canvas";
import CanvasProjectPage from "@/pages/canvas/project";
import ConfigPage from "@/pages/config";
import HomePage from "@/pages/home";
import ImagePage from "@/pages/image";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import PromptsPage from "@/pages/prompts";
import VideoPage from "@/pages/video";

export const router = createBrowserRouter([
    { path: "/login", element: <LoginPage /> },
    {
        element: <RequireAuth />,
        children: [
            {
                element: (
                    <UserLayout>
                        <AnalyticsTracker />
                        <Outlet />
                    </UserLayout>
                ),
                children: [
                    { path: "/", element: <HomePage /> },
                    { path: "/image", element: <ImagePage /> },
                    { path: "/video", element: <VideoPage /> },
                    { path: "/assets", element: <AssetsPage /> },
                    { path: "/prompts", element: <PromptsPage /> },
                    { path: "/canvas", element: <CanvasPage /> },
                    { path: "/canvas/:id", element: <CanvasProjectPage /> },
                    {
                        element: <RequireAdmin />,
                        children: [{ path: "/config", element: <ConfigPage /> }],
                    },
                ],
            },
        ],
    },
    { path: "*", element: <NotFound /> },
]);
