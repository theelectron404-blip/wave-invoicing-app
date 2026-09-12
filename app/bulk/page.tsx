"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Play,
  Download,
  FileSpreadsheet,
  Loader2,
  ExternalLink,
  Zap,
  Tag,
} from "lucide-react";
import { Business, BulkQueueItem, InvoicingProvider } from "@/lib/types";
import Link from "next/link";

export default function BulkInvoicingPage() {
  const [provider, setProvider] = useState<InvoicingProvider>("wave");
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

  // Fetch businesses/company on mount or when provider changes
  const fetchBusinesses = async () => {
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
        }
      }
    } catch (err) {
      console.error("Error loading businesses", err);
    }
  };

  useEffect(() => {
    fetchBusinesses();

    const handleProviderChange = () => fetchBusinesses();
    window.addEventListener("providerChanged", handleProviderChange);
    return () => window.removeEventListener("providerChanged", handleProviderChange);
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

  // Process a single item against active provider
  const processItem = async (item: BulkQueueItem, bId: string) => {
    const dueDate = new Date(Date.now() + dueDateDays * 86400000)
      .toISOString()
      .split("T")[0];

    const finalItemTitle = item.description || globalProductName;
    const finalAmount = Number(item.amount) || globalPrice;

    if (provider === "wave") {
      const customToken = localStorage.getItem("wave_custom_token") || "";

      // 1. Create Invoice in Wave
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
        throw new Error(invoiceData.error || "Failed to create invoice in Wave");
      }

      const invoice = invoiceData.invoice;

      // 2. Send Invoice Email if email exists
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

          if (
            (lastError.toLowerCase().includes("rate limit") ||
              lastError.toLowerCase().includes("too many requests")) &&
            attempt < 3
          ) {
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
    } else {
      // QuickBooks Engine
      const realmId = localStorage.getItem("qbo_realm_id") || "";
      const accessToken = localStorage.getItem("qbo_access_token") || "";
      const environment = localStorage.getItem("qbo_environment") || "production";

      const personalizedSubject = emailSubject
        .replace(/{customerName}/g, item.customerName)
        .replace(/{invoiceNumber}/g, item.invoiceNumber || "")
        .replace(/{amount}/g, String(finalAmount));

      const personalizedBody = emailBody
        .replace(/{customerName}/g, item.customerName)
        .replace(/{invoiceNumber}/g, item.invoiceNumber || "")
        .replace(/{amount}/g, String(finalAmount))
        .replace(/{dueDate}/g, dueDate);

      const invoiceRes = await fetch("/api/quickbooks/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-qbo-realm-id": realmId,
          "x-qbo-access-token": accessToken,
          "x-qbo-environment": environment,
        },
        body: JSON.stringify({
          customerName: item.customerName,
          customerEmail: item.customerEmail,
          invoiceNumber: item.invoiceNumber,
          dueDate,
          memo: personalizedBody,
          emailMessage: personalizedBody,
          emailSubject: personalizedSubject,
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
        throw new Error(invoiceData.error || "Failed to create invoice in QuickBooks");
      }

      const invoice = invoiceData.invoice;

      if (item.customerEmail) {
        let sendSuccess = false;
        let lastError = "";

        for (let attempt = 1; attempt <= 3; attempt++) {
          const sendRes = await fetch("/api/quickbooks/invoices/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-qbo-realm-id": realmId,
              "x-qbo-access-token": accessToken,
              "x-qbo-environment": environment,
            },
            body: JSON.stringify({
              invoiceId: invoice.id,
              to: [item.customerEmail],
              subject: personalizedSubject,
              message: personalizedBody,
            }),
          });

          const sendData = await sendRes.json();
          if (sendRes.ok && sendData.success) {
            sendSuccess = true;
            break;
          }

          lastError = sendData.error || "Unknown error";

          if (
            (lastError.toLowerCase().includes("rate limit") ||
              lastError.toLowerCase().includes("too many requests") ||
              lastError.toLowerCase().includes("throttle")) &&
            attempt < 3
          ) {
            await new Promise((r) => setTimeout(r, attempt * 6000));
          } else {
            break;
          }
        }

        if (!sendSuccess) {
          throw new Error(
            `Invoice created in QuickBooks (#${invoice.invoiceNumber}), but email dispatch failed: ${lastError}`
          );
        }
      }

      return `https://app.qbo.intuit.com/app/invoice?txnId=${invoice.id}`;
    }
  };

  // Start Batch Processing Loop
  const startBulkDispatch = async () => {
    if (!selectedBusiness) {
      alert("Please select a Business/Company first.");
      return;
    }
    if (queue.length === 0) {
      alert("Please parse or enter customers first.");
      return;
    }

    setIsProcessing(true);

    for (let i = 0; i < queue.length; i++) {
      setCurrentIndex(i);

      setQueue((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: "processing" } : item))
      );

      try {
        const viewUrl = await processItem(queue[i], selectedBusiness.id);

        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: "success", invoiceUrl: viewUrl, errorMessage: undefined }
              : item
          )
        );
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: "error",
                  errorMessage: err.message || "Failed to dispatch",
                }
              : item
          )
        );
      }

      if (i < queue.length - 1 && delaySeconds > 0) {
        await new Promise((r) => setTimeout(r, delaySeconds * 1000));
      }
    }

    setIsProcessing(false);
  };

  // Export Results as CSV
  const exportCSV = () => {
    if (queue.length === 0) return;

    const headers = [
      "Customer Name",
      "Customer Email",
      "Invoice #",
      "Amount",
      "Product Description",
      "Status",
      "Invoice URL",
      "Error Message",
    ];

    const rows = queue.map((item) => [
      `"${item.customerName}"`,
      `"${item.customerEmail}"`,
      `"${item.invoiceNumber || ""}"`,
      `"${item.amount}"`,
      `"${item.description || ""}"`,
      `"${item.status.toUpperCase()}"`,
      `"${item.invoiceUrl || ""}"`,
      `"${item.errorMessage || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bulk_invoicing_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const successCount = queue.filter((i) => i.status === "success").length;
  const errorCount = queue.filter((i) => i.status === "error").length;
  const pendingCount = queue.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Bulk Invoice Dispatcher
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
            Import recipients in bulk (100–500+), apply global product titles &amp; prices, and sequence invoice creations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {businesses.length > 0 && (
            <select
              value={selectedBusiness?.id || ""}
              onChange={(e) => {
                const b = businesses.find((x) => x.id === e.target.value);
                if (b) setSelectedBusiness(b);
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

          <Link
            href="/settings"
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg border border-slate-300 transition"
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Global Product & Pricing Controls */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold flex items-center gap-2 text-white">
            <Tag className="w-4 h-4 text-emerald-400" />
            Global Batch Settings (Applied to all recipients)
          </h2>
          <span className="text-xs bg-slate-800 text-emerald-400 px-2.5 py-0.5 rounded-full font-mono">
            Auto-created in {provider === "quickbooks" ? "QuickBooks" : "Wave"} if missing
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="md:col-span-2">
            <label className="block text-slate-300 font-semibold mb-1">
              Global Product / Item Title *
            </label>
            <input
              type="text"
              value={globalProductName}
              onChange={(e) => setGlobalProductName(e.target.value)}
              placeholder="e.g. Web Application Development"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Global Unit Price ($) *
            </label>
            <input
              type="number"
              value={globalPrice}
              onChange={(e) => setGlobalPrice(Number(e.target.value))}
              placeholder="250"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Pacing Delay (Seconds)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {queue.length > 0 && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={applyGlobalToAllQueue}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition shadow-sm"
            >
              <Zap className="w-3.5 h-3.5" />
              Apply Global Title &amp; Price to All ({queue.length}) Queue Items
            </button>
          </div>
        )}
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Input & Template Customizer (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Raw Recipient Input Box */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                1. Paste Recipients
              </h2>
              <button
                type="button"
                onClick={loadSampleData}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                Load Sample Data
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Paste raw email addresses line-by-line (e.g. <code>john@example.com</code>). Names and invoice numbers will be generated automatically!
            </p>

            <textarea
              rows={8}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={`alex.turner@company.io\nsarah.jenkins@enterprise.com\naccounting@apexlogistics.com\ninfo@horizonhealth.org`}
              className="w-full border border-slate-300 rounded-lg p-3 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50"
            />

            <button
              type="button"
              onClick={parseRawInput}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Parse &amp; Build Queue
            </button>
          </div>

          {/* Email Subject & Message Customizer */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3">
              2. Custom Email Template
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Subject Line
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Body Text
              </label>
              <textarea
                rows={4}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Right Execution Queue & Live Progress (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  3. Queue &amp; Progress ({queue.length} Recipients)
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="text-emerald-600 font-bold">✓ {successCount} Sent</span>
                  <span className="text-red-600 font-bold">✗ {errorCount} Failed</span>
                  <span className="text-amber-600 font-bold">⌛ {pendingCount} Pending</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportCSV}
                  disabled={queue.length === 0}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>

                <button
                  type="button"
                  onClick={startBulkDispatch}
                  disabled={isProcessing || queue.length === 0}
                  className={`text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 shadow-md transition disabled:opacity-50 ${
                    provider === "quickbooks"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Start Bulk Send ({provider === "quickbooks" ? "QuickBooks" : "Wave"})
                </button>
              </div>
            </div>

            {/* Queue List Table */}
            {queue.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Users className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">No recipients in queue</p>
                <p className="text-xs">Paste email addresses on the left and click "Parse &amp; Build Queue".</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Customer / Email</th>
                      <th className="py-2.5 px-3">Title &amp; Price</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {queue.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50 transition ${
                          idx === currentIndex && isProcessing ? "bg-blue-50/50" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{item.customerName}</div>
                          <div className="text-[11px] text-slate-500">{item.customerEmail}</div>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          <div>{item.description || globalProductName}</div>
                          <div className="text-[11px] font-bold text-emerald-700">
                            ${(item.amount || globalPrice).toFixed(2)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wide inline-flex items-center gap-1 ${
                              item.status === "success"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.status === "error"
                                ? "bg-red-100 text-red-800"
                                : item.status === "processing"
                                ? "bg-blue-100 text-blue-800 animate-pulse"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.status === "processing" && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            {item.status}
                          </span>
                          {item.errorMessage && (
                            <div className="text-[10px] text-red-600 mt-0.5 line-clamp-1">
                              {item.errorMessage}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {item.invoiceUrl && (
                            <a
                              href={item.invoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
