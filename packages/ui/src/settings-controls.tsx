import type { ReactNode } from "react";
import { ConfigProvider, Switch } from "antd";

import type { ComponentTheme } from "./types.js";

export function SettingsTheme({ theme, children }: { theme: ComponentTheme; children: ReactNode }) {
    return (
        <ConfigProvider theme={{ token: { colorBgContainer: theme.toolbar.panel, colorBgElevated: theme.toolbar.panel, colorBorder: theme.node.stroke, colorPrimary: theme.node.activeStroke, colorText: theme.node.text, colorTextLightSolid: theme.node.panel }, components: { Button: { defaultBg: theme.toolbar.panel, defaultBorderColor: theme.node.stroke, defaultColor: theme.node.text } } }}>
            {children}
        </ConfigProvider>
    );
}

export function OptionPill({ selected, disabled = false, theme, onClick, children }: { selected: boolean; disabled?: boolean; theme: ComponentTheme; onClick: () => void; children: ReactNode }) {
    return <button type="button" disabled={disabled} className="h-9 cursor-pointer rounded-full border px-2 text-sm transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-35" style={{ background: "transparent", borderColor: selected ? theme.node.text : theme.node.stroke, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onClick={onClick}>{children}</button>;
}

export function SettingGroup({ title, color, children }: { title: string; color: string; children: ReactNode }) {
    return <div className="space-y-2.5"><div className="text-xs font-medium" style={{ color }}>{title}</div>{children}</div>;
}

export function DimensionInput({ prefix, value, disabled, theme, onChange }: { prefix: string; value: number; disabled: boolean; theme: ComponentTheme; onChange: (value: number | null) => void }) {
    return <label className="flex h-9 overflow-hidden rounded-xl text-sm" style={{ background: theme.node.fill, color: theme.node.text, opacity: disabled ? 0.55 : 1 }}><span className="grid w-9 place-items-center" style={{ color: theme.node.muted }}>{prefix}</span><input type="number" min={1} disabled={disabled} className="min-w-0 flex-1 bg-transparent px-2 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value={value || ""} onChange={(event) => onChange(Number(event.target.value) || null)} onMouseDown={(event) => event.stopPropagation()} /></label>;
}

export function SizePreview({ width, height, color }: { width: number; height: number; color: string }) {
    if (!width || !height) return null;
    const longSide = Math.max(width, height);
    return <span className="rounded-[3px] border-2" style={{ width: Math.max(10, Math.round((width / longSide) * 26)), height: Math.max(10, Math.round((height / longSide) * 26)), borderColor: color }} />;
}

export function SwitchRow({ label, checked, theme, onChange }: { label: string; checked: boolean; theme: ComponentTheme; onChange: (checked: boolean) => void }) {
    return <div className="flex h-8 items-center justify-between gap-3"><span className="text-sm" style={{ color: theme.node.text }}>{label}</span><span onMouseDown={(event) => event.stopPropagation()}><Switch size="small" checked={checked} onChange={onChange} /></span></div>;
}

export function boolValue(value: string | undefined, fallback: boolean) {
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
}
