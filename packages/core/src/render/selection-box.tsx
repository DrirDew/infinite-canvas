import type { CSSProperties, SVGAttributes } from "react";
import type { CanvasTheme } from "../theme.js";
import type { CanvasRect } from "../canvas/model.js";

/** Props for a scale-independent marquee selection rectangle. */
export type CanvasSelectionBoxProps = {
    rect: CanvasRect;
    scale: number;
    theme: CanvasTheme;
    className?: string;
    style?: CSSProperties;
    rectProps?: SVGAttributes<SVGRectElement>;
};

/** Renders a world-coordinate selection rectangle with screen-consistent stroke width. */
export function CanvasSelectionBox({ rect, scale, theme, className, style, rectProps }: CanvasSelectionBoxProps) {
    return (
        <svg data-canvas-selection className={className} style={{ position: "absolute", zIndex: 100, overflow: "visible", pointerEvents: "none", left: rect.x, top: rect.y, width: rect.width, height: rect.height, ...style }}>
            <rect width="100%" height="100%" fill={theme.canvas.selectionFill} stroke={theme.canvas.selectionStroke} strokeOpacity={0.55} strokeWidth={1 / scale} strokeDasharray={`${6 / scale} ${4 / scale}`} {...rectProps} />
        </svg>
    );
}
