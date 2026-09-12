/**
 * Utility to make authenticated QuickBooks API requests with automatic token refresh
 */
export async function fetchWithQBORefresh(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const getRealmId = () => localStorage.getItem("qbo_realm_id") || "";
  const getAccessToken = () => localStorage.getItem("qbo_access_token") || "";
  const getRefreshToken = () => localStorage.getItem("qbo_refresh_token") || "";
  const getClientId = () => localStorage.getItem("qbo_client_id") || "";
  const getClientSecret = () => localStorage.getItem("qbo_client_secret") || "";
  const getEnvironment = () => localStorage.getItem("qbo_environment") || "production";

  const headers = new Headers(options.headers || {});
  headers.set("x-qbo-realm-id", getRealmId());
  headers.set("x-qbo-access-token", getAccessToken());
  headers.set("x-qbo-environment", getEnvironment());

  let response = await fetch(url, { ...options, headers });

  // If unauthorized (401), automatically attempt refresh token exchange
  const refreshToken = getRefreshToken();
  const clientId = getClientId();
  const clientSecret = getClientSecret();

  if (response.status === 401 && refreshToken && clientId && clientSecret) {
    try {
      const refreshRes = await fetch("/api/quickbooks/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refresh",
          refreshToken,
          clientId,
          clientSecret,
        }),
      });

      const refreshData = await refreshRes.json();
      if (refreshRes.ok && refreshData.success && refreshData.tokens?.access_token) {
        const newAccess = refreshData.tokens.access_token;
        const newRefresh = refreshData.tokens.refresh_token || refreshToken;

        localStorage.setItem("qbo_access_token", newAccess);
        localStorage.setItem("qbo_refresh_token", newRefresh);

        // Retry the original request with the freshly issued access token
        const retryHeaders = new Headers(options.headers || {});
        retryHeaders.set("x-qbo-realm-id", getRealmId());
        retryHeaders.set("x-qbo-access-token", newAccess);
        retryHeaders.set("x-qbo-environment", getEnvironment());

        response = await fetch(url, { ...options, headers: retryHeaders });
      }
    } catch (refreshErr) {
      console.error("Auto token refresh failed:", refreshErr);
    }
  }

  return response;
}
