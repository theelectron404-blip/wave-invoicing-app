"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Check,
  CreditCard,
  DollarSign,
} from "lucide-react";
import { Business } from "@/lib/types";
import Link from "next/link";

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  status: string;
  invoiceDate: string;
  dueDate: string;
  viewUrl: string;
  pdfUrl?: string;
  customer?: {
    name: string;
    email?: string;
  };
  total?: {
    raw: number;
    value: string;
  };
  amountDue?: {
    raw: number;
    value: string;
  };
  amountPaid?: {
    raw: number;
    value: string;
  };
}

export default function InvoicesManagerPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  // Load businesses
  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const customToken = localStorage.getItem("wave_custom_token") || "";
        const res = await fetch("/api/wave/business", {
          headers: customToken ? { "x-wave-token": customToken } : {},
        });
        const data = await res.json();
        if (data.success && data.businesses.length > 0) {
          setBusinesses(data.businesses);
          setSelectedBusiness(data.businesses[0]);
          loadInvoices(data.businesses[0].id);
        }
      } catch (err) {
        console.error("Error loading businesses", err);
        setIsLoading(false);
      }
    };
    fetchBusinesses();
  }, []);

  // Fetch Invoices
  const loadInvoices = async (businessId: string) => {
    setIsLoading(true);
    setNotification({ type: null, message: "" });
    try {
      const customToken = localStorage.getItem("wave_custom_token") || "";
      const res = await fetch(`/api/wave/invoices/list?businessId=${businessId}&pageSize=50`, {
        headers: customToken ? { "x-wave-token": customToken } : {},
      });
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices || []);
      } else {
        setNotification({
          type: "error",
          message: data.error || "Failed to fetch invoices",
        });
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to load invoices",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBusinessChange = (bId: string) => {
    const b = businesses.find((x) => x.id === bId) || null;
    setSelectedBusiness(b);
    if (b) loadInvoices(b.id);
  };

  // Mark invoice as paid
  const handleMarkAsPaid = async (inv: InvoiceItem) => {
    if (!selectedBusiness) return;
    setActionLoadingId(inv.id);
    setNotification({ type: null, message: "" });

    try {
      const customToken = localStorage.getItem("wave_custom_token") || "";
      const res = await fetch("/api/wave/invoices/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customToken ? { "x-wave-token": customToken } : {}),
        },
        body: JSON.stringify({
          invoiceId: inv.id,
          businessId: selectedBusiness.id,
          amount: inv.total?.raw || 0,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNotification({
          type: "success",
          message: `Invoice #${inv.invoiceNumber} status updated successfully!`,
        });
        // Optimistically update status
        setInvoices((prev) =>
          prev.map((item) =>
            item.id === inv.id ? { ...item, status: "PAID" } : item
          )
        );
      } else {
        throw new Error(data.error || "Failed to mark invoice as paid");
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to update invoice",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ||
      inv.status?.toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-600" />
            Invoices &amp; Payment Manager
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            View all past Wave invoices, check live payment status, and mark old invoices as paid.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/bulk"
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-3.5 py-2 rounded-lg border border-blue-200 transition"
          >
            Bulk Send (200-300+)
          </Link>
          <Link
            href="/"
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3.5 py-2 rounded-lg border border-slate-300 transition"
          >
            Create New Invoice
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {notification.type && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          {notification.message}
        </div>
      )}

      {/* Filter and Business Selection Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-4">
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            Wave Business
          </label>
          <select
            value={selectedBusiness?.id || ""}
            onChange={(e) => handleBusinessChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.currency?.code || "USD"})
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5">
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            Search Invoices or Customers
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by customer name, email, or invoice #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="md:col-span-3 flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Filter Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">PAID</option>
              <option value="SAVED">SAVED / SENT</option>
              <option value="DRAFT">DRAFT</option>
              <option value="OVERDUE">OVERDUE</option>
            </select>
          </div>

          <button
            type="button"
            disabled={isLoading || !selectedBusiness}
            onClick={() => selectedBusiness && loadInvoices(selectedBusiness.id)}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition disabled:opacity-50"
            title="Refresh Invoices"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">
            Invoices List ({filteredInvoices.length} Total)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Invoice #</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Date / Due</th>
                <th className="p-3 text-right">Total Amount</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading invoices from Wave...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">
                    No invoices found matching your search / filter.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 font-semibold text-slate-900 font-mono">
                      {inv.invoiceNumber}
                    </td>
                    <td className="p-3">
                      <p className="font-semibold text-slate-800">
                        {inv.customer?.name || "Unnamed Customer"}
                      </p>
                      {inv.customer?.email && (
                        <p className="text-xs text-slate-400">{inv.customer.email}</p>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      <p>Issued: {inv.invoiceDate || "N/A"}</p>
                      <p className="text-slate-400">Due: {inv.dueDate || "N/A"}</p>
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      {inv.total?.value || `$${(inv.total?.raw || 0).toFixed(2)}`}
                    </td>
                    <td className="p-3 text-center">
                      {inv.status === "PAID" ? (
                        <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> PAID
                        </span>
                      ) : inv.status === "SAVED" || inv.status === "SENT" || inv.status === "VIEWED" ? (
                        <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-xs font-bold">
                          {inv.status}
                        </span>
                      ) : inv.status === "OVERDUE" ? (
                        <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full text-xs font-bold">
                          OVERDUE
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                          {inv.status}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.status !== "PAID" && (
                          <button
                            type="button"
                            disabled={actionLoadingId === inv.id}
                            onClick={() => handleMarkAsPaid(inv)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition disabled:opacity-50"
                          >
                            {actionLoadingId === inv.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            )}
                            Mark as Paid
                          </button>
                        )}

                        {inv.viewUrl && (
                          <a
                            href={inv.viewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-md font-semibold inline-flex items-center gap-1 transition"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
