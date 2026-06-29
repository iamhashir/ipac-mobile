/**
 * Pure date/time helpers for the task scheduling UI.
 * Extracted from OrderTasksManagement to keep that file smaller.
 */

export const formatDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatTimeInput = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const buildTaskDateTimeIso = (dateText: string, timeText: string): string | null => {
  const normalizedDate = dateText.trim();
  const normalizedTime = timeText.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) return null;
  if (!/^\d{2}:\d{2}$/.test(normalizedTime)) return null;

  const date = new Date(`${normalizedDate}T${normalizedTime}:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const calculateDurationMinutes = (startIso: string, endIso: string): number => {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / 60000));
};
