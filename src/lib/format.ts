/** Format a number as Indonesian Rupiah (e.g. Rp 15.000) */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);
}

/** Format a date string to Indonesian locale (e.g. 21 Februari 2026) */
export function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}
