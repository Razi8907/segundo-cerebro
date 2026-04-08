"use client";

import { useState, useEffect } from "react";

// Import static JSON as fallback
import pyFallback from "../../data/dashboard_data.json";
import arFallback from "../../data/dashboard_data_argentina.json";

const fallbacks: Record<string, any> = { py: pyFallback, ar: arFallback };

export function useDashboardData(country: "py" | "ar") {
  const [data, setData] = useState<any>(fallbacks[country]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/data/${country}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((apiData) => {
        if (apiData && apiData.resumen) {
          setUpdatedAt(apiData._updated_at || null);
          delete apiData._updated_at;
          setData(apiData);
        }
      })
      .catch(() => {
        // Keep using fallback data
      })
      .finally(() => setLoading(false));
  }, [country]);

  return { data, updatedAt, loading };
}
