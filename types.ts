export interface TvaBreakdown {
  rate: number;
  baseHT: number;
  amount: number;
}

export interface Invoice {
  id: string;
  fileName: string;
  invoiceNumber: string;
  vendor: string;
  date: string;
  ice: string;
  if_fiscal: string; // Identifiant Fiscal
  amountHT: number;
  amountTTC: number;
  tvaRate: '10%' | '14%' | '20%' | '0%' | 'Exonéré' | 'Autre';
  tvaBreakdown?: TvaBreakdown[]; // Added to support multiple VAT rates in Excel
  category: string;
  status: 'processed' | 'processing' | 'error';
  rawText?: string;
  timestamp: number;
  type: 'purchase' | 'sale'; // New field to distinguish invoice type
}

export interface BankTransaction {
  id: string;
  date: string; // DD/MM/YYYY
  description: string;
  reference: string;
  debit: number;
  credit: number;
  contraAccount: string; // e.g., 4411, 3421, 6147
}

export interface Vendor {
  name: string;
  ice: string;
  count: number;
  totalSpent: number;
}

export type Language = 'fr' | 'ar';

export interface DashboardStats {
  totalInvoices: number;
  totalSpentTTC: number;
  totalHT: number;
  totalTVA: number;
  topVendor: string;
  topClient: string;
}

export interface User {
  username: string;
  isAuthenticated: boolean;
}