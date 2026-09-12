/**
 * Utility to make authenticated QuickBooks API requests with automatic token refresh
 */
export async function fetchWithQBORefresh(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const realmId = localStorage.getItem("qbo_realm_id") || "";
  let accessToken = localStorage.getItem("qbo_access_token") || "";
  const refreshToken = localStorage.getItem("qbo_refresh_token") || "";
  const clientId = localStorage.getItem("qbo_client_id") || "";
  const clientSecret = localStorage.getItem("qbo_client_secret") || "";
  const environment = localStorage.getItem("qbo_environment") || "production";

  const headers = new Headers(options.headers || {});
  headers.set("x-qbo-realm-id", realmId);
  headers.set("x-qbo-access-token", accessToken);
  headers.set("x-qbo-environment", environment);

  let response = await fetch(url, { ...options, headers });

  // If 401 Unauthorized, automatically attempt refresh token exchange
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

        // Retry the original request with the fresh token
        headers.set("x-qbo-access-token", newAccess);
        response = await fetch(url, { ...options, headers });
      }
    } catch (refreshErr) {
      console.error("Auto token refresh failed:", refreshErr);
    }
  }

  return response;
}
