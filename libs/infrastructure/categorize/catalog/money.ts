import type { MerchantEntry } from "@domain/services/merchant-catalog";

/**
 * Money moving rather than being spent: fees, tax, savings, income, cash.
 *
 * Mostly wording rather than merchants, which is why priorities appear here
 * and almost nowhere else. The generic incoming-transfer patterns at 250 are
 * the last thing tried: any named merchant, and any rule you wrote, is a
 * better answer than "money arrived".
 */
export const MONEY: MerchantEntry[] = [
  // ── Frais bancaires ────────────────────────────────────────────────────
  { key: "bank-fees", name: "Frais bancaires", kind: "bank_fee", patterns: ["FRAIS BANCAIRES", "COTISATION CARTE", "AGIOS", "FRAIS DE DOSSIER", "FRAIS COND", "COMMISSION INTERVENTION", "FRAIS TENUE DE COMPTE"] },
  // Negative only: an incoming apport may read "VIR INTERETS CREDIT …".
  { key: "loan-interest", name: "Intérêts de crédit", kind: "bank_fee", patterns: ["INTERETS CREDIT"], amountCondition: "negative" },
  { key: "neobanks", name: "Néobanques", kind: "bank_fee", patterns: ["BOURSORAMA", "FORTUNEO", "HELLO BANK", "REVOLUT", "MONABANQ", "QONTO", "N26", "LYDIA"] },

  // ── Impôts ─────────────────────────────────────────────────────────────
  { key: "dgfip", name: "DGFiP", kind: "tax", patterns: ["DGFIP", "TRESOR PUBLIC", "DIRECTION GENERALE DES"] },
  { key: "tax-generic", name: "Impôts & taxes", kind: "tax", patterns: ["IMPOT", "TAXE FONCIERE", "TAXE HABITATION", "URSSAF"] },
  { key: "antai", name: "Amendes (ANTAI)", kind: "tax", patterns: ["ANTAI", "AMENDE"] },

  // ── Épargne ────────────────────────────────────────────────────────────
  { key: "savings-generic", name: "Épargne", kind: "savings", patterns: ["LIVRET", "ASSURANCE VIE", "VIREMENT EPARGNE", "PLAN EPARGNE"] },

  // ── Revenus ────────────────────────────────────────────────────────────
  { key: "salary", name: "Salaire", kind: "income", patterns: ["SALAIRE", "VIR SEPA SALAIRE", "REMUNERATION", "BULLETIN DE PAIE"], priority: 50 },
  { key: "benefits", name: "Prestations sociales", kind: "income", patterns: ["FRANCE TRAVAIL", "POLE EMPLOI", "CAF DE", "ALLOCATION", "PENSION", "CARSAT", "AGIRC ARRCO"], priority: 50 },
  { key: "urssaf-refund", name: "Remboursement URSSAF", kind: "income", patterns: ["URSSAF REMB"], priority: 50 },
  { key: "cheque-deposit", name: "Remise de chèque", kind: "income", patterns: ["REMISE CHEQUE"], regex: "^REM CHQ", amountCondition: "positive", priority: 60 },
  // The last resort, and only for money coming in.
  { key: "incoming-transfer", name: "Virement entrant (générique)", kind: "income", patterns: ["VIREMENT", "VIR SEPA"], regex: "^VIR\\b", amountCondition: "positive", priority: 250 },

  // ── Retraits ───────────────────────────────────────────────────────────
  { key: "cash-withdrawal", name: "Retrait d'espèces", kind: "cash", patterns: ["RET DAB", "RETRAIT DAB", "RETRAIT ESPECES", "RETRAIT CB"] },
];
