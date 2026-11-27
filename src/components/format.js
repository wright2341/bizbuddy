export const money = (amount) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format((Number(amount) || 0) / 100);
export const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "C";
function parseDate(value) {
  if (!value) return null;
  let raw = String(value).trim().replace(/ UTC$/, "Z");
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) raw += "T12:00:00";
  else if (
    /^\d{4}-\d{2}-\d{2}T/.test(raw) &&
    !/(Z|[+-]\d{2}:?\d{2})$/.test(raw)
  )
    raw += "Z";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
export const dateLabel = (value) => {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date)
    : String(value || "—");
};
export const timeLabel = (value) => {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat("en-NG", {
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : "";
};
export const today = () => new Date().toLocaleDateString("en-CA");
export function downloadCSV(name, fields, rows) {
  const escape = (value) => {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const content = [
    fields.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
