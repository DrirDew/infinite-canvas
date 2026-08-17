const SIGNED_HEADERS = "content-type;host;x-tc-action";
const CONTENT_TYPE = "application/json; charset=utf-8";

function toHex(bytes: ArrayBuffer) {
    return Array.from(new Uint8Array(bytes))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function sha256Hex(value: string) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return toHex(digest);
}

async function hmac(key: BufferSource, value: string) {
    const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value));
}

function utcDate(timestamp: number) {
    return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

export async function signTencentCloudRequest(params: { secretId: string; secretKey: string; service: string; host: string; action: string; payload: string; timestamp?: number }) {
    const timestamp = params.timestamp ?? Math.floor(Date.now() / 1000);
    const date = utcDate(timestamp);
    const canonicalRequest = ["POST", "/", "", `content-type:${CONTENT_TYPE}`, `host:${params.host}`, `x-tc-action:${params.action.toLowerCase()}`, "", SIGNED_HEADERS, await sha256Hex(params.payload)].join("\n");
    const credentialScope = `${date}/${params.service}/tc3_request`;
    const stringToSign = ["TC3-HMAC-SHA256", String(timestamp), credentialScope, await sha256Hex(canonicalRequest)].join("\n");
    const secretDate = await hmac(new TextEncoder().encode(`TC3${params.secretKey}`), date);
    const secretService = await hmac(secretDate, params.service);
    const secretSigning = await hmac(secretService, "tc3_request");
    const signature = toHex(await hmac(secretSigning, stringToSign));
    return {
        timestamp,
        contentType: CONTENT_TYPE,
        authorization: `TC3-HMAC-SHA256 Credential=${params.secretId}/${credentialScope}, SignedHeaders=${SIGNED_HEADERS}, Signature=${signature}`,
    };
}
