import * as XLSX from 'xlsx';
import { Invoice, BankTransaction } from '../types';

// Standard Column Structure - Adapted for JBS 2025
const createRow = (
  journal: string, 
  date: string, 
  compte: string, 
  contrePartie: string, 
  libelle: string, 
  piece: string, 
  lettrage: string, 
  debit: number | string, 
  credit: number | string
) => ({
  "Code journal": journal,
  "Date écriture": date,
  "N° de compte": compte, // Capital N for JBS Compatibility
  "Contre partie": contrePartie,
  "Libellé d'écriture": libelle, 
  "N° de pièce": piece,
  "Lettrage": lettrage,
  "Débit": debit,
  "Crédit": credit
});

// Configure column widths for professional look
const setColumnWidths = (worksheet: XLSX.WorkSheet) => {
  worksheet['!cols'] = [
    { wch: 12 }, // Code journal
    { wch: 15 }, // Date
    { wch: 15 }, // N° de compte
    { wch: 12 }, // Contre partie
    { wch: 50 }, // Libellé
    { wch: 15 }, // N° de pièce
    { wch: 10 }, // Lettrage
    { wch: 15 }, // Débit
    { wch: 15 }, // Crédit
  ];
};

// Helper to parse dates securely
const parseDate = (dateStr: string): number => {
  if (!dateStr) return 0;
  try {
    // Handle DD/MM/YYYY
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
         const d = parseInt(parts[0], 10);
         const m = parseInt(parts[1], 10) - 1;
         const y = parseInt(parts[2], 10);
         const date = new Date(y, m, d);
         if (!isNaN(date.getTime())) return date.getTime();
      }
    }
    // Handle standard formats
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  } catch (e) {
    return 0;
  }
};

// Helper to find account in PCM list or return default
const getAccount = (pcmList: any[], targetCode: string, defaultCode: string): string => {
    if (!pcmList || pcmList.length === 0) return defaultCode;
    
    // 1. Try exact match
    const exact = pcmList.find(p => p.code === targetCode);
    if (exact) return exact.code;

    // 2. Try matching the root (e.g. searching for 6122... in list)
    if (targetCode.length >= 4) {
        const root = targetCode.substring(0, 4);
        const match = pcmList.find(p => p.code.startsWith(root));
        if (match) return match.code;
    }

    return defaultCode;
};

// Helper to sanitize vendor names and libelles
const sanitizeString = (str: string): string => {
    if (!str) return "";
    let clean = str.toString().trim();
    if (clean.toLowerCase() === 'error') return "Inconnu";
    return clean;
};

/**
 * Reads an Excel file
 */
export const readExcelFile = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'dd/mm/yyyy' });
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Export Purchase Journal (Journal des Achats)
 */
