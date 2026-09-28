import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Ghep class Tailwind, tu dong xu ly xung dot */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
