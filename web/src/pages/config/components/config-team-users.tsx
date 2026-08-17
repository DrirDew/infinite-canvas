import { App, Button, Drawer, Form, Input, Space } from "antd";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUserStore } from "@/stores/use-user-store";
import type { SessionUser } from "@/services/api/auth";

type UserDraft = { username: string; currentPassword: string; password: string; confirmPassword: string };

export function ConfigTeamUsers() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const users = useUserStore((state) => state.users);
    const loadUsers = useUserStore((state) => state.loadUsers);
    const deleteUser = useUserStore((state) => state.deleteUser);
    const [editing, setEditing] = useState<SessionUser | "new" | null>(null);

    const onDelete = (user: SessionUser) => {
        if (user.role === "admin") {
            message.warning(t("auth.cannotDeleteAdmin"));
            return;
        }
        void deleteUser(user.id)
            .then(() => message.success(t("auth.userDeleted")))
            .catch((error) => message.error(error instanceof Error ? error.message : t("auth.deleteUserFailed")));
    };

    useEffect(() => {
        void loadUsers().catch((error) => message.error(error instanceof Error ? error.message : t("auth.loadUsersFailed")));
    }, [loadUsers, message, t]);

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-stone-500">{t("auth.teamHint")}</div>
                <Button type="primary" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
                    {t("auth.addUser")}
                </Button>
            </div>
            <div className="space-y-2">
                {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-4 py-3 dark:border-stone-800">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{user.username}</div>
                            <div className="mt-1 text-xs text-stone-500">{t(user.role === "admin" ? "auth.roleAdmin" : "auth.roleUser")}</div>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                            <Button size="small" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(user)}>
                                {t("auth.editTitle")}
                            </Button>
                            <Button size="small" danger icon={<Trash2 className="size-3.5" />} className={user.role === "admin" ? "opacity-40" : undefined} onClick={() => onDelete(user)} />
                        </div>
                    </div>
                ))}
            </div>
            <UserEditorDrawer editing={editing} onClose={() => setEditing(null)} />
        </div>
    );
}

function UserEditorDrawer({ editing, onClose }: { editing: SessionUser | "new" | null; onClose: () => void }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const createUser = useUserStore((state) => state.createUser);
    const changePassword = useUserStore((state) => state.changePassword);
    const [form] = Form.useForm<UserDraft>();
    const [submitting, setSubmitting] = useState(false);
    const creating = editing === "new";
    const open = Boolean(editing);

    useEffect(() => {
        if (open) form.resetFields();
    }, [form, open, editing]);

    const confirmRule = ({ getFieldValue }: { getFieldValue: (name: keyof UserDraft) => string }) => ({
        validator(_: unknown, value: string) {
            if (value === getFieldValue("password")) return Promise.resolve();
            return Promise.reject(new Error(t("auth.passwordMismatch")));
        },
    });

    const save = async (values: UserDraft) => {
        setSubmitting(true);
        try {
            if (creating) {
                await createUser(values.username.trim(), values.password);
                message.success(t("auth.userCreated"));
            } else if (editing && editing !== "new") {
                await changePassword(editing.id, values.currentPassword, values.password);
                message.success(t("auth.passwordChanged"));
            }
            onClose();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t(creating ? "auth.createUserFailed" : "auth.changePasswordFailed"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Drawer
            open={open}
            width={480}
            title={t(creating ? "auth.addTitle" : "auth.editTitle")}
            onClose={onClose}
            styles={{ body: { paddingTop: 16 } }}
            extra={
                <Space>
                    <Button onClick={onClose}>{t("common.cancel")}</Button>
                    <Button type="primary" loading={submitting} onClick={() => void form.submit()}>
                        {t("common.save")}
                    </Button>
                </Space>
            }
        >
            <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => void save(values)}>
                {creating ? (
                    <Form.Item name="username" label={t("auth.username")} rules={[{ required: true, message: t("auth.usernameRequired") }]}>
                        <Input autoComplete="off" autoFocus />
                    </Form.Item>
                ) : (
                    <Form.Item label={t("auth.username")}>
                        <Input value={editing && editing !== "new" ? editing.username : ""} disabled />
                    </Form.Item>
                )}
                {creating ? null : (
                    <Form.Item name="currentPassword" label={t("auth.currentPassword")} extra={t("auth.currentPasswordHint")} rules={[{ required: true, message: t("auth.currentPasswordRequired") }]}>
                        <Input.Password autoComplete="current-password" />
                    </Form.Item>
                )}
                <Form.Item
                    name="password"
                    label={t(creating ? "auth.password" : "auth.newPassword")}
                    rules={[
                        { required: true, message: t("auth.passwordRequired") },
                        { min: 6, message: t("auth.passwordMin") },
                    ]}
                >
                    <Input.Password autoComplete="new-password" />
                </Form.Item>
                <Form.Item
                    name="confirmPassword"
                    label={t("auth.confirmPassword")}
                    dependencies={["password"]}
                    rules={[{ required: true, message: t("auth.confirmPasswordRequired") }, confirmRule]}
                >
                    <Input.Password autoComplete="new-password" />
                </Form.Item>
            </Form>
        </Drawer>
    );
}
