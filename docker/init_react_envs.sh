#!/bin/bash
set -e

if [[ -z "${AUTH_AUTHORITY}" ]]; then
    if [[ -z "${AUTH0_DOMAIN}" ]]; then
        echo "AUTH_AUTHORITY or AUTH0_DOMAIN environment variable must be set"
        exit 1
    fi
fi

if [[ -z "${AUTH_CLIENT_ID}" ]]; then
    if [[ -z "${AUTH0_CLIENT_ID}" ]]; then
        echo "AUTH_CLIENT_ID or AUTH0_CLIENT_ID environment variable must be set"
        exit 1
    fi
fi

if [[ -z "${AUTH_AUDIENCE}" ]]; then
    if [[ -z "${AUTH0_AUDIENCE}" ]]; then
        echo "AUTH_AUDIENCE or AUTH0_AUDIENCE environment variable must be set"
        exit 1
    fi
fi

if [[ "${AUTH_AUDIENCE}" == "none" ]]; then
    unset AUTH_AUDIENCE
fi

if [[ -z "${AUTH_SUPPORTED_SCOPES}" ]]; then
    if [[ -z "${AUTH0_DOMAIN}" ]]; then
        echo "AUTH_SUPPORTED_SCOPES environment variable must be set"
        exit 1
    fi
fi

if [[ -z "${USE_AUTH0}" ]]; then
    if [[ -z "${AUTH0_DOMAIN}" ]]; then
        echo "USE_AUTH0 environment variable must be set"
        exit 1
    fi
fi

if [[ -z "${NETBIRD_MGMT_API_ENDPOINT}" ]]; then
    echo "NETBIRD_MGMT_API_ENDPOINT environment variable must be set"
    exit 1
fi

export AUTH_AUTHORITY=${AUTH_AUTHORITY:-https://$AUTH0_DOMAIN}
export AUTH_CLIENT_ID=${AUTH_CLIENT_ID:-$AUTH0_CLIENT_ID}
export AUTH_CLIENT_SECRET=${AUTH_CLIENT_SECRET}
export AUTH_AUDIENCE=${AUTH_AUDIENCE:-$AUTH0_AUDIENCE}
export AUTH_REDIRECT_URI=${AUTH_REDIRECT_URI}
export AUTH_SILENT_REDIRECT_URI=${AUTH_SILENT_REDIRECT_URI}
export USE_AUTH0=${USE_AUTH0:-true}
export AUTH_SUPPORTED_SCOPES=${AUTH_SUPPORTED_SCOPES:-openid profile email api offline_access email_verified}

export NETBIRD_MGMT_API_ENDPOINT=$(echo $NETBIRD_MGMT_API_ENDPOINT | sed -E 's/(:80|:443)$//')
export NETBIRD_MGMT_GRPC_API_ENDPOINT=${NETBIRD_MGMT_GRPC_API_ENDPOINT}
export NETBIRD_HOTJAR_TRACK_ID=${NETBIRD_HOTJAR_TRACK_ID}
export NETBIRD_GOOGLE_ANALYTICS_ID=${NETBIRD_GOOGLE_ANALYTICS_ID}
export NETBIRD_GOOGLE_TAG_MANAGER_ID=${NETBIRD_GOOGLE_TAG_MANAGER_ID}
export NETBIRD_TOKEN_SOURCE=${NETBIRD_TOKEN_SOURCE:-accessToken}
export NETBIRD_DRAG_QUERY_PARAMS=${NETBIRD_DRAG_QUERY_PARAMS:-false}

echo "NetBird latest version: ${NETBIRD_LATEST_VERSION}"

# replace ENVs in the config
ENV_STR="\$\$USE_AUTH0 \$\$AUTH_AUDIENCE \$\$AUTH_AUTHORITY \$\$AUTH_CLIENT_ID \$\$AUTH_CLIENT_SECRET \$\$AUTH_SUPPORTED_SCOPES \$\$NETBIRD_MGMT_API_ENDPOINT \$\$NETBIRD_MGMT_GRPC_API_ENDPOINT \$\$NETBIRD_HOTJAR_TRACK_ID \$\$NETBIRD_GOOGLE_ANALYTICS_ID \$\$NETBIRD_GOOGLE_TAG_MANAGER_ID \$\$AUTH_REDIRECT_URI \$\$AUTH_SILENT_REDIRECT_URI \$\$NETBIRD_TOKEN_SOURCE \$\$NETBIRD_DRAG_QUERY_PARAMS"

OIDC_TRUSTED_DOMAINS="/usr/share/nginx/html/OidcTrustedDomains.js"
envsubst "$ENV_STR" < "$OIDC_TRUSTED_DOMAINS".tmpl > "$OIDC_TRUSTED_DOMAINS"
for f in $(grep -R -l AUTH_SUPPORTED_SCOPES /usr/share/nginx/html); do
    cp "$f" "$f".copy
    envsubst "$ENV_STR" < "$f".copy > "$f"
    rm "$f".copy
done