"use client";

import { useState } from "react";
import OperationsDashboard from "./OperationsDashboard";
import ComparativoProyeccion from "./ComparativoProyeccion";

export default function OperacionesPanel({ country, mes }: { country: "ar" | "py"; mes: string }) {
  const [tab, setTab] = useState<"dashboard" | "comparativo">("dashboard");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([
          { k: "dashboard" as const, label: "🏭 Dashboard operativo" },
          { k: "comparativo" as const, label: "📊 Comparativo + Proyección" },
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
      {tab === "dashboard" ? <OperationsDashboard country={country} /> : <ComparativoProyeccion country={country} mes={mes} />}
    </div>
  );
}
