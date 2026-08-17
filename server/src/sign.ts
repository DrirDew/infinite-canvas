import { createHash, createHmac } from "node:crypto";

const SIGNED_HEADERS = "content-type;host;x-tc-action";
const CONTENT_TYPE = "application/json; charset=utf-8";

function sha256Hex(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string) {
    return createHmac("sha256", key).update(value, "utf8").digest();
}

function utcDate(timestamp: number) {
    return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

export function signTencentCloudRequest(params: { secretId: string; secretKey: string; service: string; host: string; action: string; payload: string; timestamp?: number }) {
    const timestamp = params.timestamp ?? Math.floor(Date.now() / 1000);
    const date = utcDate(timestamp);
    const canonicalRequest = ["POST", "/", "", `content-type:${CONTENT_TYPE}`, `host:${params.host}`, `x-tc-action:${params.action.toLowerCase()}`, "", SIGNED_HEADERS, sha256Hex(params.payload)].join("\n");
    const credentialScope = `${date}/${params.service}/tc3_request`;
    const stringToSign = ["TC3-HMAC-SHA256", String(timestamp), credentialScope, sha256Hex(canonicalRequest)].join("\n");
    const secretDate = hmac(`TC3${params.secretKey}`, date);
    const secretService = hmac(secretDate, params.service);
    const secretSigning = hmac(secretService, "tc3_request");
    const signature = hmac(secretSigning, stringToSign).toString("hex");
    return {
        timestamp,
        contentType: CONTENT_TYPE,
        authorization: `TC3-HMAC-SHA256 Credential=${params.secretId}/${credentialScope}, SignedHeaders=${SIGNED_HEADERS}, Signature=${signature}`,
    };
}
