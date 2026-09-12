"use client";

import { useState, useEffect } from "react";
import InvoiceForm from "@/components/InvoiceForm";
import EmailCustomizer from "@/components/EmailCustomizer";
import InvoicePreview from "@/components/InvoicePreview";
import NewCustomerModal from "@/components/NewCustomerModal";
import {
  InvoiceFormData,
  EmailDispatchData,
  Business,
  Customer,
  InvoicingProvider,
} from "@/lib/types";
import {
  Send,
  Save,
  CheckCircle,
  ExternalLink,
  Loader2,
  AlertCircle,
  Copy,
} from "lucide-react";
import { fetchWithQBORefresh } from "@/lib/qbo-fetch";
import Link from "next/link";

export default function HomePage() {
  const [provider, setProvider] = useState<InvoicingProvider>("wave");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Status & Actions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionStatus, setActionStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
    invoiceUrl?: string;
    invoiceId?: string;
  }>({ type: null, message: "" });
  const [copiedLink, setCopiedLink] = useState(false);

  // Form States
  const [formData, setFormData] = useState<InvoiceFormData>({
    businessId: "",
    customerId: "",
    customerName: "",
    customerEmail: "",
    invoiceNumber: "INV-2026-001",
    invoiceDate: "2026-09-12",
    dueDate: "2026-09-26",
    currency: "USD",
    items: [
      {
        id: "1",
        name: "Web Application Development",
        description: "Full-stack web application development and API integration",
        quantity: 1,
        unitPrice: 500,
        amount: 500,
      },
    ],
    memo: "Thank you for your business!",
    footer: "Payment is due within 14 days.",
  });

  const [emailData, setEmailData] = useState<EmailDispatchData>({
    to: [],
    subject: "Invoice from Your Business",
    message:
      "Hi,\n\nPlease find your invoice attached. You can pay securely online using the link in this email.\n\nThank you for working with us!",
    attachPDF: true,
  });

  // Fetch Businesses/Company based on active provider
  const fetchBusinesses = async () => {
    setLoadingInitial(true);
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
          const defaultB = data.businesses[0];
          setSelectedBusiness(defaultB);
          setFormData((prev) => ({
            ...prev,
            businessId: defaultB.id,
            currency: defaultB.currency?.code || "USD",
          }));
          fetchCustomers(defaultB.id, "wave");
        }
      } else {
        // QuickBooks
        const res = await fetchWithQBORefresh("/api/quickbooks/company");
        const data = await res.json();

        if (data.success && data.business) {
          setBusinesses([data.business]);
          setSelectedBusiness(data.business);
          setFormData((prev) => ({
            ...prev,
            businessId: data.business.id,
            currency: data.business.currency?.code || "USD",
          }));
          fetchCustomers(data.business.id, "quickbooks");
        }
      }
    } catch (err) {
      console.error("Error fetching businesses", err);
    } finally {
      setLoadingInitial(false);
    }
  };

  // Fetch Customers
  const fetchCustomers = async (bId: string, prov: InvoicingProvider) => {
    try {
      if (prov === "wave") {
        const customToken = localStorage.getItem("wave_custom_token") || "";
        const res = await fetch(`/api/wave/customers?businessId=${bId}`, {
          headers: customToken ? { "x-wave-token": customToken } : {},
        });
        const data = await res.json();
        if (data.success) setCustomers(data.customers);
      } else {
        const res = await fetchWithQBORefresh("/api/quickbooks/customers");
        const data = await res.json();
        if (data.success) setCustomers(data.customers);
      }
    } catch (err) {
      console.error("Error fetching customers", err);
    }
  };

  useEffect(() => {
    fetchBusinesses();

    const handleProviderChange = () => {
      fetchBusinesses();
    };
    window.addEventListener("providerChanged", handleProviderChange);
    return () => window.removeEventListener("providerChanged", handleProviderChange);
  }, []);

  const handleBusinessChange = (bId: string) => {
    const found = businesses.find((b) => b.id === bId) || null;
    setSelectedBusiness(found);
    setFormData((prev) => ({
      ...prev,
      businessId: bId,
      customerId: "",
      customerName: "",
      customerEmail: "",
      currency: found?.currency?.code || "USD",
    }));
    fetchCustomers(bId, provider);
  };

  const handleCustomerCreated = (newCust: Customer) => {
    setCustomers((prev) => [newCust, ...prev]);
    setFormData((prev) => ({
      ...prev,
      customerId: newCust.id,
      customerName: newCust.name,
      customerEmail: newCust.email || "",
    }));
    if (newCust.email) {
      setEmailData((prev) => ({ ...prev, to: [newCust.email!] }));
    }
  };

  // Create Invoice via Active Provider
  const createInvoiceAPI = async () => {
    if (provider === "wave") {
      const customToken = localStorage.getItem("wave_custom_token") || "";
      const res = await fetch("/api/wave/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customToken ? { "x-wave-token": customToken } : {}),
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create invoice in Wave");
      }
      return data.invoice;
    } else {
      const res = await fetchWithQBORefresh("/api/quickbooks/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          emailSubject: emailData.subject,
          emailMessage: emailData.message,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create invoice in QuickBooks");
      }
      return data.invoice;
    }
  };

  // Handle Save Draft only
  const handleSaveOnly = async () => {
    if (!formData.businessId || (!formData.customerId && !formData.customerName)) {
      setActionStatus({
        type: "error",
        message: "Please provide a Company/Business and Customer Name.",
      });
      return;
    }

    setIsSubmitting(true);
    setActionStatus({ type: null, message: "" });

    try {
      const invoice = await createInvoiceAPI();
      setActionStatus({
        type: "success",
        message: `Invoice #${invoice.invoiceNumber} created successfully in ${
          provider === "quickbooks" ? "QuickBooks" : "Wave"
        }!`,
        invoiceUrl: invoice.viewUrl,
        invoiceId: invoice.id,
      });
    } catch (err: any) {
      setActionStatus({
        type: "error",
        message: err.message || "Failed to create invoice",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Create AND Send via API
  const handleCreateAndSend = async () => {
    if (!formData.businessId || (!formData.customerId && !formData.customerName)) {
      setActionStatus({
        type: "error",
        message: "Please provide a Company/Business and Customer Name.",
      });
      return;
    }

    if (emailData.to.length === 0 && !formData.customerEmail) {
      setActionStatus({
        type: "error",
        message: "Please provide at least one recipient email address.",
      });
      return;
    }

    const recipients =
      emailData.to.length > 0
        ? emailData.to
        : formData.customerEmail
        ? [formData.customerEmail]
        : [];

    setIsSubmitting(true);
    setActionStatus({ type: null, message: "" });

    try {
      // 1. Create Invoice
      const invoice = await createInvoiceAPI();

      // 2. Send via active API
      if (provider === "wave") {
        const customToken = localStorage.getItem("wave_custom_token") || "";
        const sendRes = await fetch("/api/wave/invoices/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(customToken ? { "x-wave-token": customToken } : {}),
          },
          body: JSON.stringify({
            invoiceId: invoice.id,
            to: recipients,
            subject: emailData.subject,
            message: emailData.message,
            attachPDF: emailData.attachPDF,
          }),
        });

        const sendData = await sendRes.json();
        if (!sendRes.ok || !sendData.success) {
          throw new Error(sendData.error || "Invoice created, but failed to send email.");
        }
      } else {
        const sendRes = await fetchWithQBORefresh("/api/quickbooks/invoices/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invoiceId: invoice.id,
            to: recipients,
            subject: emailData.subject,
            message: emailData.message,
          }),
        });

        const sendData = await sendRes.json();
        if (!sendRes.ok || !sendData.success) {
          throw new Error(sendData.error || "QuickBooks invoice created, but failed to send.");
        }
      }

      setActionStatus({
        type: "success",
        message: `Invoice #${invoice.invoiceNumber} created and sent to ${recipients.join(
          ", "
        )} via ${provider === "quickbooks" ? "QuickBooks" : "Wave"}!`,
        invoiceUrl: invoice.viewUrl,
        invoiceId: invoice.id,
      });
    } catch (err: any) {
      setActionStatus({
        type: "error",
        message: err.message || "Failed to complete operation",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPaymentUrl = () => {
    if (actionStatus.invoiceUrl) {
      navigator.clipboard.writeText(actionStatus.invoiceUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Title & Setup Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Create &amp; Send Custom Invoice
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                provider === "quickbooks"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-blue-100 text-blue-800 border border-blue-300"
              }`}
            >
              {provider === "quickbooks" ? "QuickBooks Active" : "Wave Active"}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Build customized invoices and dispatch them with customized email subject and body.
          </p>
        </div>

        <Link
          href="/settings"
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3.5 py-2 rounded-lg border border-slate-300 flex items-center gap-1.5 w-fit transition"
        >
          API Settings &amp; Providers
        </Link>
      </div>

      {/* Action Status Notification */}
      {actionStatus.type && (
        <div
          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            actionStatus.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-3">
            {actionStatus.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="font-medium text-sm">{actionStatus.message}</span>
          </div>

          {actionStatus.invoiceUrl && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyPaymentUrl}
                className="bg-white border border-emerald-300 text-emerald-800 text-xs px-3 py-1.5 rounded-md font-semibold flex items-center gap-1 hover:bg-emerald-100 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedLink ? "Copied!" : "Copy Payment Link"}
              </button>
              <a
                href={actionStatus.invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-md font-semibold flex items-center gap-1 hover:bg-emerald-700 transition"
              >
                View Invoice <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Form + Email vs Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form Area (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <InvoiceForm
            formData={formData}
            setFormData={setFormData}
            customers={customers}
            businesses={businesses}
            selectedBusiness={selectedBusiness}
            onBusinessChange={handleBusinessChange}
            onOpenNewCustomerModal={() => setIsCustomerModalOpen(true)}
          />

          <EmailCustomizer
            emailData={emailData}
            setEmailData={setEmailData}
            customerEmail={formData.customerEmail}
          />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSaveOnly}
              className="flex-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4 text-slate-500" />
              )}
              Save as Draft Only
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreateAndSend}
              className={`flex-1 text-white font-semibold px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md transition disabled:opacity-50 ${
                provider === "quickbooks"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Create &amp; Send ({provider === "quickbooks" ? "QuickBooks" : "Wave"})
            </button>
          </div>
        </div>

        {/* Right Preview Area (5 cols) */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 space-y-4">
            <InvoicePreview
              formData={formData}
              selectedBusiness={selectedBusiness}
            />
          </div>
        </div>
      </div>

      {/* Modal */}
      <NewCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        businessId={formData.businessId}
        onCustomerCreated={handleCustomerCreated}
      />
    </div>
  );
}
