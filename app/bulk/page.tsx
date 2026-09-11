"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Play,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Zap,
  Tag,
} from "lucide-react";
import { Business, BulkQueueItem } from "@/lib/types";
import Link from "next/link";

export default function BulkInvoicingPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  // Global settings for the bulk batch (Product & Price applied to all)
  const [globalProductName, setGlobalProductName] = useState(
    "Web Application Development"
  );
  const [globalPrice, setGlobalPrice] = useState<number>(250);
  const [delaySeconds, setDelaySeconds] = useState<number>(5);
  const [dueDateDays, setDueDateDays] = useState<number>(14);
  const [emailSubject, setEmailSubject] = useState(
    "Invoice {invoiceNumber} for {customerName}"
  );
  const [emailBody, setEmailBody] = useState(
    "Hi {customerName},\n\nPlease find your invoice {invoiceNumber} for ${amount}. You can pay securely online using the payment link below.\n\nThank you for your business!"
  );
  const [attachPDF, setAttachPDF] = useState(true);

  // Bulk input raw text & queue
  const [rawInput, setRawInput] = useState("");
  const [queue, setQueue] = useState<BulkQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

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

  // Parse raw text (Emails list or CSV/TSV from Excel)
  const parseRawInput = () => {
    if (!rawInput.trim()) return;

    const lines = rawInput.trim().split("\n");
    const items: BulkQueueItem[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let parts: string[] = [];
      if (trimmed.includes("\t")) {
        parts = trimmed.split("\t");
      } else {
        parts = trimmed.split(",");
      }

      parts = parts.map((p) => p.trim().replace(/^["']|["']$/g, ""));

      let customerName = "";
      let customerEmail = "";
      let amount = globalPrice;
      let description = globalProductName;
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      let invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}${randomSuffix}`;

      if (parts.length === 1) {
        // Just email passed line-by-line: "john@example.com"
        if (parts[0].includes("@")) {
          customerEmail = parts[0];
          const rawName = parts[0].split("@")[0].replace(/[._-]/g, " ");
          customerName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        } else {
          customerName = parts[0];
        }
      } else if (parts[0].includes("@")) {
        // Line starts with email: "john@example.com, 250"
        customerEmail = parts[0];
        const rawName = parts[0].split("@")[0].replace(/[._-]/g, " ");
        customerName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        amount = Number(parts[1]) || globalPrice;
        if (parts[2]) description = parts[2];
        if (parts[3]) invoiceNumber = parts[3];
      } else {
        // Standard format: "Customer Name, Email, Price, Description, Inv#"
        customerName = parts[0] || `Customer ${idx + 1}`;
        customerEmail = parts[1] || "";
        amount = Number(parts[2]) || globalPrice;
        description = parts[3] || globalProductName;
        if (parts[4]) invoiceNumber = parts[4];
      }

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

  // One-click apply global product name and price to all queue items
  const applyGlobalToAllQueue = () => {
    setQueue((prev) =>
      prev.map((item) => ({
        ...item,
        amount: globalPrice,
        description: globalProductName,
      }))
    );
  };

  // Load Sample Template (5 recipients demo)
  const loadSampleData = () => {
    const sample = `alex.turner@company.io\nsarah.jenkins@enterprise.com\naccounting@apexlogistics.com\ninfo@horizonhealth.org\nfinance@technova.dev`;
    setRawInput(sample);
  };

  // Process a single item
  const processItem = async (item: BulkQueueItem, bId: string) => {
    const customToken = localStorage.getItem("wave_custom_token") || "";
    const dueDate = new Date(Date.now() + dueDateDays * 86400000)
      .toISOString()
      .split("T")[0];

    const finalItemTitle = item.description || globalProductName;
    const finalAmount = Number(item.amount) || globalPrice;

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
            name: finalItemTitle,
            description: "",
            quantity: 1,
            unitPrice: finalAmount,
          },
        ],
      }),
    });

    const invoiceData = await invoiceRes.json();
    if (!invoiceRes.ok || !invoiceData.success) {
      throw new Error(invoiceData.error || "Failed to create invoice");
    }

    const invoice = invoiceData.invoice;

    // 2. Send Invoice Email if email exists (with automatic backoff retry if rate limited)
    if (item.customerEmail) {
      const personalizedSubject = emailSubject
        .replace(/{customerName}/g, item.customerName)
        .replace(/{invoiceNumber}/g, invoice.invoiceNumber || item.invoiceNumber || "")
        .replace(/{amount}/g, String(finalAmount));

      const personalizedBody = emailBody
        .replace(/{customerName}/g, item.customerName)
        .replace(/{invoiceNumber}/g, invoice.invoiceNumber || item.invoiceNumber || "")
        .replace(/{amount}/g, String(finalAmount))
        .replace(/{dueDate}/g, dueDate);

      let sendSuccess = false;
      let lastError = "";

      for (let attempt = 1; attempt <= 3; attempt++) {
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
        if (sendRes.ok && sendData.success) {
          sendSuccess = true;
          break;
        }

        lastError = sendData.error || "Failed to send email";

        // If rate limited by Wave, sleep for 6-12 seconds and retry
        if ((lastError.toLowerCase().includes("rate limit") || lastError.toLowerCase().includes("too many requests")) && attempt < 3) {
          console.warn(`Wave rate limit hit for ${item.customerEmail}. Waiting ${attempt * 6}s before retry...`);
          await new Promise((r) => setTimeout(r, attempt * 6000));
        } else {
          break;
        }
      }

      if (!sendSuccess) {
        throw new Error(
          `Invoice created (#${invoice.invoiceNumber}), but email failed: ${lastError}`
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

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status === "success") continue;

      setQueue((prev) =>
        prev.map((q, idx) =>
          idx === i ? { ...q, status: "processing", errorMessage: undefined } : q
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
        console.error("Bulk processing item error:", err);
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

      // Configurable pacing delay between invoices (default 3 seconds to avoid Wave rate limits)
      const delayMs = Math.max(1000, Number(delaySeconds || 3) * 1000);
      await new Promise((r) => setTimeout(r, delayMs));
    }

    setIsProcessing(false);
  };

  const successCount = queue.filter((q) => q.status === "success").length;
  const errorCount = queue.filter((q) => q.status === "error").length;
  const progressPercent = queue.length > 0 ? Math.round((successCount / queue.length) * 100) : 0;

  // Export Results to CSV
  const exportResultsCSV = () => {
    if (queue.length === 0) return;
    const header = "Customer Name,Email,Product,Amount,Invoice Number,Status,Invoice URL,Error Message\n";
    const rows = queue
      .map(
        (q) =>
          `"${q.customerName}","${q.customerEmail}","${q.description || globalProductName}","${q.amount}","${q.invoiceNumber || ""}","${q.status}","${q.invoiceUrl || ""}","${q.errorMessage || ""}"`
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Bulk Invoicing & Email Dispatch
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Set one global product &amp; price, paste your email list, and send invoices to 100–500+ recipients automatically.
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

      {/* Global Product & Price Card (Applied to All) */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-200/60 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Global Product &amp; Global Price (Applied to All Invoices)
            </h2>
          </div>
          {queue.length > 0 && (
            <button
              type="button"
              onClick={applyGlobalToAllQueue}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-sm w-fit"
            >
              <Zap className="w-3.5 h-3.5" />
              Apply This Product &amp; Price to All ({queue.length}) in Queue
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Global Product / Service Title *
            </label>
            <input
              type="text"
              value={globalProductName}
              onChange={(e) => setGlobalProductName(e.target.value)}
              placeholder="e.g. Web Application Development"
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              This exact title will be created and displayed on every invoice.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Global Price ($) *
            </label>
            <input
              type="number"
              value={globalPrice}
              onChange={(e) => setGlobalPrice(Number(e.target.value))}
              placeholder="250"
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Charged to each customer.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Pacing Delay (Sec) *
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Delay between sends (prevents rate limits).
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Paste, Right Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Input List & Email Template (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
              1. Paste Recipient Emails
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
                  Recipient Email List (1 per line)
                </label>
                <button
                  type="button"
                  onClick={loadSampleData}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Load Demo List
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">
                Just paste pure email addresses line-by-line. No names or prices needed!
              </p>
              <textarea
                rows={8}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={`alex@company.com\njohn.smith@client.io\nbilling@enterprise.org\nfinance@startup.co`}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={parseRawInput}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Load Recipients into Queue
            </button>
          </div>

          {/* Email Customization */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
              2. Email Subject &amp; Message Template
            </h2>

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

        {/* Right: Execution Queue (7 cols) */}
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
                    <th className="p-2.5">Email &amp; Recipient</th>
                    <th className="p-2.5">Product Title</th>
                    <th className="p-2.5 text-right">Amount</th>
                    <th className="p-2.5 text-center">Status / Details</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No recipients in queue. Paste your email list on the left or click &quot;Load Demo List&quot;.
                      </td>
                    </tr>
                  ) : (
                    queue.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5">
                          <p className="font-semibold text-slate-800">{item.customerEmail || item.customerName}</p>
                          <p className="text-slate-400 text-[11px]">{item.customerName}</p>
                        </td>
                        <td className="p-2.5 text-slate-700 font-medium">
                          {item.description || globalProductName}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900">
                          ${Number(item.amount || globalPrice).toFixed(2)}
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
                            <div className="flex flex-col items-center">
                              <span
                                className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center justify-center gap-1"
                              >
                                <AlertCircle className="w-2.5 h-2.5 text-red-600" /> Failed
                              </span>
                              {item.errorMessage && (
                                <span className="text-[10px] text-red-600 max-w-[200px] break-words text-left mt-1 block">
                                  {item.errorMessage}
                                </span>
                              )}
                            </div>
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
