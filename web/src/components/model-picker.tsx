import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Cpu } from "lucide-react";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { decodeChannelModel, encodeChannelModel, modelOptionLabel, modelOptionName, resolveModelChannel, selectableModelsByCapability, type AiConfig, type ModelCapability, type ModelChannel } from "@/stores/use-config-store";

type ModelPickerProps = {
    config: AiConfig;
    value?: string;
    onChange: (model: string) => void;
    capability?: ModelCapability;
    className?: string;
    fullWidth?: boolean;
    placeholder?: string;
    onMissingConfig?: () => void;
    split?: boolean;
};

export function ModelPicker({ config, value, onChange, capability, className, fullWidth = false, placeholder, onMissingConfig, split = false }: ModelPickerProps) {
    if (split) return <SplitModelPicker config={config} value={value} onChange={onChange} capability={capability} className={className} onMissingConfig={onMissingConfig} />;
    return <SingleModelPicker config={config} value={value} onChange={onChange} capability={capability} className={className} fullWidth={fullWidth} placeholder={placeholder} onMissingConfig={onMissingConfig} />;
}

function SingleModelPicker({ config, value, onChange, capability, className, fullWidth = false, placeholder, onMissingConfig }: ModelPickerProps) {
    const { t } = useTranslation();
    const pickerId = useId();
    const { open, onOpenChange } = usePickerOpen(pickerId);
    const options = useMemo(() => Array.from(new Set([...(config.channelMode === "local" && !capability ? [value] : []), ...selectableModelsByCapability(config, capability)].filter((model): model is string => Boolean(model)))), [capability, config, value]);
    const current = value || "";
    const pickerPlaceholder = placeholder || t("settingsPanels.model.select");

    return (
        <Select
            open={open}
            value={current}
            onOpenChange={(nextOpen) => {
                onOpenChange(nextOpen);
                if (nextOpen && !options.length && config.channelMode === "local") onMissingConfig?.();
            }}
            onValueChange={onChange}
        >
            <SelectTrigger className={pickerTriggerClass(fullWidth, className)} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} title={current ? modelOptionLabel(config, current) : pickerPlaceholder}>
                <ModelIcon model={current} />
                <span className="canvas-model-picker-text min-w-0 flex-1 truncate text-left">{current ? modelOptionLabel(config, current) : pickerPlaceholder}</span>
            </SelectTrigger>
            <PickerMenu>
                {options.length ? (
                    options.map((model) => (
                        <SelectItem key={model} value={model} textValue={modelOptionLabel(config, model)}>
                            <ModelLabel config={config} model={model} />
                        </SelectItem>
                    ))
                ) : (
                    <SelectItem value="__empty__" disabled>
                        {emptyModelLabel(config, capability)}
                    </SelectItem>
                )}
            </PickerMenu>
        </Select>
    );
}

function SplitModelPicker({ config, value, onChange, capability, className, onMissingConfig }: ModelPickerProps) {
    const { t } = useTranslation();
    const channelPickerId = useId();
    const modelPickerId = useId();
    const channelOpen = usePickerOpen(channelPickerId);
    const modelOpen = usePickerOpen(modelPickerId);
    const channels = useMemo(() => {
        const matched = channelsForCapability(config, capability);
        const id = decodeChannelModel(value || "")?.channelId;
        if (id && !matched.some((channel) => channel.id === id)) {
            const current = config.channels.find((channel) => channel.id === id);
            if (current) return [current, ...matched];
        }
        return matched;
    }, [capability, config, value]);
    const channelId = currentChannelId(config, value);
    const models = useMemo(() => modelsForChannel(config, channelId, capability), [capability, channelId, config]);
    const modelName = modelOptionName(value || "") || "";
    const channelName = channels.find((channel) => channel.id === channelId)?.name || "";

    const selectChannel = (nextChannelId: string) => {
        const nextModels = modelsForChannel(config, nextChannelId, capability);
        const nextName = nextModels.some((model) => model.name === modelName) ? modelName : nextModels[0]?.name;
        if (nextName) onChange(encodeChannelModel(nextChannelId, nextName));
    };

    return (
        <div className={cn("grid grid-cols-2 gap-3", className)}>
            <label className="block min-w-0">
                <span className="mb-1.5 block text-sm font-semibold sm:mb-2 sm:text-base">{t("workbench.channel")}</span>
                <Select
                    open={channelOpen.open}
                    value={channelId}
                    onOpenChange={(nextOpen) => {
                        channelOpen.onOpenChange(nextOpen);
                        if (nextOpen && !channels.length && config.channelMode === "local") onMissingConfig?.();
                    }}
                    onValueChange={selectChannel}
                >
                    <SelectTrigger className={pickerTriggerClass(true)} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} title={channelName || t("settingsPanels.model.selectChannel")}>
                        <ChannelIcon channel={channels.find((channel) => channel.id === channelId)} />
                        <span className="canvas-model-picker-text min-w-0 flex-1 truncate text-left">{channelName || t("settingsPanels.model.selectChannel")}</span>
                    </SelectTrigger>
                    <PickerMenu>
                        {channels.length ? (
                            channels.map((channel) => (
                                <SelectItem key={channel.id} value={channel.id} textValue={channel.name}>
                                    <span className="flex min-w-0 items-center gap-2">
                                        <ChannelIcon channel={channel} />
                                        <span className="truncate">{channel.name}</span>
                                    </span>
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem value="__empty__" disabled>
                                {t("settingsPanels.model.addFirst")}
                            </SelectItem>
                        )}
                    </PickerMenu>
                </Select>
            </label>
            <label className="block min-w-0">
                <span className="mb-1.5 block text-sm font-semibold sm:mb-2 sm:text-base">{t("workbench.model")}</span>
                <Select
                    open={modelOpen.open}
                    value={modelName}
                    onOpenChange={(nextOpen) => {
                        modelOpen.onOpenChange(nextOpen);
                        if (nextOpen && !models.length && config.channelMode === "local") onMissingConfig?.();
                    }}
                    onValueChange={(name) => channelId && onChange(encodeChannelModel(channelId, name))}
                >
                    <SelectTrigger className={pickerTriggerClass(true)} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} title={modelName || t("settingsPanels.model.select")}>
                        {modelName ? <ModelIcon model={modelName} /> : null}
                        <span className="canvas-model-picker-text min-w-0 flex-1 truncate text-left">{modelName || t("settingsPanels.model.select")}</span>
                    </SelectTrigger>
                    <PickerMenu>
                        {models.length ? (
                            models.map((model) => (
                                <SelectItem key={model.name} value={model.name} textValue={model.name}>
                                    <span className="flex min-w-0 items-center gap-2">
                                        <ModelIcon model={model.name} />
                                        <span className="truncate">{model.name}</span>
                                    </span>
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem value="__empty__" disabled>
                                {emptyModelLabel(config, capability)}
                            </SelectItem>
                        )}
                    </PickerMenu>
                </Select>
            </label>
        </div>
    );
}

function channelsForCapability(config: AiConfig, capability?: ModelCapability) {
    return config.channels.filter((channel) => channel.models.some((model) => !capability || model.capability === capability));
}

function modelsForChannel(config: AiConfig, channelId: string, capability?: ModelCapability) {
    const channel = config.channels.find((item) => item.id === channelId);
    return (channel?.models || []).filter((model) => !capability || model.capability === capability);
}

function currentChannelId(config: AiConfig, value: string | undefined) {
    const decoded = decodeChannelModel(value || "");
    if (decoded?.channelId && config.channels.some((channel) => channel.id === decoded.channelId)) return decoded.channelId;
    if (!value) return "";
    return resolveModelChannel(config, value).id;
}

function usePickerOpen(pickerId: string) {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const closeOtherPicker = (event: Event) => {
            if ((event as CustomEvent<string>).detail !== pickerId) setOpen(false);
        };
        window.addEventListener("model-picker-open", closeOtherPicker);
        return () => window.removeEventListener("model-picker-open", closeOtherPicker);
    }, [pickerId]);
    return {
        open,
        onOpenChange(nextOpen: boolean) {
            if (nextOpen) window.dispatchEvent(new CustomEvent("model-picker-open", { detail: pickerId }));
            setOpen(nextOpen);
        },
    };
}

