"use client";

import Link from "next/link";
import { FileText, Settings, Send, CheckCircle2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { InvoicingProvider } from "@/lib/types";

export default function Navbar() {
  const [provider, setProvider] = useState<InvoicingProvider>("wave");
  const [waveTokenSet, setWaveTokenSet] = useState<boolean>(false);
  const [qboConnected, setQboConnected] = useState<boolean>(false);

  const checkStatus = () => {
    const activeProv = (localStorage.getItem("active_invoicing_provider") as InvoicingProvider) || "wave";
    setProvider(activeProv);

    const localWaveToken = localStorage.getItem("wave_custom_token");
    setWaveTokenSet(!!localWaveToken);

    const qboToken = localStorage.getItem("qbo_access_token");
    setQboConnected(!!qboToken);
  };

  useEffect(() => {
    checkStatus();

    const handleStorage = () => checkStatus();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("providerChanged", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("providerChanged", handleStorage);
    };
  }, []);

  const switchProvider = (newProv: InvoicingProvider) => {
    setProvider(newProv);
    localStorage.setItem("active_invoicing_provider", newProv);
    window.dispatchEvent(new Event("providerChanged"));
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-lg shadow-sm flex items-center justify-center text-white transition-colors ${
                provider === "quickbooks" ? "bg-emerald-600" : "bg-blue-600"
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <Link href="/" className="font-bold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                Invoice Dispatcher
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    provider === "quickbooks"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-blue-100 text-blue-800 border border-blue-300"
                  }`}
                >
                  {provider === "quickbooks" ? "QuickBooks Online" : "Wave GraphQL"}
                </span>
              </Link>
            </div>
          </div>

          {/* Provider Switcher + Navigation */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Active Provider Selector Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => switchProvider("wave")}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                  provider === "wave"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Wave {waveTokenSet && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </button>
              <button
                type="button"
                onClick={() => switchProvider("quickbooks")}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                  provider === "quickbooks"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                QuickBooks {qboConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </button>
            </div>

            {/* Navigation links */}
            <Link
              href="/"
              className="text-slate-600 hover:text-blue-600 px-2 sm:px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 transition"
            >
              <Send className="w-4 h-4" />
              <span className="hidden md:inline">Single Invoice</span>
            </Link>
            <Link
              href="/bulk"
              className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 sm:px-3 py-2 rounded-md text-sm font-bold flex items-center gap-1.5 border border-blue-200 transition"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Bulk Send</span>
            </Link>
            <Link
              href="/invoices"
              className="text-slate-600 hover:text-emerald-700 px-2 sm:px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 transition"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline">Manage & Paid</span>
            </Link>
            <Link
              href="/settings"
              className="text-slate-600 hover:text-blue-600 px-2 sm:px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 transition"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
