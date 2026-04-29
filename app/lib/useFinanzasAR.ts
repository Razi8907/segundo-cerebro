"use client";

import { useEffect, useState, useCallback } from "react";
import { FINANZAS_AR_DEFAULT, type FinanzasARData } from "./finanzas-ar-types";

export function useFinanzasAR() {
  const [data, setData] = useState<FinanzasARData>(FINANZAS_AR_DEFAULT);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finanzas/ar", { cache: "no-store" });
      if (!res.ok) {
        // Si el user no está autenticado, devolvemos defaults sin tirar error
        if (res.status === 401) {
          setData(FINANZAS_AR_DEFAULT);
          setCanEdit(false);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json.data ?? FINANZAS_AR_DEFAULT);
      setUpdatedAt(json.updated_at ?? null);
      setCanEdit(!!json.canEdit);
    } catch (e: any) {
      setError(e?.message || "Error al cargar");
      setData(FINANZAS_AR_DEFAULT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const save = useCallback(
    async (next: FinanzasARData) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/finanzas/ar", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        await refetch();
        return { ok: true as const };
      } catch (e: any) {
        const msg = e?.message || "Error al guardar";
        setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        setSaving(false);
      }
    },
    [refetch],
  );

  return { data, updatedAt, canEdit, loading, saving, error, refetch, save };
}
