"use client";

import { createContext, useContext } from "react";

export type ToastEvent = "info" | "warning" | "error" | "success";
export type ToastAPI = {
  notify: (message: string, event: ToastEvent) => void;
  dismiss: () => void;
};
export const ToastContext = createContext<ToastAPI | null>(null);

/** Global action feedback. The root layout supplies ToastProvider. */
export function useToast(): ToastAPI {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast requires ToastProvider");
  return context;
}
