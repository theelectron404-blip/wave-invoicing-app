"use client";

import { Plus, Trash2, UserPlus, Users } from "lucide-react";
import { InvoiceFormData, Customer, Business } from "@/lib/types";

interface Props {
  formData: InvoiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<InvoiceFormData>>;
  customers: Customer[];
  businesses: Business[];
  selectedBusiness: Business | null;
  onBusinessChange: (bId: string) => void;
  onOpenNewCustomerModal: () => void;
}

export default function InvoiceForm({
  formData,
  setFormData,
  customers,
  businesses,
  selectedBusiness,
  onBusinessChange,
  onOpenNewCustomerModal,
}: Props) {
  const handleItemChange = (
    index: number,
    field: string,
    value: string | number
  ) => {
    const updated = [...formData.items];
    const item = { ...updated[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      item.amount = Number(item.quantity || 0) * Number(item.unitPrice || 0);
    }
    updated[index] = item;
    setFormData((prev) => ({ ...prev, items: updated }));
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: Math.random().toString(),
          name: "",
          description: "",
          quantity: 1,
          unitPrice: 0,
          amount: 0,
        },
      ],
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleCustomerSelect = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (cust) {
      setFormData((prev) => ({
        ...prev,
        customerId: cust.id,
        customerName: cust.name,
        customerEmail: cust.email || "",
      }));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4">
        1. Invoice & Customer Details
      </h2>

      {/* Business & Customer Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Wave Business
          </label>
          <select
            value={formData.businessId}
            onChange={(e) => onBusinessChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {businesses.length === 0 ? (
              <option value="">No businesses found / Loading...</option>
            ) : (
              businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.currency?.code || "USD"})
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-semibold text-slate-700">
              Customer Name *
            </label>
            <button
              type="button"
              onClick={onOpenNewCustomerModal}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" /> Quick Modal
            </button>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              placeholder="e.g. Acme Corp or John Doe (Auto-created in Wave)"
              value={formData.customerName}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  customerId: "",
                  customerName: e.target.value,
                }))
              }
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />

            {customers.length > 0 && (
              <select
                value={formData.customerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-md p-1.5 text-xs text-slate-600 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- Or pick from existing {customers.length} Wave customers --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.email ? `(${c.email})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Meta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Invoice Number
          </label>
          <input
            type="text"
            value={formData.invoiceNumber}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, invoiceNumber: e.target.value }))
            }
            placeholder="INV-001"
            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Invoice Date
          </label>
          <input
            type="date"
            value={formData.invoiceDate}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, invoiceDate: e.target.value }))
            }
            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Due Date
          </label>
          <input
            type="date"
            value={formData.dueDate}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
            }
            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Products & Line Items */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex justify-between items-center mb-3">
          <label className="block text-sm font-bold text-slate-800">
            Invoice Line Items / Products
          </label>
          <button
            type="button"
            onClick={addItem}
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-3 py-1.5 rounded-md flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>

        <div className="space-y-3">
          {formData.items.map((item, index) => (
            <div
              key={item.id || index}
              className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-3 rounded-lg border border-slate-200"
            >
              <div className="col-span-12 sm:col-span-5">
                <input
                  type="text"
                  placeholder="Item Name / Description"
                  value={item.description}
                  onChange={(e) =>
                    handleItemChange(index, "description", e.target.value)
                  }
                  className="w-full border border-slate-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>

              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  placeholder="Qty"
                  min="1"
                  value={item.quantity}
                  onChange={(e) =>
                    handleItemChange(index, "quantity", Number(e.target.value))
                  }
                  className="w-full border border-slate-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-center"
                />
              </div>

              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  placeholder="Price"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) =>
                    handleItemChange(index, "unitPrice", Number(e.target.value))
                  }
                  className="w-full border border-slate-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-right"
                />
              </div>

              <div className="col-span-3 sm:col-span-2 text-right font-medium text-slate-700 text-sm">
                ${(item.amount || 0).toFixed(2)}
              </div>

              <div className="col-span-1 text-center">
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={formData.items.length <= 1}
                  className="text-slate-400 hover:text-red-600 disabled:opacity-30 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Memos & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Customer Memo / Notes
          </label>
          <textarea
            rows={2}
            value={formData.memo}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, memo: e.target.value }))
            }
            placeholder="Thank you for your business!"
            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Footer Text
          </label>
          <textarea
            rows={2}
            value={formData.footer}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, footer: e.target.value }))
            }
            placeholder="Payment due within 15 days of invoice date."
            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
