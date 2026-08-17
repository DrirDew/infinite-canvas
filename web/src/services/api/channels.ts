import { appApi } from "@/services/api/app-http";
import { createModelChannel, type ModelChannel } from "@/stores/use-config-store";

type SharedChannelPayload = {
    id?: string;
    name?: string;
    apiFormat?: string;
    baseUrl?: string;
    models?: ModelChannel["models"];
    hasSecrets?: boolean;
    apiKey?: string;
    secretKey?: string;
    subAppId?: string;
};

function toSharedChannel(channel: SharedChannelPayload): ModelChannel {
    return createModelChannel({
        id: channel.id,
        name: channel.name,
        apiFormat: channel.apiFormat as ModelChannel["apiFormat"],
        baseUrl: channel.baseUrl,
        models: channel.models,
        hasSecrets: channel.hasSecrets,
        apiKey: channel.apiKey,
        secretKey: channel.secretKey,
        subAppId: channel.subAppId,
        shared: true,
    });
}

export async function fetchSharedChannels(): Promise<ModelChannel[]> {
    const response = await appApi.get<{ channels?: SharedChannelPayload[] }>("/api/channels");
    return (response.data.channels || []).map(toSharedChannel);
}

export async function createSharedChannel(channel: ModelChannel): Promise<ModelChannel> {
    const response = await appApi.post<SharedChannelPayload>("/api/channels", {
        name: channel.name,
        apiFormat: channel.apiFormat,
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
        secretKey: channel.secretKey,
        subAppId: channel.subAppId,
        models: channel.models,
    });
    return toSharedChannel(response.data);
}

export async function updateSharedChannel(channel: ModelChannel): Promise<ModelChannel> {
    const response = await appApi.patch<SharedChannelPayload>(`/api/channels/${channel.id}`, {
        name: channel.name,
        apiFormat: channel.apiFormat,
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
        secretKey: channel.secretKey,
        subAppId: channel.subAppId,
        models: channel.models,
    });
    return toSharedChannel(response.data);
}

export async function deleteSharedChannel(id: string) {
    await appApi.delete(`/api/channels/${id}`);
}
