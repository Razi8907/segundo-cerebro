"use client";

import { useState } from "react";
import ProveedorSeguimiento from "./ProveedorSeguimiento";
import StockTop50 from "./StockTop50";
import GuiasNoDespachadas from "./GuiasNoDespachadas";

export default function ProveedoresPanel({ country, mes }: { country: "ar" | "py"; mes: string }) {
  const [tab, setTab] = useState<"ordenes" | "guias" | "stock">("ordenes");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([
          { k: "ordenes" as const, label: "📦 Órdenes en poder del proveedor" },
          { k: "guias" as const, label: "🚚 Guías no despachadas" },
          { k: "stock" as const, label: "📊 Stock Top 50" },
        ]).map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`text-xs px-4 py-2 rounded-full border transition-all ${
              tab === t.k
                ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
                : "bg-transparent t-secondary border-gray-700 hover:border-orange-500/40 hover:text-orange-300"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "ordenes" ? <ProveedorSeguimiento country={country} />
        : tab === "guias" ? <GuiasNoDespachadas country={country} />
        : <StockTop50 country={country} mes={mes} />}
    </div>
  );
}
