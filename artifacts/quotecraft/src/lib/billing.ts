import {
  getGetBillingStatusQueryKey,
  useGetBillingStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export type LimitAction =
  | "newQuotes"
  | "voiceEdits"
  | "emailsSent"
  | "pdfDownloads"
  | "templates";

/**
 * Returns the limited action when an API error is the standard 402
 * LIMIT_REACHED response, otherwise null.
 */
export function limitReachedAction(err: unknown): LimitAction | null {
  const e = err as {
    status?: number;
    data?: { code?: string; action?: string };
  } | null;
  if (e?.status === 402 && e?.data?.code === "LIMIT_REACHED") {
    return (e.data.action as LimitAction) ?? "newQuotes";
  }
  return null;
}

/** Shared billing status query (plan, credits, usage, limits, packs). */
export function useBilling() {
  return useGetBillingStatus({
    query: { queryKey: getGetBillingStatusQueryKey(), staleTime: 30_000 },
  });
}

export function useInvalidateBilling() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: getGetBillingStatusQueryKey() });
}

export function formatAud(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
}
