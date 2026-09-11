"use client";

import { useState, useEffect } from "react";
import { Key, Building2, Check, AlertCircle, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [token, setToken] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    businesses?: any[];
  } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("wave_custom_token");
    if (saved) {
      setToken(saved);
      setIsSaved(true);
    }
  }, []);

  const handleSave = () => {
    if (token.trim()) {
      localStorage.setItem("wave_custom_token", token.trim());
      setIsSaved(true);
    } else {
      localStorage.removeItem("wave_custom_token");
      setIsSaved(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/wave/business", {
        headers: token.trim() ? { "x-wave-token": token.trim() } : {},
      });
      const data = await res.json();

      if (data.success) {
        setTestResult({
          success: true,
          message: `Connected successfully! Found ${data.businesses.length} business(es).`,
          businesses: data.businesses,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "Failed to authenticate with Wave API.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Network error occurred while testing.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Wave API Settings & Credentials
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure your Wave developer personal access token or environment
          variables to connect this app to your Wave account.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Key className="w-5 h-5 text-blue-600" />
          Wave Personal Access Token
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Bearer Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setIsSaved(false);
              }}
              placeholder="Paste your Wave Full Access Token here"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              You can generate a token in the{" "}
              <a
                href="https://developer.waveapps.com/"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                Wave Developer Portal
              </a>{" "}
              (under <em>Manage Applications &rarr; Create Token</em>).
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 transition"
            >
              <Check className="w-4 h-4" />
              {isSaved ? "Saved in Browser" : "Save Token"}
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 border border-slate-300 transition"
            >
              {testing && <Loader2 className="w-4 h-4 animate-spin" />}
              Test Connection
            </button>
          </div>
        </div>

        {/* Test Connection Output */}
        {testResult && (
          <div
            className={`p-4 rounded-lg border text-sm flex items-start gap-3 ${
              testResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            {testResult.success ? (
              <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{testResult.message}</p>
              {testResult.businesses && testResult.businesses.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-semibold text-emerald-800">
                    Available Businesses:
                  </p>
                  <ul className="text-xs list-disc list-inside">
                    {testResult.businesses.map((b) => (
                      <li key={b.id}>
                        {b.name} (ID: {b.id})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Production & Vercel deployment guide */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-600" />
          Deploying to Vercel (Production)
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          When deploying this project to Vercel, you can set your Wave credentials as Environment Variables in your Vercel Project Settings:
        </p>
        <div className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs font-mono space-y-1">
          <div>WAVE_API_TOKEN=your_token_here</div>
          <div>WAVE_BUSINESS_ID=your_business_id_here</div>
        </div>
      </div>
    </div>
  );
}
