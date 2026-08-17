import { App, Button, Form, Input } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUserStore } from "@/stores/use-user-store";

export function ConfigTeamUsers() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const users = useUserStore((state) => state.users);
    const loadUsers = useUserStore((state) => state.loadUsers);
    const createUser = useUserStore((state) => state.createUser);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm<{ username: string; password: string }>();

    useEffect(() => {
        void loadUsers().catch((error) => message.error(error instanceof Error ? error.message : t("auth.loadUsersFailed")));
    }, [loadUsers, message, t]);

    const onCreate = async (values: { username: string; password: string }) => {
        setSubmitting(true);
        try {
            await createUser(values.username.trim(), values.password);
            form.resetFields();
            message.success(t("auth.userCreated"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("auth.createUserFailed"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <p className="text-xs text-stone-500">{t("auth.teamHint")}</p>
            <div className="space-y-2">
                {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-4 py-3 dark:border-stone-800">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{user.username}</div>
                            <div className="mt-1 text-xs text-stone-500">{t(user.role === "admin" ? "auth.roleAdmin" : "auth.roleUser")}</div>
                        </div>
                    </div>
                ))}
            </div>
            <Form form={form} layout="vertical" onFinish={(values) => void onCreate(values)} requiredMark={false}>
                <div className="grid gap-3 md:grid-cols-2">
                    <Form.Item name="username" label={t("auth.username")} rules={[{ required: true, message: t("auth.usernameRequired") }]}>
                        <Input autoComplete="off" />
                    </Form.Item>
                    <Form.Item name="password" label={t("auth.password")} rules={[{ required: true, message: t("auth.passwordRequired") }]}>
                        <Input.Password autoComplete="new-password" />
                    </Form.Item>
                </div>
                <Button type="primary" htmlType="submit" loading={submitting}>
                    {t("auth.createUser")}
                </Button>
            </Form>
        </div>
    );
}
