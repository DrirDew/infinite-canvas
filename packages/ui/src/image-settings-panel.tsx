import { useState } from "react";
import { Switch } from "antd";

import { DimensionInput, OptionPill, SettingGroup, SettingsTheme } from "./settings-controls.js";
import type { ComponentTheme, ImageSettingsConfig } from "./types.js";

const qualityOptions = ["auto", "high", "medium", "low"] as const;
const aspectOptions = [
    { value: "1:1", label: "1:1", width: 1024, height: 1024 },
    { value: "3:2", label: "3:2", width: 1536, height: 1024 },
    { value: "2:3", label: "2:3", width: 1024, height: 1536 },
    { value: "4:3", label: "4:3", width: 1360, height: 1024 },
    { value: "3:4", label: "3:4", width: 1024, height: 1360 },
    { value: "16:9", label: "16:9", width: 1824, height: 1024 },
    { value: "9:16", label: "9:16", width: 1024, height: 1824 },
    { value: "1:1-2k", label: "1:1(2k)", size: "2048x2048", width: 2048, height: 2048 },
    { value: "16:9-2k", label: "16:9(2k)", size: "2048x1152", width: 2048, height: 1152 },
    { value: "9:16-2k", label: "9:16(2k)", size: "1152x2048", width: 1152, height: 2048 },
    { value: "16:9-4k", label: "16:9(4k)", size: "3840x2160", width: 3840, height: 2160 },
    { value: "9:16-4k", label: "9:16(4k)", size: "2160x3840", width: 2160, height: 3840 },
    { value: "auto", label: "auto", width: 0, height: 0 },
] as const;

export const imageQualityOptions = qualityOptions.map((value) => ({ value, label: { auto: "自动", high: "高", medium: "中", low: "低" }[value] }));
export const imageAspectOptions = aspectOptions.map((item) => ({ value: "size" in item ? item.size : item.value, label: item.label }));

export type ImageSettingsLabels = {
    title: string;
    quality: string;
    size: string;
    align16: string;
    align16Hint: string;
    aspectRatio: string;
    transparent: string;
    transparentHint: string;
    count: string;
    imageCount: (count: number) => string;
};

const defaultLabels: ImageSettingsLabels = { title: "图片选项", quality: "质量", size: "尺寸", align16: "16 对齐", align16Hint: "宽高自动向上对齐到 16 的倍数", aspectRatio: "比例", transparent: "透明背景", transparentHint: "仅支持透明背景的模型会生效", count: "生成数量", imageCount: (count) => `${count} 张` };

export type ImageSettingsPanelProps = {
    config: ImageSettingsConfig;
    onConfigChange: (key: "quality" | "size" | "count" | "background", value: string) => void;
    theme: ComponentTheme;
    labels?: Partial<ImageSettingsLabels>;
    showTitle?: boolean;
    className?: string;
    maxCount?: number;
    quickCount?: number;
};

