/** "₹99", "₹9.90", "₹1,499". Paise in; safe to use in client components. */
export const formatRupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
