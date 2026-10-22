// GST on what we sell: 18% on training services (SAC 999293), supplied from Uttar Pradesh.
// Pure functions only, so they run in tests and client components alike.

export const GST_RATE = 0.18;
export const SAC_CODE = "999293";
/** Our state code: the first two digits of a GSTIN registered in Uttar Pradesh. */
export const SUPPLIER_STATE_CODE = "09";

/** 15 characters: state code, PAN, entity number, "Z", checksum. Uppercase; callers uppercase what buyers type. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const isGstin = (value: string) => GSTIN_PATTERN.test(value) && value.slice(0, 2) in STATES;

/** A price quoted "+ GST" (rupees), as the paise actually charged. */
export const withGstPaise = (rupees: number) => Math.round(rupees * 100 * (1 + GST_RATE));

/**
 * Splits a GST-inclusive total into taxable value and tax. Intra-state supplies (buyer in
 * our state, or a consumer with no GSTIN, whose place of supply is ours) carry CGST + SGST;
 * a business in another state pays IGST.
 */
export function splitGst(totalPaise: number, buyerGstin?: string | null) {
  const taxablePaise = Math.round(totalPaise / (1 + GST_RATE));
  const taxPaise = totalPaise - taxablePaise;
  const placeOfSupply = buyerGstin ? buyerGstin.slice(0, 2) : SUPPLIER_STATE_CODE;
  if (placeOfSupply !== SUPPLIER_STATE_CODE) {
    return { taxablePaise, cgstPaise: 0, sgstPaise: 0, igstPaise: taxPaise, placeOfSupply };
  }
  const cgstPaise = Math.floor(taxPaise / 2);
  return { taxablePaise, cgstPaise, sgstPaise: taxPaise - cgstPaise, igstPaise: 0, placeOfSupply };
}

/** GST state codes, for "place of supply" on invoices. */
export const STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};

/** Indian financial year (April to March) of a date, India time: "26-27". */
export function financialYear(date: Date) {
  const [y, m] = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${String(start % 100).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** "IAA/26-27/0001": at most 16 characters, as GST invoice numbers must be. */
export const formatInvoiceNumber = (fy: string, n: number) => `IAA/${fy}/${String(n).padStart(4, "0")}`;
