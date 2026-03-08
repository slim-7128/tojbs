import { GoogleGenAI, Type } from "@google/genai";
import { Invoice, BankTransaction } from "../types";

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper for exponential backoff retry
const generateWithRetry = async (ai: GoogleGenAI, params: any, maxRetries = 5) => {
  let delay = 5000; // Start with 5 seconds to handle strict rate limits (15 RPM)
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      // Check for 429 (Too Many Requests) or 503 (Service Unavailable)
      const isRateLimit = 
        error?.message?.includes('429') || 
        error?.status === 429 || 
        error?.code === 429 || 
        error?.message?.includes('RESOURCE_EXHAUSTED') ||
        error?.toString().includes('429');
        
      const isServerOverload = error?.message?.includes('503') || error?.status === 503;
      
      if ((isRateLimit || isServerOverload) && i < maxRetries - 1) {
        const waitTime = delay * Math.pow(1.5, i); // 5s, 7.5s, 11s, 16s...
        console.warn(`Gemini API busy (attempt ${i + 1}/${maxRetries}). Retrying in ${Math.round(waitTime)}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Gemini API request failed after max retries. Please try fewer files or wait a moment.");
};

export const analyzeInvoice = async (file: File, type: 'purchase' | 'sale' = 'purchase'): Promise<Partial<Invoice>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const base64Data = await fileToGenerativePart(file);

  const personaInstruction = type === 'sale' 
    ? `Tu es un expert comptable marocain utilisant JBS version 2025. Analyse cette FACTURE DE VENTE.
       Règles JBS Ventes :
       - Identifier le CLIENT (Compte 3421). Ignorer l'émetteur (en haut), chercher le client (souvent après "Doit" ou "Client").
       - Identifier les produits (Compte 71243).
       - Identifier la TVA Collectée (Compte 4455).`
    : `Tu es un expert comptable marocain utilisant JBS version 2025. Analyse cette FACTURE D'ACHAT.
       Règles JBS Achats :
       - Identifier le FOURNISSEUR (Compte 4411).
       - Identifier la charge (Compte 61xx).
       - Identifier la TVA Récupérable (Compte 3455).`;

  const prompt = `
    ${personaInstruction}
    
    Tâche : Extraire les données exactes pour l'import JBS.
    Contexte Marocain : Dates JJ/MM/AAAA, Taux TVA (20%, 14%, 10%, 7%), ICE obligatoire.

    Champs requis :
    1. ${type === 'sale' ? 'CLIENT' : 'FOURNISSEUR'} : Nom de la contrepartie.
    2. DATE : Date de la facture.
    3. ICE : ${type === 'sale' ? 'ICE du Client' : 'ICE du Fournisseur'}.
    4. IF : Identifiant Fiscal.
    5. MONTANTS :
       - HT (Hors Taxe)
       - TTC (Total Toutes Taxes Comprises)
       - TVA (Montant total)
    6. TAUX TVA : Taux dominant.
    7. TABLEAU TVA : Détail si plusieurs taux.
    8. N° PIÈCE : Numéro de facture.
    9. CATÉGORIE : Libellé court pour l'écriture (ex: "Vente Marchandises" ou "Achat Fournitures").

    Format de sortie :
    Retourne UNIQUEMENT un objet JSON (pas de Markdown) pour l'interface utilisateur.
  `;

  try {
    const response = await generateWithRetry(ai, {
      model: 'gemini-3-flash-preview',
      contents: {
        role: 'user',
        parts: [
          { inlineData: { mimeType: file.type, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                vendor: { type: Type.STRING, description: type === 'sale' ? "Nom du Client" : "Nom du Fournisseur" },
                date: { type: Type.STRING, description: "JJ/MM/AAAA" },
                ice: { type: Type.STRING },
                if_fiscal: { type: Type.STRING },
                amountHT: { type: Type.NUMBER },
                amountTTC: { type: Type.NUMBER },
                tvaRate: { type: Type.STRING },
                category: { type: Type.STRING },
                invoiceNumber: { type: Type.STRING },
                tvaBreakdown: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      rate: { type: Type.NUMBER },
                      baseHT: { type: Type.NUMBER },
                      amount: { type: Type.NUMBER }
                    }
                  }
                }
            }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text);
    
    // Validate and clean data
    return {
      vendor: data.vendor || "Inconnu",
      date: data.date || new Date().toLocaleDateString('fr-FR'),
      ice: data.ice || "",
      if_fiscal: data.if_fiscal || "",
      amountHT: typeof data.amountHT === 'number' ? data.amountHT : 0,
      amountTTC: typeof data.amountTTC === 'number' ? data.amountTTC : 0,
      tvaRate: data.tvaRate || "20%",
      tvaBreakdown: data.tvaBreakdown || [],
      category: data.category || "Divers",
      invoiceNumber: data.invoiceNumber || "",
      status: 'processed'
    };

  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return {
      vendor: "Error",
      status: 'error',
      amountHT: 0,
      amountTTC: 0,
      invoiceNumber: "",
      tvaBreakdown: []
    };
  }
};

export const analyzeBankStatement = async (file: File): Promise<BankTransaction[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const base64Data = await fileToGenerativePart(file);

  const prompt = `
    Rôle : Tu es un expert comptable marocain utilisant JBS version 2025.
    Tâche : Analyser ce RELEVÉ BANCAIRE marocain et transformer chaque mouvement en écriture comptable.
    
    Instructions :
    1. Extrais chaque ligne de mouvement.
    2. Date : JJ/MM/AAAA.
    3. Libellé : Description claire de l'opération (ex: "Vrnt Ahmed" -> "Virement Ahmed").
    4. Référence : N° de pièce si présent.
    5. Montant : Débit (Sortie) ou Crédit (Entrée).
    6. Compte de Contrepartie (C) : Suggère le compte du Plan Comptable Marocain (10 chiffres) imputable (hors banque).
       - 4411000000 : Fournisseurs (Débit sur relevé)
       - 3421000000 : Clients (Crédit sur relevé)
       - 6147000000 : Frais bancaires / Agios (Débit)
       - 5115000000 : Espèces / Virements de fonds
       - 4710000000 : Si inconnu.
    
    Format de sortie :
    Retourne UNIQUEMENT un tableau JSON d'objets.
  `;

  try {
    const response = await generateWithRetry(ai, {
      model: 'gemini-3-flash-preview',
      contents: {
        role: 'user',
        parts: [
          { inlineData: { mimeType: file.type, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING, description: "DD/MM/YYYY" },
              description: { type: Type.STRING },
              reference: { type: Type.STRING },
              debit: { type: Type.NUMBER },
              credit: { type: Type.NUMBER },
              contraAccount: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const data = JSON.parse(text);
    return data.map((item: any) => ({
      ...item,
      id: Math.random().toString(36).substr(2, 9),
      debit: item.debit || 0,
      credit: item.credit || 0,
      reference: item.reference || "",
      contraAccount: item.contraAccount || "4710000000"
    }));

  } catch (error) {
    console.error("Gemini bank analysis failed:", error);
    return [];
  }
};

export const analyzePCM = async (file: File): Promise<any[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const base64Data = await fileToGenerativePart(file);

  const prompt = `
    Rôle : Expert comptable marocain.
    Tâche : Analyser ce document (Plan Comptable Marocain) et extraire la liste des comptes.
    
    Instructions cruciales :
    1. Extraire le CODE et l'INTITULÉ de chaque compte.
    2. Format Marocain : Les codes doivent être numériques. Si un code est court (ex: 4411), il doit être considéré comme le début d'un compte à 10 chiffres (ex: 4411000000).
    3. Retourne UNIQUEMENT un tableau JSON.
  `;

  try {
     const response = await generateWithRetry(ai, {
      model: 'gemini-3-flash-preview',
      contents: {
        role: 'user',
        parts: [
          { inlineData: { mimeType: file.type, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING },
              label: { type: Type.STRING }
            }
          }
        }
      }
    });
    
    const text = response.text;
    if (!text) return [];
    const data = JSON.parse(text);
    return data.map((item: any) => ({
        ...item,
        class: parseInt(item.code.charAt(0)) || 0
    }));
  } catch(e) {
      console.error("PCM analysis failed:", e);
      return [];
  }
};