import { blobToDataUrl, isRemoteMediaUrl } from "@/lib/image-utils";
import { getMediaBlob } from "@/services/file-storage";
import { imageToDataUrl } from "@/services/image-storage";
import type { GenerationWriteInput } from "@/services/api/generations";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

export { isRemoteMediaUrl };

export async function persistableImageRefs(references: ReferenceImage[]): Promise<NonNullable<GenerationWriteInput["references"]>> {
    return Promise.all(
        references.map(async (image) => ({
            id: image.id,
            name: image.name,
            type: image.type,
            dataUrl: await imageToDataUrl(image),
        })),
    );
}

export async function persistableVideoRefs(items: ReferenceVideo[]): Promise<NonNullable<GenerationWriteInput["videoReferences"]>> {
    return Promise.all(
        items.map(async (video) => {
            if (isRemoteMediaUrl(video.url)) {
                return { id: video.id, name: video.name, type: video.type, url: video.url, width: video.width, height: video.height, durationMs: video.durationMs, bytes: video.bytes };
            }
            const blob = video.storageKey ? await getMediaBlob(video.storageKey) : video.url ? await (await fetch(video.url)).blob() : null;
            return {
                id: video.id,
                name: video.name,
                type: video.type,
                dataUrl: blob ? await blobToDataUrl(blob) : "",
                width: video.width,
                height: video.height,
                durationMs: video.durationMs,
                bytes: video.bytes,
            };
        }),
    );
}

export async function persistableAudioRefs(items: ReferenceAudio[]): Promise<NonNullable<GenerationWriteInput["audioReferences"]>> {
    return Promise.all(
        items.map(async (audio) => {
            if (isRemoteMediaUrl(audio.url)) {
                return { id: audio.id, name: audio.name, type: audio.type, url: audio.url, durationMs: audio.durationMs };
            }
            const blob = audio.storageKey ? await getMediaBlob(audio.storageKey) : audio.url ? await (await fetch(audio.url)).blob() : null;
            return { id: audio.id, name: audio.name, type: audio.type, dataUrl: blob ? await blobToDataUrl(blob) : "", durationMs: audio.durationMs };
        }),
    );
}

export function persistableResultUrls(urls: string[]) {
    return urls.filter(isRemoteMediaUrl);
}
