import { appApi } from "@/services/api/app-http";

export type GenerationKind = "image" | "video";
export type GenerationStatus = "draft" | "running" | "success" | "failed";

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
    kind?: GenerationKind | string;
    prompt: string;
    model: string;
    size: string;
    quality: string;
    count: number;
    status: GenerationStatus;
    error?: string;
    durationMs: number;
    successCount: number;
    failCount: number;
    extra?: Record<string, unknown>;
    createdAt: number;
    updatedAt?: number;
    startedAt?: number;
    finishedAt?: number;
    assets: GenerationAsset[];
};

export type GenerationWriteInput = {
    kind?: GenerationKind;
    prompt?: string;
    model?: string;
    size?: string;
    quality?: string;
    count?: number;
    status?: GenerationStatus;
    error?: string;
    durationMs?: number;
    successCount?: number;
    failCount?: number;
    extra?: Record<string, unknown>;
    images?: Array<{ dataUrl: string }>;
    startedAt?: number;
    finishedAt?: number;
};

export async function fetchGenerations(kind?: GenerationKind) {
    const response = await appApi.get<{ generations?: GenerationRecord[] }>("/api/generations", { params: kind ? { kind } : undefined });
    return response.data.generations || [];
}

export async function createGeneration(input: GenerationWriteInput) {
    const response = await appApi.post<GenerationRecord>("/api/generations", input);
    return response.data;
}

export async function updateGeneration(id: string, input: GenerationWriteInput) {
    const response = await appApi.patch<GenerationRecord>(`/api/generations/${id}`, input);
    return response.data;
}

export async function deleteGeneration(id: string) {
    await appApi.delete(`/api/generations/${id}`);
}
