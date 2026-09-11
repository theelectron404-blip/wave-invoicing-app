"use client";

import { InvoiceFormData, Business } from "@/lib/types";
import { FileText, Calendar, CreditCard } from "lucide-react";

interface Props {
  formData: InvoiceFormData;
  selectedBusiness: Business | null;
}

export default function InvoicePreview({
  formData,
  selectedBusiness,
}: Props) {
  const subtotal = formData.items.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex justify-between items-start border-b border-slate-100 pb-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
            Preview
          </span>
          <h3 className="text-2xl font-bold text-slate-900 mt-0.5">INVOICE</h3>
          <p className="text-sm text-slate-500">
            {formData.invoiceNumber || "INV-0001"}
          </p>
        </div>
        <div className="text-right">
          <h4 className="font-bold text-slate-800">
            {selectedBusiness?.name || "Your Business"}
          </h4>
          <p className="text-xs text-slate-500">
            Currency: {selectedBusiness?.currency?.code || "USD"}
          </p>
        </div>
      </div>

      {/* Bill To & Dates */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Billed To
          </p>
          <p className="font-bold text-slate-800">
            {formData.customerName || "Customer Name"}
          </p>
          <p className="text-slate-500 text-xs">
            {formData.customerEmail || "customer@example.com"}
          </p>
        </div>

        <div className="text-right space-y-1">
          <div className="flex justify-end items-center gap-2 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Date: {formData.invoiceDate || "YYYY-MM-DD"}</span>
          </div>
          <div className="flex justify-end items-center gap-2 text-xs font-medium text-slate-700">
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
            <span>Due: {formData.dueDate || "YYYY-MM-DD"}</span>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3">Item / Description</th>
              <th className="p-3 text-center">Qty</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {formData.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="p-3 text-slate-800">
                  {item.description || "Item description"}
                </td>
                <td className="p-3 text-center text-slate-600">
                  {item.quantity}
                </td>
                <td className="p-3 text-right text-slate-600">
                  ${Number(item.unitPrice || 0).toFixed(2)}
                </td>
                <td className="p-3 text-right font-medium text-slate-800">
                  ${Number(item.amount || 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-200">
            <span>Total:</span>
            <span>
              ${subtotal.toFixed(2)} {selectedBusiness?.currency?.code || "USD"}
            </span>
          </div>
        </div>
      </div>

      {/* Notes & Footer */}
      {(formData.memo || formData.footer) && (
        <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
          {formData.memo && (
            <p>
              <strong className="text-slate-700">Note:</strong> {formData.memo}
            </p>
          )}
          {formData.footer && (
            <p className="text-slate-400 italic">{formData.footer}</p>
          )}
        </div>
      )}
    </div>
  );
}
