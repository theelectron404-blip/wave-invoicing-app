"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Customer } from "@/lib/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  onCustomerCreated: (customer: Customer) => void;
}

export default function NewCustomerModal({
  isOpen,
  onClose,
  businessId,
  onCustomerCreated,
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const customToken = localStorage.getItem("wave_custom_token") || "";
      const res = await fetch("/api/wave/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customToken ? { "x-wave-token": customToken } : {}),
        },
        body: JSON.stringify({
          businessId,
          name,
          email: email.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create customer");
      }

      onCustomerCreated(data.customer);
      setName("");
      setEmail("");
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Add New Customer</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg text-xs border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Customer / Company Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp or Jane Doe"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Customer Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
