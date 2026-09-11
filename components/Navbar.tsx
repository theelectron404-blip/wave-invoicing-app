"use client";

import Link from "next/link";
import { FileText, Settings, Send, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [tokenSet, setTokenSet] = useState<boolean>(false);

  useEffect(() => {
    const localToken = localStorage.getItem("wave_custom_token");
    if (localToken) {
      setTokenSet(true);
    }
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <Link href="/" className="font-bold text-lg text-slate-900 flex items-center gap-2">
                Wave Invoice Dispatcher
                <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-medium">
                  GraphQL API
                </span>
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="text-slate-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 transition"
            >
              <Send className="w-4 h-4" />
              Create & Send
            </Link>
            <Link
              href="/settings"
              className="text-slate-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 transition"
            >
              <Settings className="w-4 h-4" />
              Settings
              {tokenSet && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              )}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
