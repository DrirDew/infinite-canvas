import type { CanvasTheme } from "./theme";
import type { CanvasRect } from "./types";

export function CanvasSelectionBox({ rect, scale, theme }: { rect: CanvasRect; scale: number; theme: CanvasTheme }) {
    return (
        <svg style={{ position: "absolute", zIndex: 100, overflow: "visible", pointerEvents: "none", left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
            <rect width="100%" height="100%" fill={theme.canvas.selectionFill} stroke={theme.canvas.selectionStroke} strokeOpacity={0.55} strokeWidth={1 / scale} strokeDasharray={`${6 / scale} ${4 / scale}`} />
        </svg>
    );
}