export function ImageSettingsPanel({ config, onConfigChange, theme, labels, showTitle = true, className = "w-[320px] space-y-4 rounded-2xl px-1 py-0.5", maxCount = 15, quickCount = 10 }: ImageSettingsPanelProps) {
    const text = { ...defaultLabels, ...labels };
    const [snapDimensionToStep, setSnapDimensionToStep] = useState(true);
    const quality = config.quality || "auto";
    const count = Math.max(1, Math.min(maxCount, Math.floor(Math.abs(Number(config.count)) || 1)));
    const activeSize = config.size || "auto";
    const selectedAspect = aspectOptions.find((item) => ("size" in item ? item.size : item.value) === activeSize || item.value === activeSize);
    const dimensions = readSizeDimensions(activeSize, selectedAspect || aspectOptions[0]);
    const updateDimension = (key: "width" | "height", value: number | null) => {
        const next = Math.max(1, Math.floor(value || dimensions[key] || 1024));
        const width = key === "width" ? next : dimensions.width;
        const height = key === "height" ? next : dimensions.height;
        onConfigChange("size", `${alignDimension(width, snapDimensionToStep)}x${alignDimension(height, snapDimensionToStep)}`);
    };

    return (
        <SettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-lg font-semibold">{text.title}</div> : null}
                <SettingGroup title={text.quality} color={theme.node.muted}><div className="grid grid-cols-4 gap-2.5">{imageQualityOptions.map((item) => <OptionPill key={item.value} selected={quality === item.value} theme={theme} onClick={() => onConfigChange("quality", item.value)}>{item.label}</OptionPill>)}</div></SettingGroup>
                <SettingGroup title={text.size} color={theme.node.muted}>
                    <div className="flex items-center justify-end gap-2"><span className="text-xs font-medium" style={{ color: theme.node.muted }}>{text.align16}</span><span title={text.align16Hint} onMouseDown={(event) => event.stopPropagation()}><Switch size="small" checked={snapDimensionToStep} onChange={setSnapDimensionToStep} /></span></div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5"><DimensionInput prefix="W" value={dimensions.width} disabled={activeSize === "auto"} theme={theme} onChange={(value) => updateDimension("width", value)} /><span className="text-lg opacity-45">↔</span><DimensionInput prefix="H" value={dimensions.height} disabled={activeSize === "auto"} theme={theme} onChange={(value) => updateDimension("height", value)} /></div>
                </SettingGroup>
                <SettingGroup title={text.aspectRatio} color={theme.node.muted}><div className="grid grid-cols-4 gap-2.5">{aspectOptions.map((item) => <button key={item.value} type="button" className="flex h-[72px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border bg-transparent text-sm transition hover:opacity-80" style={{ borderColor: selectedAspect?.value === item.value ? theme.node.text : theme.node.stroke, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onClick={() => onConfigChange("size", "size" in item ? item.size : item.value)}><AspectIcon width={item.width} height={item.height} color={theme.node.text} /><span>{item.label}</span></button>)}</div></SettingGroup>
                <div className="flex items-center justify-between gap-3"><div className="space-y-0.5"><div className="text-xs font-medium" style={{ color: theme.node.muted }}>{text.transparent}</div><div className="text-xs opacity-75" style={{ color: theme.node.muted }}>{text.transparentHint}</div></div><span onMouseDown={(event) => event.stopPropagation()}><Switch size="small" checked={config.background === "transparent"} onChange={(checked) => onConfigChange("background", checked ? "transparent" : "")} /></span></div>
                <SettingGroup title={text.count} color={theme.node.muted}><div className="grid grid-cols-4 gap-2.5">{Array.from({ length: quickCount }, (_, index) => index + 1).map((value) => <OptionPill key={value} selected={count === value} theme={theme} onClick={() => onConfigChange("count", String(value))}>{text.imageCount(value)}</OptionPill>)}<input type="number" min={1} max={maxCount} className="col-span-2 h-9 rounded-full border bg-transparent px-3 text-center text-sm outline-none" style={{ borderColor: theme.node.stroke, color: theme.node.text }} value={count} onChange={(event) => onConfigChange("count", String(Number(event.target.value) || 1))} onMouseDown={(event) => event.stopPropagation()} /></div></SettingGroup>
            </div>
        </SettingsTheme>
    );
}

export function imageQualityLabel(value: string) {
    return imageQualityOptions.find((item) => item.value === value)?.label || value;
}

export function imageSizeLabel(value: string) {
    return imageAspectOptions.find((item) => item.value === value)?.label || value;
}

function AspectIcon({ width, height, color }: { width: number; height: number; color: string }) {
    if (!width || !height) return null;
    const ratio = width / height;
    return <span className="grid h-7 w-9 place-items-center"><span className="border-2" style={{ width: ratio >= 1 ? 24 : Math.max(10, 24 * ratio), height: ratio >= 1 ? Math.max(10, 24 / ratio) : 24, borderColor: color }} /></span>;
}

function readSizeDimensions(size: string, fallback: { width: number; height: number }) {
    const match = size.match(/^(\d+)x(\d+)$/);
    return { width: match ? Number(match[1]) : fallback.width, height: match ? Number(match[2]) : fallback.height };
}

function alignDimension(value: number, enabled: boolean) {
    return enabled ? Math.ceil(value / 16) * 16 : value;
}
