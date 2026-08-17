import { DimensionInput, OptionPill, SettingGroup, SettingsTheme, SizePreview, SwitchRow, boolValue } from "./settings-controls.js";
import type { ComponentTheme, VideoSettingsConfig } from "./types.js";

const resolutionOptions = ["720", "480"] as const;
const sizeOptions = [
    { value: "1280x720", label: "横屏", width: 1280, height: 720 },
    { value: "720x1280", label: "竖屏", width: 720, height: 1280 },
    { value: "1024x1024", label: "方形", width: 1024, height: 1024 },
    { value: "1792x1024", label: "宽屏", width: 1792, height: 1024 },
    { value: "1024x1792", label: "长图", width: 1024, height: 1792 },
    { value: "auto", label: "自动", width: 0, height: 0 },
] as const;
const secondOptions = [6, 10, 12, 16, 20] as const;
const seedanceResolutionOptions = ["480p", "720p", "1080p"] as const;
const seedanceRatioOptions = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"] as const;
const seedanceDurationOptions = [-1, 4, 5, 6, 8, 10, 12, 15] as const;
const seedanceRatioLabels: Record<string, string> = { "16:9": "横屏", "9:16": "竖屏", "1:1": "方形", "4:3": "标准横屏", "3:4": "标准竖屏", "21:9": "电影宽屏", adaptive: "自适应" };
const seedancePixels = {
    "480p": { "16:9": "864x496", "4:3": "752x560", "1:1": "640x640", "3:4": "560x752", "9:16": "496x864", "21:9": "992x432" },
    "720p": { "16:9": "1280x720", "4:3": "1112x834", "1:1": "960x960", "3:4": "834x1112", "9:16": "720x1280", "21:9": "1470x630" },
    "1080p": { "16:9": "1920x1080", "4:3": "1664x1248", "1:1": "1440x1440", "3:4": "1248x1664", "9:16": "1080x1920", "21:9": "2206x946" },
} as const;

export const videoResolutionOptions = resolutionOptions.map((value) => ({ value, label: `${value}p` }));
export const videoSizeOptions = sizeOptions.map(({ value, label }) => ({ value, label }));
export const videoSecondOptions = secondOptions.map(String);

export type VideoSettingsLabels = {
    title: string;
    quality: string;
    size: string;
    duration: string;
    output: string;
    generateAudio: string;
    watermark: string;
    smart: string;
    adaptive: string;
};

const defaultLabels: VideoSettingsLabels = { title: "视频选项", quality: "清晰度", size: "尺寸", duration: "时长", output: "输出", generateAudio: "生成声音", watermark: "添加水印", smart: "智能", adaptive: "自动匹配" };

