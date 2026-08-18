import { InputNumber } from "antd";
import type { ReactNode } from "react";

export function QuotaPair({
    imageLabel,
    videoLabel,
    imageValue,
    videoValue,
    editing = false,
    onImageChange,
    onVideoChange,
}: {
    imageLabel: string;
    videoLabel: string;
    imageValue: number;
    videoValue: number;
    editing?: boolean;
    onImageChange?: (value: number) => void;
    onVideoChange?: (value: number) => void;
}) {
    return (
        <div className={`grid items-center gap-x-1.5 whitespace-nowrap text-xs text-stone-500 ${editing ? "grid-cols-[max-content_5.5rem_max-content_max-content_5.5rem]" : "grid-cols-[max-content_5ch_max-content_max-content_5ch]"}`}>
            <span>{imageLabel}</span>
            <QuotaSlot editing={editing} value={imageValue} onChange={onImageChange} />
            <span>·</span>
            <span>{videoLabel}</span>
            <QuotaSlot editing={editing} value={videoValue} onChange={onVideoChange} />
        </div>
    );
}

function QuotaSlot({ editing, value, onChange }: { editing: boolean; value: number; onChange?: (value: number) => void }) {
    let content: ReactNode = value;
    if (editing) {
        content = (
            <InputNumber
                min={0}
                precision={0}
                size="small"
                className="w-full"
                value={value}
                onChange={(next) => onChange?.(Math.max(0, Math.floor(Number(next) || 0)))}
            />
        );
    }
    return <span className="w-full text-right font-semibold tabular-nums text-stone-950 dark:text-stone-100">{content}</span>;
}
