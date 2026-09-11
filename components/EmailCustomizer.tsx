"use client";

import { Mail, Paperclip, Send, AlertCircle } from "lucide-react";
import { EmailDispatchData } from "@/lib/types";

interface Props {
  emailData: EmailDispatchData;
  setEmailData: React.Dispatch<React.SetStateAction<EmailDispatchData>>;
  customerEmail: string;
}

export default function EmailCustomizer({
  emailData,
  setEmailData,
  customerEmail,
}: Props) {
  const handleEmailsChange = (val: string) => {
    const emails = val
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    setEmailData((prev) => ({ ...prev, to: emails }));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4">
        <Mail className="w-5 h-5 text-blue-600" />
        2. Email Customization & Dispatch
      </h2>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <span>
          Wave API will send this email directly from Wave&apos;s verified mail servers,
          with your custom subject, custom message, and an instant online payment link.
        </span>
      </div>

      <div className="space-y-4">
        {/* Recipient Emails */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-semibold text-slate-700">
              Recipient Email(s)
            </label>
            {customerEmail && (
              <button
                type="button"
                onClick={() =>
                  setEmailData((prev) => ({ ...prev, to: [customerEmail] }))
                }
                className="text-xs text-blue-600 hover:underline"
              >
                Use customer email ({customerEmail})
              </button>
            )}
          </div>
          <input
            type="text"
            value={emailData.to.join(", ")}
            onChange={(e) => handleEmailsChange(e.target.value)}
            placeholder="client@example.com, accounting@example.com"
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <p className="text-xs text-slate-500 mt-1">
            Separate multiple recipient emails with commas.
          </p>
        </div>

        {/* Custom Subject */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Email Subject Line
          </label>
          <input
            type="text"
            value={emailData.subject}
            onChange={(e) =>
              setEmailData((prev) => ({ ...prev, subject: e.target.value }))
            }
            placeholder="Invoice from Your Company"
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Custom Email Message / Body */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Custom Email Message / Body
          </label>
          <textarea
            rows={5}
            value={emailData.message}
            onChange={(e) =>
              setEmailData((prev) => ({ ...prev, message: e.target.value }))
            }
            placeholder="Hi [Name],&#10;&#10;Here is your invoice. You can pay securely online using the link in this email.&#10;&#10;Thank you!"
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-sans focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* PDF Attachment Toggle */}
        <div className="flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id="attachPDF"
            checked={emailData.attachPDF}
            onChange={(e) =>
              setEmailData((prev) => ({ ...prev, attachPDF: e.target.checked }))
            }
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
          />
          <label
            htmlFor="attachPDF"
            className="text-sm font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <Paperclip className="w-4 h-4 text-slate-500" />
            Attach PDF copy of the invoice to the email
          </label>
        </div>
      </div>
    </div>
  );
}
