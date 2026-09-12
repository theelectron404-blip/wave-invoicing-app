"use client";

import { useState, useEffect } from "react";
import { Key, Building2, Check, AlertCircle, Loader2, ExternalLink, RefreshCw, Zap, ShieldCheck } from "lucide-react";
import { InvoicingProvider } from "@/lib/types";

export default function SettingsPage() {
  const [provider, setProvider] = useState<InvoicingProvider>("wave");

  // Wave State
  const [waveToken, setWaveToken] = useState("");
  const [isWaveSaved, setIsWaveSaved] = useState(false);
  const [testingWave, setTestingWave] = useState(false);
  const [waveTestResult, setWaveTestResult] = useState<{
    success: boolean;
    message: string;
    businesses?: any[];
  } | null>(null);

  // QuickBooks State
  const [qboClientId, setQboClientId] = useState("");
  const [qboClientSecret, setQboClientSecret] = useState("");
  const [qboEnvironment, setQboEnvironment] = useState<"sandbox" | "production">("production");
  const [qboRealmId, setQboRealmId] = useState("");
  const [qboAccessToken, setQboAccessToken] = useState("");
  const [qboRefreshToken, setQboRefreshToken] = useState("");
  const [isQboConnected, setIsQboConnected] = useState(false);

  const [testingQbo, setTestingQbo] = useState(false);
  const [qboTestResult, setQboTestResult] = useState<{
    success: boolean;
    message: string;
    business?: any;
  } | null>(null);

  // Load saved tokens & check OAuth redirect params on mount
  useEffect(() => {
    const savedProv = (localStorage.getItem("active_invoicing_provider") as InvoicingProvider) || "wave";
    setProvider(savedProv);

    // Wave
    const savedWave = localStorage.getItem("wave_custom_token");
    if (savedWave) {
      setWaveToken(savedWave);
      setIsWaveSaved(true);
    }

    // QuickBooks stored tokens
    const cId = localStorage.getItem("qbo_client_id") || "";
    const cSec = localStorage.getItem("qbo_client_secret") || "";
    const env = (localStorage.getItem("qbo_environment") as "sandbox" | "production") || "production";
    const rId = localStorage.getItem("qbo_realm_id") || "";
    const aToken = localStorage.getItem("qbo_access_token") || "";
    const rToken = localStorage.getItem("qbo_refresh_token") || "";

    setQboClientId(cId);
    setQboClientSecret(cSec);
    setQboEnvironment(env);
    setQboRealmId(rId);
    setQboAccessToken(aToken);
    setQboRefreshToken(rToken);
    if (aToken && rId) {
      setIsQboConnected(true);
    }

    // Process URL query parameters from OAuth Callback redirect
    const urlParams = new URLSearchParams(window.location.search);
    const qboConnectedParam = urlParams.get("qbo_connected");
    const qboPendingParam = urlParams.get("qbo_pending");
    const qboCodeParam = urlParams.get("qbo_code");
    const qboRealmIdParam = urlParams.get("qbo_realmid");
    const qboErrorParam = urlParams.get("qbo_error");

    // Client-side direct token exchange handler if server exchange didn't run
    if (qboPendingParam === "true" && qboCodeParam && qboRealmIdParam) {
      const storedCId = localStorage.getItem("qbo_client_id") || "";
      const storedCSec = localStorage.getItem("qbo_client_secret") || "";
      const storedEnv = (localStorage.getItem("qbo_environment") as "sandbox" | "production") || "production";

      if (storedCId && storedCSec) {
        setTestingQbo(true);
        const cleanOrigin = window.location.origin.replace(/\/$/, "");
        const redirectUri = `${cleanOrigin}/api/quickbooks/callback`;

        // Direct client-side exchange against Intuit to eliminate any middleware/proxy 404s
        const basicAuth = btoa(`${storedCId.trim()}:${storedCSec.trim()}`);
        const bodyParams = new URLSearchParams({
          grant_type: "authorization_code",
          code: qboCodeParam.trim(),
          redirect_uri: redirectUri,
        });

        fetch("https://oauth.platform.intuit.com/oauth/v1/tokens/bearer", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${basicAuth}`,
            Accept: "application/json",
          },
          body: bodyParams.toString(),
        })
          .then(async (res) => {
            const data = await res.json();
            if (res.ok && data.access_token) {
              localStorage.setItem("qbo_access_token", data.access_token);
              if (data.refresh_token) localStorage.setItem("qbo_refresh_token", data.refresh_token);
              localStorage.setItem("qbo_realm_id", qboRealmIdParam);
              localStorage.setItem("qbo_environment", storedEnv);

              setQboAccessToken(data.access_token);
              if (data.refresh_token) setQboRefreshToken(data.refresh_token);
              setQboRealmId(qboRealmIdParam);
              setQboEnvironment(storedEnv);
              setIsQboConnected(true);

              setQboTestResult({
                success: true,
                message: `QuickBooks connected successfully! Company Realm ID: ${qboRealmIdParam}`,
              });

              localStorage.setItem("active_invoicing_provider", "quickbooks");
              setProvider("quickbooks");
              window.dispatchEvent(new Event("providerChanged"));
              window.history.replaceState({}, document.title, window.location.pathname);
            } else {
              setQboTestResult({
                success: false,
                message:
                  data.error_description ||
                  data.error ||
                  `Failed to exchange token with Intuit (${res.status})`,
              });
            }
          })
          .catch((err) => {
            setQboTestResult({
              success: false,
              message: err.message || "Failed to exchange tokens with Intuit.",
            });
          })
          .finally(() => setTestingQbo(false));
      }
    } else if (qboConnectedParam === "true") {
      const newAToken = urlParams.get("qbo_access_token") || "";
      const newRToken = urlParams.get("qbo_refresh_token") || "";
      const newRealmId = urlParams.get("qbo_realm_id") || "";
      const newEnv = (urlParams.get("qbo_environment") as "sandbox" | "production") || "production";

      if (newAToken) localStorage.setItem("qbo_access_token", newAToken);
      if (newRToken) localStorage.setItem("qbo_refresh_token", newRToken);
      if (newRealmId) localStorage.setItem("qbo_realm_id", newRealmId);
      localStorage.setItem("qbo_environment", newEnv);

      setQboAccessToken(newAToken);
      setQboRefreshToken(newRToken);
      setQboRealmId(newRealmId);
      setQboEnvironment(newEnv);
      setIsQboConnected(true);

      setQboTestResult({
        success: true,
        message: `QuickBooks connected successfully! Company Realm ID: ${newRealmId}`,
      });

      // Switch active provider to quickbooks
      localStorage.setItem("active_invoicing_provider", "quickbooks");
      setProvider("quickbooks");
      window.dispatchEvent(new Event("providerChanged"));
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (qboErrorParam) {
      setQboTestResult({
        success: false,
        message: `QuickBooks OAuth Error: ${decodeURIComponent(qboErrorParam)}`,
      });
    }
  }, []);

  const handleSwitchProvider = (newProv: InvoicingProvider) => {
    setProvider(newProv);
    localStorage.setItem("active_invoicing_provider", newProv);
    window.dispatchEvent(new Event("providerChanged"));
  };

  // Wave Handlers
  const handleSaveWave = () => {
    if (waveToken.trim()) {
      localStorage.setItem("wave_custom_token", waveToken.trim());
      setIsWaveSaved(true);
    } else {
      localStorage.removeItem("wave_custom_token");
      setIsWaveSaved(false);
    }
  };

  const handleTestWave = async () => {
    setTestingWave(true);
    setWaveTestResult(null);

    try {
      const res = await fetch("/api/wave/business", {
        headers: waveToken.trim() ? { "x-wave-token": waveToken.trim() } : {},
      });
      const data = await res.json();

      if (data.success) {
        setWaveTestResult({
          success: true,
          message: `Connected successfully! Found ${data.businesses.length} Wave business(es).`,
          businesses: data.businesses,
        });
      } else {
        setWaveTestResult({
          success: false,
          message: data.error || "Failed to authenticate with Wave API.",
        });
      }
    } catch (err: any) {
      setWaveTestResult({
        success: false,
        message: err.message || "Network error occurred while testing Wave.",
      });
    } finally {
      setTestingWave(false);
    }
  };

  // QuickBooks Handlers
  const handleSaveQboCreds = () => {
    localStorage.setItem("qbo_client_id", qboClientId.trim());
    localStorage.setItem("qbo_client_secret", qboClientSecret.trim());
    localStorage.setItem("qbo_environment", qboEnvironment);
    alert("QuickBooks API credentials saved to local storage.");
  };

  const handleConnectQbo = () => {
    if (!qboClientId.trim() || !qboClientSecret.trim()) {
      alert("Please enter both QuickBooks Client ID and Client Secret before connecting.");
      return;
    }

    localStorage.setItem("qbo_client_id", qboClientId.trim());
    localStorage.setItem("qbo_client_secret", qboClientSecret.trim());
    localStorage.setItem("qbo_environment", qboEnvironment);

    const redirectUri = `${window.location.origin}/api/quickbooks/callback`;
    const stateObj = {
      clientId: qboClientId.trim(),
      clientSecret: qboClientSecret.trim(),
      environment: qboEnvironment,
    };
    const stateParam = `cfg_${encodeURIComponent(JSON.stringify(stateObj))}`;

    const scopes = "com.intuit.quickbooks.accounting openid email profile";
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${encodeURIComponent(
      qboClientId.trim()
    )}&response_type=code&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${encodeURIComponent(stateParam)}`;

    window.location.href = authUrl;
  };

  const handleTestQbo = async () => {
    setTestingQbo(true);
    setQboTestResult(null);

    try {
      const res = await fetch("/api/quickbooks/company", {
        headers: {
          "x-qbo-realm-id": qboRealmId || localStorage.getItem("qbo_realm_id") || "",
          "x-qbo-access-token": qboAccessToken || localStorage.getItem("qbo_access_token") || "",
          "x-qbo-environment": qboEnvironment,
        },
      });
      const data = await res.json();

      if (data.success) {
        setQboTestResult({
          success: true,
          message: `Connected successfully to ${data.business?.name}!`,
          business: data.business,
        });
      } else {
        setQboTestResult({
          success: false,
          message: data.error || "Failed to query QuickBooks API.",
        });
      }
    } catch (err: any) {
      setQboTestResult({
        success: false,
        message: err.message || "Network error testing QuickBooks connection.",
      });
    } finally {
      setTestingQbo(false);
    }
  };

  const handleDisconnectQbo = () => {
    localStorage.removeItem("qbo_access_token");
    localStorage.removeItem("qbo_refresh_token");
    localStorage.removeItem("qbo_realm_id");
    setQboAccessToken("");
    setQboRefreshToken("");
    setQboRealmId("");
    setIsQboConnected(false);
    setQboTestResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          API &amp; Account Integrations
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure API credentials and OAuth tokens for both <strong>Wave Apps</strong> and <strong>QuickBooks Online</strong>.
        </p>
      </div>

      {/* Active Invoicing Service Switcher Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Active Invoicing Engine
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Choose which service dispatches your single and bulk invoices.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleSwitchProvider("wave")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-2 border ${
              provider === "wave"
                ? "bg-blue-600 text-white border-blue-600 shadow-md"
                : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-300" />
            Wave Apps (GraphQL)
          </button>
          <button
            type="button"
            onClick={() => handleSwitchProvider("quickbooks")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-2 border ${
              provider === "quickbooks"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-300" />
            QuickBooks Online (REST)
          </button>
        </div>
      </div>

      {/* WAVE SETTINGS SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            1. Wave Apps Integration (Personal Access Token)
          </h2>
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2.5 py-0.5 rounded-full">
            GraphQL API
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Wave Bearer Full Access Token
            </label>
            <input
              type="password"
              value={waveToken}
              onChange={(e) => {
                setWaveToken(e.target.value);
                setIsWaveSaved(false);
              }}
              placeholder="Paste your Wave Full Access Bearer Token"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              Generated in{" "}
              <a
                href="https://developer.waveapps.com/"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                Wave Developer Portal &rarr; Manage Applications &rarr; Create Token
              </a>
              .
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSaveWave}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 transition"
            >
              <Check className="w-4 h-4" />
              {isWaveSaved ? "Saved in Browser" : "Save Wave Token"}
            </button>

            <button
              type="button"
              onClick={handleTestWave}
              disabled={testingWave}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 border border-slate-300 transition"
            >
              {testingWave && <Loader2 className="w-4 h-4 animate-spin" />}
              Test Wave Connection
            </button>
          </div>
        </div>

        {waveTestResult && (
          <div
            className={`p-4 rounded-lg border text-sm flex items-start gap-3 ${
              waveTestResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            {waveTestResult.success ? (
              <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{waveTestResult.message}</p>
              {waveTestResult.businesses && waveTestResult.businesses.length > 0 && (
                <ul className="mt-2 text-xs list-disc list-inside space-y-0.5">
                  {waveTestResult.businesses.map((b) => (
                    <li key={b.id}>
                      {b.name} (Currency: {b.currency?.code})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* QUICKBOOKS ONLINE SETTINGS SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            2. QuickBooks Online Integration (OAuth 2.0)
          </h2>
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2.5 py-0.5 rounded-full">
            REST API v3
          </span>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={`w-5 h-5 ${isQboConnected ? "text-emerald-600" : "text-slate-400"}`}
            />
            <span className="font-semibold text-slate-700">
              Connection Status:{" "}
              {isQboConnected ? (
                <span className="text-emerald-700 font-bold">Connected (Realm ID: {qboRealmId})</span>
              ) : (
                <span className="text-amber-700 font-bold">Not Connected</span>
              )}
            </span>
          </div>

          {isQboConnected && (
            <button
              type="button"
              onClick={handleDisconnectQbo}
              className="text-red-600 hover:underline font-semibold"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* QuickBooks App Credentials Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              QuickBooks Client ID
            </label>
            <input
              type="text"
              value={qboClientId}
              onChange={(e) => setQboClientId(e.target.value)}
              placeholder="e.g. AB123456789..."
              className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              QuickBooks Client Secret
            </label>
            <input
              type="password"
              value={qboClientSecret}
              onChange={(e) => setQboClientSecret(e.target.value)}
              placeholder="Paste Client Secret"
              className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Environment
            </label>
            <select
              value={qboEnvironment}
              onChange={(e) => setQboEnvironment(e.target.value as "sandbox" | "production")}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold"
            >
              <option value="production">Production (Real Intuit Account)</option>
              <option value="sandbox">Sandbox (Intuit Test Company)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Redirect URI (Set in Intuit Developer Dashboard)
            </label>
            <input
              type="text"
              readOnly
              value={
                typeof window !== "undefined"
                  ? `${window.location.origin}/api/quickbooks/callback`
                  : "/api/quickbooks/callback"
              }
              className="w-full border border-slate-200 bg-slate-100 rounded-lg p-2 text-xs font-mono text-slate-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handleConnectQbo}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition"
          >
            <ExternalLink className="w-4 h-4" />
            {isQboConnected ? "Reconnect with QuickBooks OAuth" : "Connect with QuickBooks"}
          </button>

          <button
            type="button"
            onClick={handleSaveQboCreds}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm px-4 py-2.5 rounded-lg border border-slate-300 transition"
          >
            Save App Keys
          </button>

          {isQboConnected && (
            <button
              type="button"
              onClick={handleTestQbo}
              disabled={testingQbo}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-sm px-4 py-2.5 rounded-lg border border-emerald-300 transition flex items-center gap-1.5"
            >
              {testingQbo && <Loader2 className="w-4 h-4 animate-spin" />}
              Test QBO Connection
            </button>
          )}
        </div>

        {/* Output */}
        {qboTestResult && (
          <div
            className={`p-4 rounded-lg border text-sm flex items-start gap-3 ${
              qboTestResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            {qboTestResult.success ? (
              <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{qboTestResult.message}</p>
              {qboTestResult.business && (
                <p className="text-xs mt-1 text-emerald-800">
                  Legal Name: {qboTestResult.business.legalName || qboTestResult.business.name} | Currency: {qboTestResult.business.currency?.code}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Production & Vercel deployment guide */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-600" />
          Deploying to Vercel (Production Env Variables)
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          You can set these Environment Variables directly in your Vercel Project Settings:
        </p>
        <div className="bg-slate-900 text-slate-100 p-3.5 rounded-lg text-xs font-mono space-y-1">
          <div># Wave Credentials</div>
          <div className="text-blue-300">WAVE_API_TOKEN=your_wave_token_here</div>
          <div className="pt-2"># QuickBooks Credentials</div>
          <div className="text-emerald-300">QBO_CLIENT_ID=your_qbo_client_id</div>
          <div className="text-emerald-300">QBO_CLIENT_SECRET=your_qbo_client_secret</div>
          <div className="text-emerald-300">QBO_ENVIRONMENT=production</div>
        </div>
      </div>
    </div>
  );
}
