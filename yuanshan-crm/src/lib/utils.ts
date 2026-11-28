import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initialOf(name: string): string {
  if (!name) return "?";
  if (/^[A-Za-z]/.test(name)) return name[0]!.toUpperCase();
  const chars = [...name];
  return chars[name.length > 2 ? 1 : 0] ?? "?";
}

export function monogramOf(company: string): string {
  const trimmed = company.trim();
  if (!trimmed) return "·";
  if (/^[A-Za-z0-9]/.test(trimmed)) {
    const words = trimmed.split(/\s+/).filter(Boolean);
    return (words[0]![0]! + (words[1]?.[0] ?? words[0]![1] ?? "")).toUpperCase();
  }
  return [...trimmed].slice(0, 2).join("");
}

export function atTime(day: Date, hour = 9, minute = 0): string {
  const copy = new Date(day);
  copy.setHours(hour, minute, 0, 0);
  return copy.toISOString();
}

export function daysFromNow(offset: number, hour = 10, minute = 0): string {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  return atTime(day, hour, minute);
}

export function daysAgo(offset: number, hour = 10, minute = 0): string {
  return daysFromNow(-offset, hour, minute);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatNumberRaw(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
