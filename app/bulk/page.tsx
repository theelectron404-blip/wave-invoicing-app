"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Play,
  Pause,
  RefreshCw,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Mail,
  Copy,
} from "lucide-react";
import { Business, BulkQueueItem } from "@/lib/types";
import Link from "next/link";

export default function BulkInvoicingPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  // Bulk input raw text
  const [rawInput, setRawInput] = useState("");
  const [queue, setQueue] = useState<BulkQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Global settings for the bulk batch
  const [defaultItemName, setDefaultItemName] = useState(
    "Monthly Service & Consulting Fee"
  );
  const [defaultPrice, setDefaultPrice] = useState<number>(150);
  const [dueDateDays, setDueDateDays] = useState<number>(14);
  const [emailSubject, setEmailSubject] = useState(
    "Invoice {invoiceNumber} for {customerName}"
  );
  const [emailBody, setEmailBody] = useState(
    "Hi {customerName},\n\nPlease find your invoice {invoiceNumber} for ${amount}. You can pay securely online using the payment link below.\n\nThank you for your business!"
  );
  const [attachPDF, setAttachPDF] = useState(true);

  // Fetch businesses on mount
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
        }
      } catch (err) {
        console.error("Error loading businesses", err);
      }
    };
    fetchBusinesses();
  }, []);

  // Parse raw text (CSV / TSV from Excel / Comma separated)
  const parseRawInput = () => {
    if (!rawInput.trim()) return;

    const lines = rawInput.trim().split("\n");
    const items: BulkQueueItem[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Handle tab-separated (from Excel) or comma-separated
      let parts: string[] = [];
      if (trimmed.includes("\t")) {
        parts = trimmed.split("\t");
      } else {
        // Simple comma split
        parts = trimmed.split(",");
      }

      parts = parts.map((p) => p.trim().replace(/^["']|["']$/g, ""));

      const customerName = parts[0] || `Customer ${idx + 1}`;
      const customerEmail = parts[1] || "";
      const amount = Number(parts[2]) || defaultPrice;
      const description = parts[3] || defaultItemName;
      const invoiceNumber =
        parts[4] ||
        `INV-${new Date().getFullYear()}-${String(idx + 101).padStart(4, "0")}`;

      items.push({
        id: Math.random().toString(),
        customerName,
        customerEmail,
        amount,
        description,
        invoiceNumber,
        status: "pending",
      });
    });

    setQueue(items);
  };

  // Load Sample Template (5 recipients demo)
  const loadSampleData = () => {
    const sample = `Acme Corporation\tacme@example.com\t250\tMonthly Web Hosting & Support\tINV-2026-1001
Starlight Media Inc\tbilling@starlight.io\t500\tCustom Application Development\tINV-2026-1002
Apex Logistics\taccounts@apexlogistics.com\t150\tMonthly Maintenance\tINV-2026-1003
Horizon Health\tinfo@horizonhealth.org\t350\tCloud Infrastructure Setup\tINV-2026-1004
TechNova Labs\tpayments@technova.dev\t1200\tEnterprise Sprint Phase 1\tINV-2026-1005`;
    setRawInput(sample);
  };

  // Process a single item
  const processItem = async (item: BulkQueueItem, bId: string) => {
    const customToken = localStorage.getItem("wave_custom_token") || "";
    const dueDate = new Date(Date.now() + dueDateDays * 86400000)
      .toISOString()
      .split("T")[0];

    // 1. Create Invoice
    const invoiceRes = await fetch("/api/wave/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(customToken ? { "x-wave-token": customToken } : {}),
      },
      body: JSON.stringify({
        businessId: bId,
        customerName: item.customerName,
        customerEmail: item.customerEmail,
        invoiceNumber: item.invoiceNumber,
        dueDate,
        items: [
          {
            name: item.description || defaultItemName,
            description: item.description || defaultItemName,
            quantity: 1,
            unitPrice: item.amount,
          },
        ],
      }),
    });

    const invoiceData = await invoiceRes.json();
    if (!invoiceRes.ok || !invoiceData.success) {
      throw new Error(invoiceData.error || "Failed to create invoice");
    }

    const invoice = invoiceData.invoice;

    // 2. Send Invoice Email if email exists
    if (item.customerEmail) {
      // Interpolate template variables
      const personalizedSubject = emailSubject
        .replace(/{customerName}/g, item.customerName)
        .replace(/{invoiceNumber}/g, invoice.invoiceNumber || item.invoiceNumber || "")
        .replace(/{amount}/g, String(item.amount));

      const personalizedBody = emailBody
        .replace(/{customerName}/g, item.customerName)
        .replace(/{invoiceNumber}/g, invoice.invoiceNumber || item.invoiceNumber || "")
        .replace(/{amount}/g, String(item.amount))
        .replace(/{dueDate}/g, dueDate);

      const sendRes = await fetch("/api/wave/invoices/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customToken ? { "x-wave-token": customToken } : {}),
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          to: [item.customerEmail],
          subject: personalizedSubject,
          message: personalizedBody,
          attachPDF,
        }),
      });

      const sendData = await sendRes.json();
      if (!sendRes.ok || !sendData.success) {
        throw new Error(
          `Invoice created (#${invoice.invoiceNumber}), but email failed: ${sendData.error}`
        );
      }
    }

    return invoice.viewUrl;
  };

  // Start Batch Processing Loop
  const startBulkDispatch = async () => {
    if (!selectedBusiness) {
      alert("Please select a Wave Business first.");
      return;
    }
    if (queue.length === 0) {
      alert("Please parse or enter customers first.");
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);

    for (let i = currentIndex; i < queue.length; i++) {
      if (isPaused) break;

      const item = queue[i];
      if (item.status === "success") continue; // Skip already finished

      // Update status to processing
      setQueue((prev) =>
        prev.map((q, idx) =>
          idx === i ? { ...q, status: "processing" } : q
        )
      );
      setCurrentIndex(i);

      try {
        const viewUrl = await processItem(item, selectedBusiness.id);
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i ? { ...q, status: "success", invoiceUrl: viewUrl } : q
          )
        );
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i
              ? {
                  ...q,
                  status: "error",
                  errorMessage: err.message || "Failed to process",
                }
              : q
          )
        );
      }

      // Small delay between requests to respect Wave rate-limits
      await new Promise((r) => setTimeout(r, 600));
    }

    setIsProcessing(false);
  };

  const successCount = queue.filter((q) => q.status === "success").length;
  const errorCount = queue.filter((q) => q.status === "error").length;
  const progressPercent = queue.length > 0 ? Math.round((successCount / queue.length) * 100) : 0;

  // Export Results to CSV
  const exportResultsCSV = () => {
    if (queue.length === 0) return;
    const header = "Customer Name,Email,Amount,Invoice Number,Status,Invoice URL,Error Message\n";
    const rows = queue
      .map(
        (q) =>
          `"${q.customerName}","${q.customerEmail}","${q.amount}","${q.invoiceNumber || ""}","${q.status}","${q.invoiceUrl || ""}","${q.errorMessage || ""}"`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `bulk-invoices-report-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Bulk Invoicing & Email Dispatch
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Paste 100–300+ customers from Excel/CSV and automatically create, approve, and send custom invoices in batch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3.5 py-2 rounded-lg border border-slate-300 transition"
          >
            &larr; Single Invoice Mode
          </Link>
          <Link
            href="/settings"
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-3.5 py-2 rounded-lg border border-blue-200 transition"
          >
            Wave API Settings
          </Link>
        </div>
      </div>

      {/* Grid: Left Input, Right Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Config & Paste Area (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
              1. Paste Customers (CSV / Excel)
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Wave Business
              </label>
              <select
                value={selectedBusiness?.id || ""}
                onChange={(e) => {
                  const b = businesses.find((x) => x.id === e.target.value) || null;
                  setSelectedBusiness(b);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.currency?.code || "USD"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Customer Data (Paste TSV/CSV)
                </label>
                <button
                  type="button"
                  onClick={loadSampleData}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Load Demo Data
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">
                Format: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">Name, Email, Price, Description, Invoice#</code>
              </p>
              <textarea
                rows={8}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={`Acme Corp\tacme@example.com\t250\tConsulting\tINV-001\nJane Doe\tjane@example.com\t150\tDesign\tINV-002`}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={parseRawInput}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Parse &amp; Load into Queue
            </button>
          </div>

          {/* Batch Email & Default Item Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
              2. Shared Email &amp; Item Template
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Item Name
                </label>
                <input
                  type="text"
                  value={defaultItemName}
                  onChange={(e) => setDefaultItemName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Price ($)
                </label>
                <input
                  type="number"
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Subject Template
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Message Template
              </label>
              <textarea
                rows={4}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs font-sans focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Variables: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">&#123;customerName&#125;</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">&#123;invoiceNumber&#125;</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">&#123;amount&#125;</code>
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="bulkAttachPDF"
                checked={attachPDF}
                onChange={(e) => setAttachPDF(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
              <label htmlFor="bulkAttachPDF" className="text-xs font-medium text-slate-700 cursor-pointer">
                Attach PDF copy to each invoice email
              </label>
            </div>
          </div>
        </div>

        {/* Right Queue & Live Execution Table (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  3. Execution Queue ({queue.length} Total)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {successCount} Sent &bull; {errorCount} Failed &bull; {queue.length - successCount - errorCount} Remaining
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {queue.length > 0 && (
                  <button
                    type="button"
                    onClick={exportResultsCSV}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                )}

                <button
                  type="button"
                  disabled={queue.length === 0 || isProcessing}
                  onClick={startBulkDispatch}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Sending ({currentIndex + 1}/{queue.length})...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Start Bulk Send ({queue.length})
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {queue.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span>Batch Progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Queue Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">Customer &amp; Email</th>
                    <th className="p-2.5 text-right">Amount</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No customers in queue. Paste customer data on the left or click &quot;Load Demo Data&quot;.
                      </td>
                    </tr>
                  ) : (
                    queue.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5">
                          <p className="font-semibold text-slate-800">{item.customerName}</p>
                          <p className="text-slate-500 text-[11px]">{item.customerEmail || "No email"}</p>
                        </td>
                        <td className="p-2.5 text-right font-medium text-slate-700">
                          ${item.amount.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-center">
                          {item.status === "pending" && (
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                              Pending
                            </span>
                          )}
                          {item.status === "processing" && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center justify-center gap-1">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Sending...
                            </span>
                          )}
                          {item.status === "success" && (
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Sent
                            </span>
                          )}
                          {item.status === "error" && (
                            <span
                              title={item.errorMessage}
                              className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center justify-center gap-1 cursor-help"
                            >
                              <AlertCircle className="w-2.5 h-2.5 text-red-600" /> Failed
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          {item.invoiceUrl ? (
                            <a
                              href={item.invoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold inline-flex items-center gap-1"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-300">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
