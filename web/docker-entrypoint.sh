#!/bin/sh
set -e

# Executed automatically by the official nginx image entrypoint through /docker-entrypoint.d/*.sh before nginx starts.
# Generate runtime config.js from environment variables. Each analytics provider has an independent variable;
# unset providers remain disabled, load no scripts, and send no external requests. Multiple providers may be enabled together.
# When AUTH_PASSWORD is set, enable HTTP Basic Auth for the site. /tencent-vod stays unauthenticated because those requests use a TC3 Authorization header.

# GA4 and Baidu IDs contain only letters, numbers, and hyphens. Remove other characters
# so quotes and similar values cannot break the JavaScript strings in config.js as a defense-in-depth measure.
sanitize_id() {
    printf '%s' "$1" | tr -cd 'A-Za-z0-9-'
}

GA4_ID=$(sanitize_id "${ANALYTICS_GA4_ID:-}")
BAIDU_ID=$(sanitize_id "${ANALYTICS_BAIDU_ID:-}")

cat > /usr/share/nginx/html/config.js <<EOF
window.__RUNTIME_CONFIG__ = {
  ANALYTICS_GA4_ID: "${GA4_ID}",
  ANALYTICS_BAIDU_ID: "${BAIDU_ID}"
};
EOF

AUTH_INCLUDE=/etc/nginx/auth.inc
HTPASSWD=/etc/nginx/.htpasswd

if [ -n "${AUTH_PASSWORD:-}" ]; then
    AUTH_NAME=$(printf '%s' "${AUTH_USER:-admin}" | tr -cd 'A-Za-z0-9._-')
    [ -n "$AUTH_NAME" ] || AUTH_NAME=admin
    HASH=$(openssl passwd -apr1 "$AUTH_PASSWORD")
    printf '%s:%s\n' "$AUTH_NAME" "$HASH" > "$HTPASSWD"
    cat > "$AUTH_INCLUDE" <<EOF
auth_basic "Infinite Canvas";
auth_basic_user_file $HTPASSWD;
EOF
else
    printf 'auth_basic off;\n' > "$AUTH_INCLUDE"
    rm -f "$HTPASSWD"
fi
