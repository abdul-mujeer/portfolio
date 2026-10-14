export function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function stockLabel(stock: number, lowStockThreshold: number): { text: string; tone: "ok" | "low" | "out" } {
  if (stock === 0) return { text: "Out of stock", tone: "out" };
  if (stock <= lowStockThreshold) return { text: `Only ${stock} left`, tone: "low" };
  return { text: "In stock", tone: "ok" };
}
