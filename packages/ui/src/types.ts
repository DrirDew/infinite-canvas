export type ComponentTheme = {
    node: {
        text: string;
        muted: string;
        stroke: string;
        activeStroke: string;
        fill: string;
        panel: string;
    };
    toolbar: {
        panel: string;
    };
};

export type ImageSettingsConfig = {
    quality?: string;
    size?: string;
    count?: string;
    background?: string;
};

export type VideoSettingsConfig = {
    apiFormat?: string;
    model?: string;
    vquality?: string;
    size?: string;
    videoSeconds?: string;
    videoGenerateAudio?: string;
    videoWatermark?: string;
};
