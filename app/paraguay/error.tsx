"use client";

import { useEffect } from "react";

export default function ParaguayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Paraguay Error]:", error);
  }, [error]);

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-page)" }}>
      <div className="max-w-3xl mx-auto rounded-xl p-6 border border-red-500/40" style={{ background: "var(--bg-card)" }}>
        <h1 className="text-lg font-bold text-red-400 mb-3">⚠️ Error en Paraguay Dashboard</h1>
        <div className="rounded p-3 mb-3" style={{ background: "var(--bg-input)" }}>
          <p className="text-xs t-secondary mb-1">Mensaje:</p>
          <p className="text-sm font-mono t-primary break-words">{error.message || "Error desconocido"}</p>
        </div>
        {error.digest && (
          <div className="rounded p-3 mb-3" style={{ background: "var(--bg-input)" }}>
            <p className="text-xs t-secondary mb-1">Digest:</p>
            <p className="text-xs font-mono t-primary">{error.digest}</p>
          </div>
        )}
        {error.stack && (
          <details className="rounded p-3 mb-3" style={{ background: "var(--bg-input)" }}>
            <summary className="text-xs t-secondary cursor-pointer">Stack trace</summary>
            <pre className="text-[10px] font-mono t-primary mt-2 overflow-x-auto whitespace-pre-wrap break-all">{error.stack}</pre>
          </details>
        )}
        <div className="flex gap-2">
          <button onClick={() => reset()} className="text-xs px-4 py-2 rounded bg-orange-500 text-white font-medium">🔄 Reintentar</button>
          <a href="/" className="text-xs px-4 py-2 rounded border border-gray-700 t-secondary">← Volver</a>
        </div>
      </div>
    </div>
  );
}
