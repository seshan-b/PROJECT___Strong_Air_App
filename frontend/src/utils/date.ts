// utils/date.ts
// Shared date formatting helpers used across pages.
//
// Why these exist: JavaScript's built-in date formatting is inconsistent across
// browsers. These small functions give us a single, predictable format everywhere.
//
// Formats used in this app:
//   dateToApi      → "2024-05-20"          (what the backend expects for date filters)
//   formatDate     → "20-May-2024"         (human-readable, used in tables and lists)
//   formatDateTime → "20-May-2024 14:30"   (includes time, for clock session records)

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Convert a Date object to "yyyy-mm-dd" for API calls
export const dateToApi = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatDate = (d: string | Date): string => {
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const formatDateTime = (d: string | Date): string => {
  const date = new Date(d);
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(date)} ${hours}:${mins}`;
};
