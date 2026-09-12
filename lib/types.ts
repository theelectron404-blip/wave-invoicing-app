export interface Business {
  id: string;
  name: string;
  isPersonal?: boolean;
  currency: {
    code: string;
    symbol: string;
  };
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  currency?: {
    code: string;
  };
}

export interface Product {
  id: string;
  name: string;
  unitPrice: number;
  description?: string;
}

export interface InvoiceLineItem {
  id: string;
  productId?: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceFormData {
  businessId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  items: InvoiceLineItem[];
  memo: string;
  footer: string;
}

export interface EmailDispatchData {
  to: string[];
  subject: string;
  message: string;
  attachPDF: boolean;
}

export interface WaveInputError {
  code: string;
  message: string;
  path: string[];
}

export interface BulkQueueItem {
  id: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  description?: string;
  invoiceNumber?: string;
  status: "pending" | "processing" | "success" | "error";
  invoiceUrl?: string;
  errorMessage?: string;
}

export type InvoicingProvider = "wave" | "quickbooks";

export interface QuickBooksTokens {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  expiresAt: number;
  environment: "sandbox" | "production";
}
