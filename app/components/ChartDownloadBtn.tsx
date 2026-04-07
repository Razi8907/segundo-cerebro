"use client";

import { useRef, useState, type ReactNode } from "react";

export default function ChartDownloadBtn({
  children,
  filename,
}: {
  children: ReactNode;
  filename: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!ref.current || downloading) return;
    setDownloading(true);
    try {
      // Dynamic import with explicit path
      const mod = await import("html2canvas");
      const html2canvas = mod.default || mod;
      const canvas = await (html2canvas as any)(ref.current, {
        backgroundColor: "#1a1a2e",
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        removeContainer: true,
      });

      // Use toBlob for more reliable download
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }, "image/png");
    } catch (err) {
      console.error("Chart download error:", err);
      alert("Error al descargar la imagen. Intenta de nuevo.");
    }
    setDownloading(false);
  }

  return (
    <div className="relative">
      <div ref={ref}>{children}</div>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all z-10"
        title="Descargar como imagen"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {downloading ? "Descargando..." : "PNG"}
      </button>
    </div>
  );
}
