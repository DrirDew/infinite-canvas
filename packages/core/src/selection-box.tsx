import type { CSSProperties, SVGAttributes } from "react";
import type { CanvasTheme } from "./theme";
import type { CanvasRect } from "./types";

export type CanvasSelectionBoxProps = {
    rect: CanvasRect;
    scale: number;
    theme: CanvasTheme;
    className?: string;
    style?: CSSProperties;
    rectProps?: SVGAttributes<SVGRectElement>;
};

export function CanvasSelectionBox({ rect, scale, theme, className, style, rectProps }: CanvasSelectionBoxProps) {
    return (
        <svg className={className} style={{ position: "absolute", zIndex: 100, overflow: "visible", pointerEvents: "none", left: rect.x, top: rect.y, width: rect.width, height: rect.height, ...style }}>
            <rect width="100%" height="100%" fill={theme.canvas.selectionFill} stroke={theme.canvas.selectionStroke} strokeOpacity={0.55} strokeWidth={1 / scale} strokeDasharray={`${6 / scale} ${4 / scale}`} {...rectProps} />
        </svg>
    );
}
