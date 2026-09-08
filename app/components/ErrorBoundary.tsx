"use client";

import React from "react";

// Aísla un subárbol de la UI: si un componente hijo lanza un error al renderizar,
// muestra un cartel con reintento en vez de dejar TODA la página en blanco.
// Así un fallo en una sección (ej. un mes sin data) no tumba el resto del dashboard.
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode; label?: string }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    // Queda en la consola del navegador para diagnóstico.
    console.error("ErrorBoundary capturó un error:", error);
  }

  private reset = () => this.setState({ hasError: false, message: "" });

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card p-6 text-center" style={{ borderTop: "3px solid #ef4444" }}>
          <p className="text-base font-bold t-primary">
            No se pudo mostrar {this.props.label || "esta sección"}
          </p>
          <p className="mt-1 text-sm t-secondary">
            El resto del panel sigue funcionando. Probá recargar; si persiste, avisá con este detalle.
          </p>
          {this.state.message && (
            <p className="mt-2 text-[11px] t-muted break-words">Detalle: {this.state.message}</p>
          )}
          <button
            onClick={this.reset}
            className="mt-3 text-sm px-4 py-2 rounded-lg font-semibold text-white bg-orange-500 hover:opacity-90"
          >
            🔄 Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