function pickerTriggerClass(fullWidth?: boolean, className?: string) {
    return cn(
        "canvas-composer-model-picker h-8 w-fit max-w-full gap-2 rounded-full border border-input bg-transparent px-3 text-sm font-normal shadow-sm transition-colors",
        fullWidth ? "w-full min-w-0 justify-start" : "min-w-[9rem] justify-start",
        "data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring/20",
        className,
    );
}

function PickerMenu({ children }: { children: ReactNode }) {
    return (
        <SelectContent data-canvas-no-zoom className="z-[1200] w-80 max-w-[calc(100vw-24px)] rounded-xl border border-border/70 bg-popover p-1 shadow-xl" position="popper" align="start" side="bottom" sideOffset={6} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
            {children}
        </SelectContent>
    );
}

function emptyModelLabel(config: AiConfig, capability?: ModelCapability) {
    const label = capability ? i18n.t(`settingsPanels.model.capabilities.${capability}`) : "";
    if (capability && config.models.length) return i18n.t("settingsPanels.model.assign", { capability: label });
    return config.models.length ? i18n.t("settingsPanels.model.noMatch", { capability: label }) : i18n.t("settingsPanels.model.addFirst");
}

function ModelLabel({ config, model }: { config: AiConfig; model: string }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <ModelIcon model={model} />
            <span className="truncate">{modelOptionLabel(config, model)}</span>
        </span>
    );
}

function ChannelIcon({ channel }: { channel?: ModelChannel }) {
    const icon = channel ? resolveChannelIcon(channel) : "";
    return icon ? <img src={icon} alt="" className="size-4 shrink-0 dark:invert" /> : <Cpu className="size-4 shrink-0 opacity-70" />;
}

function resolveChannelIcon(channel: ModelChannel) {
    const fromName = resolveModelIcon(`${channel.name} ${channel.apiFormat} ${channel.models[0]?.name || ""}`);
    if (fromName) return fromName;
    if (channel.apiFormat === "gemini") return "/icons/gemini.svg";
    if (channel.apiFormat === "openai") return "/icons/openai.svg";
    return "";
}

function ModelIcon({ model }: { model: string }) {
    const icon = resolveModelIcon(modelOptionName(model));
    return icon ? <img src={icon} alt="" className="size-4 shrink-0 dark:invert" /> : <Cpu className="size-4 shrink-0 opacity-70" />;
}

function resolveModelIcon(model: string) {
    const name = model.toLowerCase();
    if (name.includes("claude") || name.includes("anthropic")) return "/icons/claude.svg";
    if (name.includes("gemini") || name.includes("google")) return "/icons/gemini.svg";
    if (name.includes("gpt") || name.includes("openai")) return "/icons/openai.svg";
    if (name.includes("grok") || name.includes("grok")) return "/icons/grok.svg";
    if (name.includes("deepseek") || name.includes("deepseek")) return "/icons/deepseek.svg";
    if (name.includes("glm") || name.includes("glm")) return "/icons/glm.svg";
    return "";
}
