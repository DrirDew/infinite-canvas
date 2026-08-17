import { appApi } from "@/services/api/app-http";

export type GenerationAsset = {
    index: number;
    mime: string;
    url: string;
    width: number;
    height: number;
    bytes: number;
};

export type GenerationRecord = {
    id: string;
    prompt: string;
    model: string;
    size: string;
    quality: string;
    count: number;
    status: "success" | "failed";
    error?: string;
    durationMs: number;
    successCount: number;
    failCount: number;
    createdAt: number;
    assets: GenerationAsset[];
};

export async function fetchGenerations() {
    const response = await appApi.get<{ generations?: GenerationRecord[] }>("/api/generations");
    return response.data.generations || [];
}

export async function deleteGeneration(id: string) {
    await appApi.delete(`/api/generations/${id}`);
}
