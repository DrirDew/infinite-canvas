import { Button, Drawer, Input, Segmented, Select, Space, Switch } from "antd";
import { ListPlus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { defaultBaseUrlForApiFormat, guessCapability, isSharedChannel, normalizeChannelModels, TENCENT_VOD_DEFAULT_MODELS, type ApiCallFormat, type ChannelModel, type ModelCapability, type ModelChannel } from "@/stores/use-config-store";
import { ModelScriptEditor } from "./model-script-editor";
import { ModelSelectModal } from "./model-select-modal";

type ScriptTarget = { name: string; capability: ModelCapability; value: string };

export function ChannelEditorDrawer({ open, channel, readOnly, canShare, onSave, onClose }: { open: boolean; channel: ModelChannel | null; readOnly?: boolean; canShare?: boolean; onSave: (channel: ModelChannel) => void; onClose: () => void }) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<ModelChannel | null>(channel);
    const [selectOpen, setSelectOpen] = useState(false);
    const [scriptTarget, setScriptTarget] = useState<ScriptTarget | null>(null);
    const apiFormatOptions: Array<{ label: string; value: ApiCallFormat }> = [
        { label: "OpenAI", value: "openai" },
        { label: "Gemini", value: "gemini" },
        { label: t("config.protocols.ark"), value: "ark" },
        { label: t("config.protocols.tencentVod"), value: "tencent-vod" },
    ];
    const capabilityOptions: Array<{ label: string; value: ModelCapability }> = ["image", "video", "text", "audio"].map((value) => ({ label: t(`config.channelEditor.capabilities.${value}`), value: value as ModelCapability }));

    useEffect(() => {
        if (open && channel) setDraft(channel);
    }, [open, channel]);

    if (!draft) return null;
    const shared = isSharedChannel(draft);
    const locked = Boolean(readOnly);

    const patch = (value: Partial<ModelChannel>) => {
        if (locked) return;
        setDraft((current) => (current ? { ...current, ...value } : current));
    };
    const setModels = (models: ChannelModel[]) => patch({ models });

    const changeApiFormat = (apiFormat: ApiCallFormat) => {
        const baseUrl = !draft.baseUrl.trim() || draft.baseUrl.trim() === defaultBaseUrlForApiFormat(draft.apiFormat) ? defaultBaseUrlForApiFormat(apiFormat) : draft.baseUrl;
        const models = apiFormat === "tencent-vod" && !draft.models.some((model) => model.name.startsWith("image2") || model.name.startsWith("gg_")) ? TENCENT_VOD_DEFAULT_MODELS : draft.models;
        patch({ apiFormat, baseUrl, models });
    };

    const applySelection = (names: string[]) => {
        const map = new Map(draft.models.map((model) => [model.name, model]));
        setModels(names.map((name) => map.get(name) || { name, capability: guessCapability(name) }));
    };

    const setCapability = (name: string, capability: ModelCapability) => setModels(draft.models.map((model) => (model.name === name ? { ...model, capability } : model)));
    const setScript = (name: string, script: string) => setModels(draft.models.map((model) => (model.name === name ? { ...model, script: script || undefined } : model)));
    const removeModel = (name: string) => setModels(draft.models.filter((model) => model.name !== name));
    const canReveal = Boolean(canShare);
    const secretPlaceholder = draft.apiFormat === "tencent-vod" ? "AKIDxxxxxxxx" : "sk-...";

    const save = () => {
        onSave({ ...draft, name: draft.name.trim() || t("config.channels.unnamed"), models: normalizeChannelModels(draft.models) });
        onClose();
    };

    return (
        <Drawer
            open={open}
            width={640}
            title={t(locked ? "config.channelEditor.viewTitle" : "config.channelEditor.title")}
            onClose={onClose}
            styles={{ body: { paddingTop: 16 } }}
            extra={
                locked ? (
                    <Button onClick={onClose}>{t("common.close")}</Button>
                ) : (
                    <Space>
                        <Button onClick={onClose}>{t("common.cancel")}</Button>
                        <Button type="primary" onClick={save}>
                            {t("common.save")}
                        </Button>
                    </Space>
                )
            }
        >
            <div className="grid gap-4 md:grid-cols-2">
                {canShare || shared ? (
                    <label className="flex items-center justify-between gap-3 md:col-span-2 rounded-lg border border-stone-200 px-4 py-3 dark:border-stone-800">
                        <span>
                            <span className="block text-sm font-medium">{t("config.channelEditor.sharedSwitch")}</span>
                            <span className="mt-0.5 block text-xs text-stone-500">{t("config.channelEditor.sharedSwitchHint")}</span>
                        </span>
                        <Switch checked={shared} disabled={locked || !canShare} onChange={(checked) => patch({ shared: checked, managed: checked })} />
                    </label>
                ) : null}
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.name")}</span>
                    <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} disabled={locked} />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.protocol")}</span>
                    <Select className="w-full" value={draft.apiFormat} options={apiFormatOptions} onChange={changeApiFormat} disabled={locked} />
                </label>
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.baseUrl")}</span>
                    <Input value={draft.baseUrl} onChange={(event) => patch({ baseUrl: event.target.value })} placeholder={draft.apiFormat === "tencent-vod" ? "/tencent-vod" : "https://api.example.com"} disabled={locked} />
                </label>
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium">{draft.apiFormat === "tencent-vod" ? t("config.channelEditor.secretId") : "API Key"}</span>
                    <Input.Password value={draft.apiKey} onChange={(event) => patch({ apiKey: event.target.value })} placeholder={secretPlaceholder} disabled={locked} visibilityToggle={canReveal} />
                </label>
                {draft.apiFormat === "tencent-vod" ? (
                    <>
                        <label className="block md:col-span-2">
                            <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.secretKey")}</span>
                            <Input.Password value={draft.secretKey || ""} onChange={(event) => patch({ secretKey: event.target.value })} disabled={locked} visibilityToggle={canReveal} />
                        </label>
                        <label className="block md:col-span-2">
                            <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.subAppId")}</span>
                            <Input.Password value={draft.subAppId || ""} onChange={(event) => patch({ subAppId: event.target.value.trim() })} placeholder="251007502" disabled={locked} visibilityToggle={canReveal} />
                        </label>
                        <p className="md:col-span-2 text-xs leading-5 text-stone-500">{shared ? t("config.channelEditor.sharedHint") : t("config.channelEditor.tencentVodHint")}</p>
                    </>
                ) : shared ? (
                    <p className="md:col-span-2 text-xs leading-5 text-stone-500">{t("config.channelEditor.sharedHint")}</p>
                ) : null}
            </div>

            <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-sm font-semibold">{t("config.channelEditor.models")}</div>
                    <div className="mt-0.5 text-xs text-stone-500">{t("config.channelEditor.modelDescription", { count: draft.models.length })}</div>
                </div>
                <Button type="primary" icon={<ListPlus className="size-4" />} onClick={() => setSelectOpen(true)} disabled={locked}>
                    {t("config.channelEditor.selectModels")}
                </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-stone-200 p-2 dark:border-stone-800">
                {draft.models.length ? (
                    draft.models.map((model) => (
                        <div key={model.name} className="flex flex-wrap items-center gap-3 rounded-md px-2 py-1.5 hover:bg-stone-50 dark:hover:bg-stone-900/40">
                            <span className="min-w-0 flex-1 truncate text-sm" title={model.name}>
                                {model.name}
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
                                <Segmented size="small" value={model.capability} options={capabilityOptions} onChange={(value) => setCapability(model.name, value as ModelCapability)} disabled={locked} />
                                {locked ? null : (
                                    <>
                                        <Button size="small" type={model.script ? "primary" : "default"} ghost={Boolean(model.script)} onClick={() => setScriptTarget({ name: model.name, capability: model.capability, value: model.script || "" })}>
                                            {t(model.script ? "config.channelEditor.scriptReady" : "config.channelEditor.script")}
                                        </Button>
                                        <Button size="small" danger type="text" icon={<Trash2 className="size-3.5" />} onClick={() => removeModel(model.name)} />
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="px-2 py-8 text-center text-sm text-stone-500">{t("config.channelEditor.empty")}</div>
                )}
            </div>

            <ModelSelectModal open={selectOpen} channel={draft} selectedNames={draft.models.map((model) => model.name)} onConfirm={applySelection} onClose={() => setSelectOpen(false)} />

            <ModelScriptEditor
                open={Boolean(scriptTarget)}
                capability={scriptTarget?.capability || "text"}
                modelName={scriptTarget?.name || ""}
                value={scriptTarget?.value || ""}
                onSave={(script) => scriptTarget && setScript(scriptTarget.name, script)}
                onClose={() => setScriptTarget(null)}
            />
        </Drawer>
    );
}
