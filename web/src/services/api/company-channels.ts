import axios from "axios";

import i18n from "@/i18n";
import { COMPANY_TENCENT_VOD_CHANNEL_ID, createModelChannel, type ModelChannel } from "@/stores/use-config-store";

type CompanyChannelPayload = {
    id?: string;
    apiFormat?: string;
    models?: ModelChannel["models"];
};

export async function fetchCompanyChannels(): Promise<ModelChannel[]> {
    try {
        const response = await axios.get<{ channels?: CompanyChannelPayload[] }>("/api/company/channels");
        return (response.data.channels || [])
            .filter((channel) => channel.apiFormat === "tencent-vod")
            .map((channel) =>
                createModelChannel({
                    id: channel.id || COMPANY_TENCENT_VOD_CHANNEL_ID,
                    name: i18n.t("config.channels.companyTencentVod"),
                    apiFormat: "tencent-vod",
                    models: channel.models,
                    managed: true,
                }),
            );
    } catch {
        return [];
    }
}
