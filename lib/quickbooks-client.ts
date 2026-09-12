export interface QBOConfig {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
  redirectUri: string;
}

export interface QBOTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  token_type?: string;
  realmId: string;
  created_at?: number;
}

export const QBO_CONFIG = {
  getAuthUrl: (clientId: string, redirectUri: string, state = "qbo_auth_state") => {
    const scopes = "com.intuit.quickbooks.accounting openid email profile";
    const url = new URL("https://appcenter.intuit.com/connect/oauth2");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  },

  getApiBaseUrl: (environment: "sandbox" | "production" = "production") => {
    return environment === "sandbox"
      ? "https://sandbox-quickbooks.api.intuit.com/v3/company"
      : "https://quickbooks.api.intuit.com/v3/company";
  },
};

export async function exchangeCodeForTokens(
  code: string,
  realmId: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<QBOTokens> {
  const cleanClientId = clientId.trim();
  const cleanClientSecret = clientSecret.trim();
  const basicAuth = Buffer.from(`${cleanClientId}:${cleanClientSecret}`).toString("base64");
  const cleanRedirectUri = redirectUri.trim().replace(/\/$/, "");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code.trim(),
    redirect_uri: cleanRedirectUri,
  });

  const res = await fetch("https://oauth.platform.intuit.com/oauth/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const responseText = await res.text();

  if (!res.ok) {
    let parsedError = responseText;
    try {
      const errorJson = JSON.parse(responseText);
      parsedError = errorJson.error_description || errorJson.error || responseText;
    } catch (_) {}
    throw new Error(`Intuit Token Exchange Error (${res.status}): ${parsedError}`);
  }

  const data = JSON.parse(responseText);
  return {
    ...data,
    realmId,
    created_at: Date.now(),
  };
}

export async function refreshQBOToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<QBOTokens> {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://oauth.platform.intuit.com/oauth/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to refresh QuickBooks token (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    ...data,
    created_at: Date.now(),
  };
}

export async function qboApiRequest<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST";
    body?: any;
    realmId: string;
    accessToken: string;
    environment?: "sandbox" | "production";
  }
): Promise<T> {
  const { method = "GET", body, realmId, accessToken, environment = "production" } = options;
  const baseUrl = QBO_CONFIG.getApiBaseUrl(environment);
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}/${realmId}${cleanEndpoint}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  if (body && method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body && method === "POST" ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QuickBooks API HTTP error (${response.status}): ${errorText}`);
  }

  return response.json();
}