export type VideoSettingsPanelProps = {
    config: VideoSettingsConfig;
    onConfigChange: (key: "vquality" | "size" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark", value: string) => void;
    theme: ComponentTheme;
    labels?: Partial<VideoSettingsLabels>;
    showTitle?: boolean;
    className?: string;
    seedance?: boolean;
};

export function VideoSettingsPanel({ config, onConfigChange, theme, labels, showTitle = true, className = "w-[320px] space-y-4 rounded-2xl px-1 py-0.5", seedance = config.apiFormat === "ark" }: VideoSettingsPanelProps) {
    const text = { ...defaultLabels, ...labels };
    if (seedance) return <SeedanceVideoSettingsPanel config={config} onConfigChange={onConfigChange} theme={theme} labels={text} showTitle={showTitle} className={className} />;
    const seconds = config.videoSeconds || "6";
    const size = normalizeVideoSizeValue(config.size || "auto");
    const dimensions = readSizeDimensions(size);
    const resolution = normalizeVideoResolutionValue(config.vquality || "720");
    const updateDimension = (key: "width" | "height", value: number | null) => {
        const next = Math.max(1, Math.floor(value || dimensions[key] || 720));
        onConfigChange("size", `${key === "width" ? next : dimensions.width}x${key === "height" ? next : dimensions.height}`);
    };

    return (
        <SettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-lg font-semibold">{text.title}</div> : null}
                <SettingGroup title={text.quality} color={theme.node.muted}><div className="grid grid-cols-3 gap-2.5">{videoResolutionOptions.map((item) => <OptionPill key={item.value} selected={resolution === item.value} theme={theme} onClick={() => onConfigChange("vquality", item.value)}>{item.label}</OptionPill>)}<NumberInput value={resolution} suffix="p" theme={theme} onChange={(value) => onConfigChange("vquality", value)} /></div></SettingGroup>
                <SettingGroup title={text.size} color={theme.node.muted}>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5"><DimensionInput prefix="W" value={dimensions.width} disabled={size === "auto"} theme={theme} onChange={(value) => updateDimension("width", value)} /><span className="text-lg opacity-45">↔</span><DimensionInput prefix="H" value={dimensions.height} disabled={size === "auto"} theme={theme} onChange={(value) => updateDimension("height", value)} /></div>
                    <div className="grid grid-cols-3 gap-2.5">{sizeOptions.map((item) => <button key={item.value} type="button" className="flex h-[78px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border bg-transparent text-sm transition hover:opacity-80" style={{ borderColor: size === item.value ? theme.node.text : theme.node.stroke, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onClick={() => onConfigChange("size", item.value)}><SizePreview width={item.width} height={item.height} color={theme.node.text} /><span>{item.label}</span></button>)}</div>
                </SettingGroup>
                <SettingGroup title={text.duration} color={theme.node.muted}><div className="grid grid-cols-3 gap-2.5">{secondOptions.map((value) => <OptionPill key={value} selected={seconds === String(value)} theme={theme} onClick={() => onConfigChange("videoSeconds", String(value))}>{value}s</OptionPill>)}<NumberInput value={seconds} suffix="s" theme={theme} onChange={(value) => onConfigChange("videoSeconds", value)} /></div></SettingGroup>
                <SettingGroup title={text.output} color={theme.node.muted}><div className="grid gap-2 rounded-xl border p-2.5" style={{ borderColor: theme.node.stroke }}><SwitchRow label={text.generateAudio} checked={boolValue(config.videoGenerateAudio, true)} theme={theme} onChange={(checked) => onConfigChange("videoGenerateAudio", String(checked))} /><SwitchRow label={text.watermark} checked={boolValue(config.videoWatermark, false)} theme={theme} onChange={(checked) => onConfigChange("videoWatermark", String(checked))} /></div></SettingGroup>
            </div>
        </SettingsTheme>
    );
}

function SeedanceVideoSettingsPanel({ config, onConfigChange, theme, labels, showTitle, className }: { config: VideoSettingsConfig; onConfigChange: VideoSettingsPanelProps["onConfigChange"]; theme: ComponentTheme; labels: VideoSettingsLabels; showTitle: boolean; className: string }) {
    const resolution = normalizeSeedanceResolution(config.vquality || "720p");
    const ratio = normalizeSeedanceRatio(config.size || "adaptive");
    const duration = normalizeSeedanceDuration(config.videoSeconds || "5");
    return (
        <SettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-lg font-semibold">{labels.title}</div> : null}
                <SettingGroup title={labels.quality} color={theme.node.muted}><div className="grid grid-cols-3 gap-2.5">{seedanceResolutionOptions.map((value) => <OptionPill key={value} selected={resolution === value} disabled={value === "1080p" && /fast/i.test(config.model || "")} theme={theme} onClick={() => onConfigChange("vquality", value)}>{value}</OptionPill>)}</div></SettingGroup>
                <SettingGroup title={labels.size} color={theme.node.muted}><div className="grid grid-cols-3 gap-2.5">{seedanceRatioOptions.map((value) => { const preview = ratioPreview(value); return <button key={value} type="button" className="flex h-[78px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border bg-transparent text-sm transition hover:opacity-80" style={{ borderColor: ratio === value ? theme.node.text : theme.node.stroke, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onClick={() => onConfigChange("size", value)}><SizePreview width={preview.width} height={preview.height} color={theme.node.text} /><span>{seedanceRatioLabels[value]}</span><span className="text-[10px] leading-none opacity-55">{value === "adaptive" ? labels.adaptive : seedancePixelLabel(resolution, value)}</span></button>; })}</div></SettingGroup>
                <SettingGroup title={labels.duration} color={theme.node.muted}><div className="grid grid-cols-4 gap-2.5">{seedanceDurationOptions.map((value) => <OptionPill key={value} selected={duration === value} theme={theme} onClick={() => onConfigChange("videoSeconds", String(value))}>{value === -1 ? labels.smart : `${value}s`}</OptionPill>)}</div><NumberInput value={String(duration)} min={-1} theme={theme} onChange={(value) => onConfigChange("videoSeconds", value)} /></SettingGroup>
                <SettingGroup title={labels.output} color={theme.node.muted}><div className="grid gap-2 rounded-xl border p-2.5" style={{ borderColor: theme.node.stroke }}><SwitchRow label={labels.generateAudio} checked={boolValue(config.videoGenerateAudio, true)} theme={theme} onChange={(checked) => onConfigChange("videoGenerateAudio", String(checked))} /><SwitchRow label={labels.watermark} checked={boolValue(config.videoWatermark, false)} theme={theme} onChange={(checked) => onConfigChange("videoWatermark", String(checked))} /></div></SettingGroup>
            </div>
        </SettingsTheme>
    );
}

export function videoResolutionLabel(value: string) {
    return `${normalizeVideoResolutionValue(value)}p`;
}

export function videoSizeLabel(value: string) {
    if (value === "adaptive" || value === "auto") return "自适应";
    return seedanceRatioLabels[value] || sizeOptions.find((item) => item.value === normalizeVideoSizeValue(value))?.label || value;
}

export function videoSecondsLabel(value: string) {
    return value === "-1" ? "智能" : `${value || "6"}s`;
}

export function normalizeVideoSizeValue(value: string) {
    if (value === "auto") return "auto";
    if (/^\d+x\d+$/.test(value)) return value;
    return ["9:16", "2:3", "3:4"].includes(value) ? "720x1280" : "1280x720";
}

export function normalizeVideoResolutionValue(value: string) {
    if (value === "480p" || value === "low") return "480";
    if (["720p", "auto", "high", "medium"].includes(value)) return "720";
    return value.replace(/p$/i, "") || "720";
}

function normalizeSeedanceResolution(value: string) {
    const normalized = value === "low" ? "480p" : ["auto", "high", "medium"].includes(value) ? "720p" : `${value.replace(/p$/i, "") || "720"}p`;
    return seedanceResolutionOptions.includes(normalized as (typeof seedanceResolutionOptions)[number]) ? normalized as (typeof seedanceResolutionOptions)[number] : "720p";
}

function normalizeSeedanceDuration(value: string) {
    if (value === "-1") return -1;
    return Math.max(4, Math.min(15, Math.floor(Number(value) || 5)));
}

function normalizeSeedanceRatio(value: string) {
    if (!value || value === "auto" || value === "adaptive") return "adaptive";
    if (seedanceRatioOptions.includes(value as (typeof seedanceRatioOptions)[number])) return value;
    const match = value.match(/^(\d+)x(\d+)$/);
    if (!match) return "adaptive";
    const ratio = Number(match[1]) / Number(match[2]);
    return [["16:9", 16 / 9], ["4:3", 4 / 3], ["1:1", 1], ["3:4", 3 / 4], ["9:16", 9 / 16], ["21:9", 21 / 9]].reduce((best, item) => Math.abs(Number(item[1]) - ratio) < Math.abs(Number(best[1]) - ratio) ? item : best)[0] as string;
}

function seedancePixelLabel(resolution: string, ratio: string) {
    if (ratio === "adaptive") return "自动匹配";
    return seedancePixels[normalizeSeedanceResolution(resolution)][ratio as keyof (typeof seedancePixels)["720p"]] || "";
}

function NumberInput({ value, suffix, min = 1, theme, onChange }: { value: string; suffix?: string; min?: number; theme: ComponentTheme; onChange: (value: string) => void }) {
    return <label className="flex h-9 overflow-hidden rounded-full border text-sm" style={{ borderColor: theme.node.stroke, color: theme.node.text }}><input type="number" min={min} className="min-w-0 flex-1 bg-transparent px-3 text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value={value} onChange={(event) => onChange(event.target.value)} onMouseDown={(event) => event.stopPropagation()} />{suffix ? <span className="grid w-7 place-items-center pr-1" style={{ color: theme.node.muted }}>{suffix}</span> : null}</label>;
}

function readSizeDimensions(size: string) {
    if (size === "auto") return { width: 0, height: 0 };
    const match = size.match(/^(\d+)x(\d+)$/);
    return { width: Number(match?.[1]) || 1280, height: Number(match?.[2]) || 720 };
}

function ratioPreview(ratio: string) {
    if (ratio === "9:16") return { width: 9, height: 16 };
    if (ratio === "1:1") return { width: 1, height: 1 };
    if (ratio === "4:3") return { width: 4, height: 3 };
    if (ratio === "3:4") return { width: 3, height: 4 };
    if (ratio === "21:9") return { width: 21, height: 9 };
    if (ratio === "adaptive") return { width: 0, height: 0 };
    return { width: 16, height: 9 };
}
