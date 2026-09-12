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
import { Business, InvoicingProvider } from "@/lib/types";
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
    id?: string;
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
  const [provider, setProvider] = useState<InvoicingProvider>("wave");
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

  // Load businesses/company
  const fetchBusinesses = async () => {
    setIsLoading(true);
    const activeProv =
      (localStorage.getItem("active_invoicing_provider") as InvoicingProvider) || "wave";
    setProvider(activeProv);

    try {
      if (activeProv === "wave") {
        const customToken = localStorage.getItem("wave_custom_token") || "";
        const res = await fetch("/api/wave/business", {
          headers: customToken ? { "x-wave-token": customToken } : {},
        });
        const data = await res.json();
        if (data.success && data.businesses.length > 0) {
          setBusinesses(data.businesses);
          setSelectedBusiness(data.businesses[0]);
          loadInvoices(data.businesses[0].id, "wave");
        } else {
          setIsLoading(false);
        }
      } else {
        const realmId = localStorage.getItem("qbo_realm_id") || "";
        const accessToken = localStorage.getItem("qbo_access_token") || "";
        const environment = localStorage.getItem("qbo_environment") || "production";

        const res = await fetch("/api/quickbooks/company", {
          headers: {
            "x-qbo-realm-id": realmId,
            "x-qbo-access-token": accessToken,
            "x-qbo-environment": environment,
          },
        });
        const data = await res.json();
        if (data.success && data.business) {
          setBusinesses([data.business]);
          setSelectedBusiness(data.business);
          loadInvoices(data.business.id, "quickbooks");
        } else {
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error("Error loading businesses", err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();

    const handleProviderChange = () => fetchBusinesses();
    window.addEventListener("providerChanged", handleProviderChange);
    return () => window.removeEventListener("providerChanged", handleProviderChange);
  }, []);

  // Fetch Invoices
  const loadInvoices = async (bId: string, prov: InvoicingProvider) => {
    setIsLoading(true);
    setNotification({ type: null, message: "" });
    try {
      if (prov === "wave") {
        const customToken = localStorage.getItem("wave_custom_token") || "";
        const res = await fetch(`/api/wave/invoices/list?businessId=${bId}&pageSize=50`, {
          headers: customToken ? { "x-wave-token": customToken } : {},
        });
        const data = await res.json();
        if (data.success) {
          setInvoices(data.invoices || []);
        } else {
          setNotification({
            type: "error",
            message: data.error || "Failed to fetch Wave invoices",
          });
        }
      } else {
        const realmId = localStorage.getItem("qbo_realm_id") || "";
        const accessToken = localStorage.getItem("qbo_access_token") || "";
        const environment = localStorage.getItem("qbo_environment") || "production";

        const res = await fetch(`/api/quickbooks/invoices/list?pageSize=50`, {
          headers: {
            "x-qbo-realm-id": realmId,
            "x-qbo-access-token": accessToken,
            "x-qbo-environment": environment,
          },
        });
        const data = await res.json();
        if (data.success) {
          setInvoices(data.invoices || []);
        } else {
          setNotification({
            type: "error",
            message: data.error || "Failed to fetch QuickBooks invoices",
          });
        }
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Error connecting to server",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsPaid = async (inv: InvoiceItem) => {
    setActionLoadingId(inv.id);
    setNotification({ type: null, message: "" });

    try {
      if (provider === "wave") {
        const customToken = localStorage.getItem("wave_custom_token") || "";
        const res = await fetch("/api/wave/invoices/pay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(customToken ? { "x-wave-token": customToken } : {}),
          },
          body: JSON.stringify({
            businessId: selectedBusiness?.id,
            invoiceId: inv.id,
            amount: inv.amountDue?.raw || inv.total?.raw || 0,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setNotification({
            type: "success",
            message: `Invoice #${inv.invoiceNumber} successfully marked as PAID!`,
          });
          if (selectedBusiness) loadInvoices(selectedBusiness.id, "wave");
        } else {
          setNotification({
            type: "error",
            message: data.error || "Failed to record payment",
          });
        }
      } else {
        const realmId = localStorage.getItem("qbo_realm_id") || "";
        const accessToken = localStorage.getItem("qbo_access_token") || "";
        const environment = localStorage.getItem("qbo_environment") || "production";

        const res = await fetch("/api/quickbooks/invoices/pay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-qbo-realm-id": realmId,
            "x-qbo-access-token": accessToken,
            "x-qbo-environment": environment,
          },
          body: JSON.stringify({
            invoiceId: inv.id,
            customerId: inv.customer?.id,
            amount: inv.amountDue?.raw || inv.total?.raw || 0,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setNotification({
            type: "success",
            message: `Invoice #${inv.invoiceNumber} marked as PAID in QuickBooks!`,
          });
          if (selectedBusiness) loadInvoices(selectedBusiness.id, "quickbooks");
        } else {
          setNotification({
            type: "error",
            message: data.error || "Failed to record payment in QuickBooks",
          });
        }
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to process payment",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.customer?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.customer?.email || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ||
      inv.status?.toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Invoices Manager &amp; Mark Paid
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                provider === "quickbooks"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-blue-100 text-blue-800 border border-blue-300"
              }`}
            >
              {provider === "quickbooks" ? "QuickBooks Engine" : "Wave Engine"}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            View all dispatched invoices, filter by status, and record offline or external payments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {businesses.length > 0 && (
            <select
              value={selectedBusiness?.id || ""}
              onChange={(e) => {
                const b = businesses.find((x) => x.id === e.target.value);
                if (b) {
                  setSelectedBusiness(b);
                  loadInvoices(b.id, provider);
                }
              }}
              className="bg-white border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.currency?.code || "USD"})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => selectedBusiness && loadInvoices(selectedBusiness.id, provider)}
            disabled={isLoading}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notification Banner */}
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

      {/* Search & Filter Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by invoice#, customer name, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {["ALL", "UNPAID", "SENT", "PAID", "DRAFT"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === status
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="text-sm font-medium">Loading invoices from {provider === "quickbooks" ? "QuickBooks" : "Wave"}...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <FileText className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700">No invoices found</p>
            <p className="text-xs">Create your first invoice using the home or bulk dispatch tool.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredInvoices.map((inv) => {
                  const isPaid = inv.status?.toUpperCase() === "PAID" || (inv.amountDue?.raw === 0 && inv.total?.raw! > 0);
                  const isActioning = actionLoadingId === inv.id;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {inv.invoiceNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {inv.customer?.name || "Customer"}
                        </div>
                        {inv.customer?.email && (
                          <div className="text-slate-400 text-[11px]">
                            {inv.customer.email}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">
                        <div>Inv: {inv.invoiceDate || "N/A"}</div>
                        {inv.dueDate && (
                          <div className="text-[11px] text-slate-400">
                            Due: {inv.dueDate}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {inv.total?.value || "$0.00"}
                      </td>

                      <td className="py-3.5 px-4 font-bold">
                        <span className={isPaid ? "text-slate-400 line-through" : "text-emerald-700"}>
                          {inv.amountDue?.value || "$0.00"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wide inline-flex items-center gap-1 ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800"
                              : inv.status?.toUpperCase() === "SAVED" || inv.status?.toUpperCase() === "UNPAID"
                              ? "bg-amber-100 text-amber-800"
                              : inv.status?.toUpperCase() === "SENT"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {isPaid && <Check className="w-3 h-3" />}
                          {isPaid ? "PAID" : inv.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-2">
                        {inv.viewUrl && (
                          <a
                            href={inv.viewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold text-xs transition"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        {!isPaid && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsPaid(inv)}
                            disabled={isActioning}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-md text-[11px] inline-flex items-center gap-1 shadow-sm transition disabled:opacity-50"
                          >
                            {isActioning ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <DollarSign className="w-3 h-3" />
                            )}
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