export const exportToExcel = (invoices: Invoice[], pcmList: any[]) => {
  try {
    const rows: any[] = [];
    
    // Filter valid invoices only
    const validInvoices = invoices
      .filter(inv => {
         return inv && 
                inv.status !== 'error' && 
                inv.vendor !== 'Error' && 
                inv.amountTTC > 0;
      })
      .sort((a, b) => parseDate(a.date) - parseDate(b.date));

    if (validInvoices.length === 0) {
        alert("Aucune facture valide à exporter.");
        return;
    }

    // Define 10-digit codes
    const COMPTE_ACHAT = getAccount(pcmList, "6122000000", "6122000000"); // ACHATS
    const COMPTE_TVA = getAccount(pcmList, "3455200000", "3455200000");   // TVA RECUP
    const COMPTE_DEFAULT_FRNS = getAccount(pcmList, "4411000000", "4411000000");

    validInvoices.forEach(inv => {
      const codeJournal = "ACH";
      const dateEcriture = inv.date; 
      const numPiece = sanitizeString(inv.invoiceNumber);
      const vendorName = sanitizeString(inv.vendor) || "Fournisseur Inconnu";
      
      const libelle = numPiece 
          ? `Fac N° ${numPiece} - ${vendorName}` 
          : `Fac [Sans N°] - ${vendorName}`;
      
      const amountTTC = Number(inv.amountTTC) || 0;
      // Formula: HT = TTC / 1.2
      const computedHT = Number((amountTTC / 1.2).toFixed(2));
      // Formula: TVA = TTC - HT
      const computedTVA = Number((amountTTC - computedHT).toFixed(2));

      // Determine Supplier Account (Generic for now unless mapped)
      const compteFournisseur = COMPTE_DEFAULT_FRNS;

      // 1. Fournisseur 4411 (TTC) -> Credit
      rows.push(createRow(codeJournal, dateEcriture, compteFournisseur, "", libelle, numPiece, "", "", amountTTC));

      // 2. Charge 6122 (HT) -> Debit
      rows.push(createRow(codeJournal, dateEcriture, COMPTE_ACHAT, "", libelle, numPiece, "", computedHT, ""));

      // 3. TVA 34552 (Diff) -> Debit
      if (computedTVA > 0) {
         rows.push(createRow(codeJournal, dateEcriture, COMPTE_TVA, "", libelle, numPiece, "", computedTVA, ""));
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    setColumnWidths(worksheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Journal_Achats");
    const dateStr = new Date().toISOString().slice(0,10);
    XLSX.writeFile(workbook, `Journal_Achats_${dateStr}.xlsx`);
  } catch (error) {
    console.error("Export Error:", error);
    alert("Une erreur est survenue lors de l'exportation. Vérifiez les données.");
  }
};

/**
 * Export Sales Journal (Journal des Ventes)
 */
export const exportSalesJournal = (invoices: Invoice[], pcmList: any[]) => {
  try {
    const rows: any[] = [];
    
    // Filter valid invoices only
    const validInvoices = invoices
      .filter(inv => {
         return inv && 
                inv.status !== 'error' && 
                inv.vendor !== 'Error' && 
                inv.amountTTC > 0;
      })
      .sort((a, b) => parseDate(a.date) - parseDate(b.date));

    if (validInvoices.length === 0) {
        alert("Aucune facture de vente valide à exporter.");
        return;
    }
    
    // Define 10-digit codes - JBS Standard
    const COMPTE_PRODUIT = getAccount(pcmList, "7124300000", "7124300000"); // VENTES DE MARCHANDISES
    const COMPTE_TVA = getAccount(pcmList, "4455000000", "4455000000");     // ETAT TVA FACTUREE
    const COMPTE_DEFAULT_CLT = getAccount(pcmList, "3421000000", "3421000000"); // CLIENTS

    validInvoices.forEach(inv => {
      const codeJournal = "VTE";
      const dateEcriture = inv.date; 
      const numPiece = sanitizeString(inv.invoiceNumber);
      const clientName = sanitizeString(inv.vendor) || "Client Inconnu";
      
      const libelle = numPiece 
          ? `Fac N° ${numPiece} - ${clientName}` 
          : `Fac [Sans N°] - ${clientName}`;
      
      const amountTTC = Number(inv.amountTTC) || 0;
      // Formula: HT = TTC / 1.2 (Assuming 20% standard if not parsed differently)
      const computedHT = Number((amountTTC / 1.2).toFixed(2));
      // Formula: TVA = TTC - HT
      const computedTVA = Number((amountTTC - computedHT).toFixed(2));

      const compteClient = COMPTE_DEFAULT_CLT;

      // 1. Client 3421 (TTC) -> Debit
      rows.push(createRow(codeJournal, dateEcriture, compteClient, "", libelle, numPiece, "", amountTTC, ""));

      // 2. Vente 71243 (HT) -> Credit
      rows.push(createRow(codeJournal, dateEcriture, COMPTE_PRODUIT, "", libelle, numPiece, "", "", computedHT));

      // 3. TVA 4455 (Diff) -> Credit
      if (computedTVA > 0) {
        rows.push(createRow(codeJournal, dateEcriture, COMPTE_TVA, "", libelle, numPiece, "", "", computedTVA));
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    setColumnWidths(worksheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Journal_Ventes");
    const dateStr = new Date().toISOString().slice(0,10);
    XLSX.writeFile(workbook, `Journal_Ventes_${dateStr}.xlsx`);
  } catch (error) {
    console.error("Export Error:", error);
    alert("Une erreur est survenue lors de l'exportation des ventes.");
  }
};

/**
 * Export Bank Transactions (Journal Banque)
 * Strictly compatible with JBS Import (Excel 5.0/95 format)
 */
export const exportBankStatement = (transactions: BankTransaction[], pcmList: any[]) => {
  try {
    const rows: any[] = [];
    
    // JBS Moroccan Config
    const COMPTE_BANQUE = "5141010000"; // Banque (10 digits)
    const CODE_JOURNAL = "B1";
    const COMPTE_COMMISSION = "6147300000"; // Services bancaires
    const COMPTE_TVA_COMM = "3455200000";   // TVA récupérable sur charges

    if (transactions.length === 0) {
        alert("Aucune transaction bancaire à exporter.");
        return;
    }

    const sortedTransactions = [...transactions].sort((a, b) => parseDate(a.date) - parseDate(b.date));

    sortedTransactions.forEach(tx => {
      if (!tx || (tx.debit === 0 && tx.credit === 0)) return;

      const dateEcriture = tx.date;
      const libelle = sanitizeString(tx.description);
      const amount = tx.debit > 0 ? tx.debit : tx.credit;
      const isDebitOnStatement = tx.debit > 0; // Debit on statement = Bank is credited in accounting

      // Detect Commissions (Frais, Agios, Commissions)
      const isComm = /commission|frais|agios|service bancaire|tenue de compte/i.test(libelle);

      if (isComm && isDebitOnStatement) {
        // Rule: Commissions have 10% TVA
        // 6147300000 (Debit HT = TTC / 1.1)
        // 3455200000 (Debit TVA = TTC - HT)
        // Bank 5141010000 is the Contra Account (implied credit)
        const ttc = amount;
        const ht = Number((ttc / 1.1).toFixed(2));
        const tva = Number((ttc - ht).toFixed(2));

        // 1. Charge (Debit HT)
        rows.push(createRow(CODE_JOURNAL, dateEcriture, COMPTE_COMMISSION, COMPTE_BANQUE, libelle, "", "", ht, 0));
        // 2. TVA (Debit TVA)
        if (tva > 0) {
          rows.push(createRow(CODE_JOURNAL, dateEcriture, COMPTE_TVA_COMM, COMPTE_BANQUE, libelle, "", "", tva, 0));
        }
      } else {
        // Standard Movement (Single Line with Contra)
        let contraAccount = tx.contraAccount || "4411000000";
        // Ensure 10 digits
        if (contraAccount.length < 10) {
            contraAccount = contraAccount.padEnd(10, '0');
        }

        if (isDebitOnStatement) {
          // Bank is Credited (Money leaving) -> Imputation Account is Debited
          rows.push(createRow(CODE_JOURNAL, dateEcriture, contraAccount, COMPTE_BANQUE, libelle, "", "", amount, 0));
        } else {
          // Bank is Debited (Money entering) -> Imputation Account is Credited
          rows.push(createRow(CODE_JOURNAL, dateEcriture, contraAccount, COMPTE_BANQUE, libelle, "", "", 0, amount));
        }
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    setColumnWidths(worksheet); 
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Journal_Banque");
    const dateStr = new Date().toISOString().slice(0,10);
    
    // Export as .xlsx (Most JBS versions accept this, but formatted strictly)
    XLSX.writeFile(workbook, `Import_JBS_Banque_${dateStr}.xlsx`);
  } catch (error) {
    console.error("Export Error:", error);
    alert("Une erreur est survenue lors de l'exportation bancaire.");
  }
};

export const exportBankJournal = (invoices: Invoice[], pcmList: any[]) => {
  // Unused or Simulation Logic
  // Included for compatibility
  exportToExcel(invoices, pcmList); 
};