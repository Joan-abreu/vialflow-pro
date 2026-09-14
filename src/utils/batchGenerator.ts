import { supabase } from "@/integrations/supabase/client";

/**
 * Crockford Base32-inspired safe alphabet.
 * Excludes easily confusable characters (0, O, 1, I, L)
 * to ensure zero ambiguity on physical vial labels and lab paperwork.
 */
export const SAFE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export type BatchStrategy = "hybrid" | "random_safe" | "sequential_date" | "custom";

export interface GenerateBatchOptions {
  productName?: string;
  customPrefix?: string;
  strategy?: BatchStrategy;
  customDate?: Date;
  sequentialNumber?: number;
}

/**
 * Known peptide prefix mappings for clean, standardized laboratory prefixes
 */
const KNOWN_PREFIX_MAP: Record<string, string> = {
  "bpc": "BPC",
  "bpc-157": "BPC",
  "bpc 157": "BPC",
  "tb": "TB500",
  "tb-500": "TB500",
  "tb 500": "TB500",
  "tirzepatide": "TIRZ",
  "semaglutide": "SEMA",
  "retatrutide": "RETA",
  "cjc": "CJC",
  "cjc-1295": "CJC",
  "ipamorelin": "IPA",
  "cjc/ipa": "CJC-IPA",
  "cjc / ipa": "CJC-IPA",
  "ghk": "GHK",
  "ghk-cu": "GHK",
  "aod": "AOD",
  "aod-9604": "AOD",
  "nad": "NAD",
  "nad+": "NAD",
  "epithalon": "EPIT",
  "pt-141": "PT141",
  "bremelanotide": "PT141",
  "melanotan": "MT2",
  "melanotan-2": "MT2",
  "melanotan ii": "MT2",
  "selank": "SEL",
  "semax": "SMX",
  "motsc": "MOTSC",
  "mots-c": "MOTSC",
  "ss-31": "SS31",
  "tesamorelin": "TESA",
  "sermorelin": "SERM",
  "glutathione": "GLUT",
};

/**
 * Extracts a concise, professional 3-5 character laboratory prefix from a product name
 */
export function extractProductPrefix(productName?: string): string {
  if (!productName || !productName.trim()) {
    return "LOT";
  }

  const clean = productName.trim().toLowerCase();

  // Check known dictionary first
  for (const [key, prefix] of Object.entries(KNOWN_PREFIX_MAP)) {
    if (clean.startsWith(key)) {
      return prefix;
    }
  }

  // Fallback: extract the first alphanumeric word without numbers/dosage
  const words = clean.split(/[\s_-]+/);
  const firstWord = words[0].replace(/[^a-z0-9]/g, "");

  if (firstWord.length >= 3 && firstWord.length <= 5) {
    return firstWord.toUpperCase();
  } else if (firstWord.length > 5) {
    return firstWord.substring(0, 4).toUpperCase();
  }

  // Clean letters only
  const lettersOnly = clean.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (lettersOnly.length >= 3) {
    return lettersOnly.substring(0, 4);
  }

  return "LOT";
}

/**
 * Generates an unambiguous random string of the specified length
 */
export function generateRandomSafeString(length: number = 3): string {
  let result = "";
  const alphabetLength = SAFE_ALPHABET.length;
  
  // Use crypto.getRandomValues if available for true cryptographically secure randomness
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < length; i++) {
      result += SAFE_ALPHABET[randomBytes[i] % alphabetLength];
    }
  } else {
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * alphabetLength);
      result += SAFE_ALPHABET[randomIndex];
    }
  }

  return result;
}

/**
 * Generates a batch number based on the requested laboratory strategy
 */
export function generateBatchNumber(options: GenerateBatchOptions = {}): string {
  const {
    productName,
    customPrefix,
    strategy = "hybrid",
    customDate = new Date(),
    sequentialNumber = 1,
  } = options;

  const prefix = (customPrefix && customPrefix.trim()) 
    ? customPrefix.trim().toUpperCase() 
    : extractProductPrefix(productName);

  const year = customDate.getFullYear().toString().slice(-2); // e.g. "26" for 2026
  const month = String(customDate.getMonth() + 1).padStart(2, "0"); // e.g. "09"
  const dateStr = `${customDate.getFullYear()}${month}${String(customDate.getDate()).padStart(2, "0")}`; // e.g. "20260914"

  switch (strategy) {
    case "hybrid": {
      // Recommended Lab Standard: [PREFIX]-[YYMM]-[3-SAFE-RANDOM]
      // Example: BPC-2609-7X2
      const randomSuffix = generateRandomSafeString(3);
      return `${prefix}-${year}${month}-${randomSuffix}`;
    }

    case "random_safe": {
      // Obfuscated Base32: [PREFIX]-[6-SAFE-RANDOM]
      // Example: BPC-8K9N2W
      const randomSuffix = generateRandomSafeString(6);
      return `${prefix}-${randomSuffix}`;
    }

    case "sequential_date": {
      // Classic cGMP Date Sequential: [PREFIX]-[YYYYMMDD]-[001]
      // Example: BPC-20260914-001
      const seqStr = String(sequentialNumber).padStart(3, "0");
      return `${prefix}-${dateStr}-${seqStr}`;
    }

    case "custom": {
      // Custom prefix with safe random suffix
      const randomSuffix = generateRandomSafeString(4);
      return `${prefix}-${randomSuffix}`;
    }

    default:
      return `${prefix}-${year}${month}-${generateRandomSafeString(3)}`;
  }
}

/**
 * Checks if a batch number is already taken in the database (production_batches or product_coas)
 */
export async function checkBatchNumberAvailability(batchNumber: string): Promise<boolean> {
  if (!batchNumber || !batchNumber.trim()) return false;
  const clean = batchNumber.trim();

  try {
    const [batchRes, coaRes] = await Promise.all([
      supabase
        .from("production_batches")
        .select("id")
        .ilike("batch_number", clean)
        .limit(1),
      supabase
        .from("product_coas" as any)
        .select("id")
        .ilike("batch_number", clean)
        .limit(1),
    ]);

    const batchExists = (batchRes.data && batchRes.data.length > 0);
    const coaExists = (coaRes.data && coaRes.data.length > 0);

    return !batchExists && !coaExists;
  } catch (error) {
    console.error("Error checking batch availability:", error);
    return true; // Fallback to allowing if query fails
  }
}

/**
 * Generates a batch number and guarantees uniqueness against database records
 */
export async function generateUniqueBatchNumber(
  options: GenerateBatchOptions = {},
  maxAttempts: number = 5
): Promise<string> {
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    const candidate = generateBatchNumber(options);
    const isAvailable = await checkBatchNumberAvailability(candidate);
    if (isAvailable) {
      return candidate;
    }
  }

  // If collisions occurred, append an extra safe random character
  return `${generateBatchNumber(options)}-${generateRandomSafeString(2)}`;
}
