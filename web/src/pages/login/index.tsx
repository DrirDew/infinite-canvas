import { useEffect, useState } from "react";
import { App, Button, Form, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useUserStore } from "@/stores/use-user-store";

export default function LoginPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { message } = App.useApp();
    const user = useUserStore((state) => state.user);
    const login = useUserStore((state) => state.login);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user) navigate("/", { replace: true });
    }, [navigate, user]);

    const onFinish = async (values: { username: string; password: string }) => {
        setSubmitting(true);
        try {
            await login(values.username.trim(), values.password);
            navigate("/", { replace: true });
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("auth.loginFailed"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex h-dvh items-center justify-center bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] px-6 [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.16)_1px,transparent_1px)]">
            <section className="w-full max-w-sm">
                <h1 className="text-center text-2xl font-semibold text-stone-950 dark:text-stone-100">{t("meta.title")}</h1>
                <p className="mt-2 text-center text-sm text-stone-500">{t("auth.description")}</p>
                <Form className="mt-8" layout="vertical" onFinish={(values) => void onFinish(values)} requiredMark={false}>
                    <Form.Item name="username" label={t("auth.username")} rules={[{ required: true, message: t("auth.usernameRequired") }]}>
                        <Input autoComplete="username" autoFocus />
                    </Form.Item>
                    <Form.Item name="password" label={t("auth.password")} rules={[{ required: true, message: t("auth.passwordRequired") }]}>
                        <Input.Password autoComplete="current-password" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={submitting} block>
                        {t("auth.login")}
                    </Button>
                </Form>
            </section>
        </div>
    );
}
