"use client";

import { useRef, useState, type ReactNode } from "react";
import { useUser } from "../lib/useUser";

export default function ChartDownloadBtn({
  children,
  filename,
}: {
  children: ReactNode;
  filename: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const { canDownload } = useUser();

  async function handleDownload() {
    if (!ref.current || downloading) return;
    if (!canDownload) {
      alert("No tenés permiso para descargar. Contacta al administrador.");
      return;
    }
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(ref.current, {
        backgroundColor: "#1a1a2e",
        pixelRatio: 2,
        cacheBust: true,
        filter: (node: HTMLElement) => {
          if (node.tagName === "BUTTON" && node.textContent?.includes("PNG")) return false;
          return true;
        },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download error:", err);
      alert("Error al descargar. Intenta de nuevo.");
    }
    setDownloading(false);
  }

  if (!canDownload) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div ref={ref}>
        {children}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all z-10"
          title="Descargar como imagen"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloading ? "..." : "PNG"}
        </button>
      </div>
    </div>
  );
}
