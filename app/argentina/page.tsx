import Link from "next/link";

export default function ArgentinaDashboard() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#1a1a2e" }}>
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          Volver al inicio
        </Link>
        <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center text-2xl font-bold text-white" style={{ background: "linear-gradient(135deg, #74ACDF, #F6B40E)" }}>
          AR
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Dropi Argentina</h1>
        <p className="text-gray-400 text-sm mb-6">Dashboard en construccion</p>
        <p className="text-gray-500 text-xs">Subi los archivos de Argentina para activar este dashboard</p>
      </div>
    </div>
  );
}
