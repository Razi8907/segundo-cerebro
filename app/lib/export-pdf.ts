// ═══════════════════════════════════════════════════════════════════
// Exporta a PDF (A4 vertical) las secciones marcadas con [data-pdf-section]
// dentro de `root`. Cada sección se captura como imagen en tema claro y se
// acomoda en hojas con encabezado (bandera + país + título + autor) y pie.
// ═══════════════════════════════════════════════════════════════════

export const AUTOR_DASHBOARD = "Raziel Busto Domaniczky";
export const NOMBRE_DASHBOARD = "Dashboard de Seguimiento Country";

type Pais = "ar" | "py";
const PAIS_NOMBRE: Record<Pais, string> = { ar: "Argentina", py: "Paraguay" };

// Bandera dibujada en canvas (no depende de emojis ni de imágenes externas)
function banderaPng(pais: Pais): string {
  const w = 300, h = 200;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  if (pais === "ar") {
    g.fillStyle = "#74ACDF"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#FFFFFF"; g.fillRect(0, h / 3, w, h / 3);
    // Sol de Mayo
    const cx = w / 2, cy = h / 2;
    g.strokeStyle = "#F6B40E"; g.lineWidth = 3;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2, r1 = 18, r2 = i % 2 ? 30 : 34;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
    }
    g.fillStyle = "#F6B40E"; g.beginPath(); g.arc(cx, cy, 17, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#843511"; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 17, 0, Math.PI * 2); g.stroke();
  } else {
    g.fillStyle = "#D52B1E"; g.fillRect(0, 0, w, h / 3);
    g.fillStyle = "#FFFFFF"; g.fillRect(0, h / 3, w, h / 3);
    g.fillStyle = "#0038A8"; g.fillRect(0, (2 * h) / 3, w, h / 3);
    // Escudo simplificado: anillo con estrella
    const cx = w / 2, cy = h / 2;
    g.strokeStyle = "#0038A8"; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = "#2E8B57"; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 20, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#F6B40E"; g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 5 : 12;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath(); g.fill();
  }
  g.strokeStyle = "#9ca3af"; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  return c.toDataURL("image/png");
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dimensiones = (src: string) => new Promise<{ w: number; h: number }>((res, rej) => {
  const img = new Image();
  img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
  img.onerror = rej;
  img.src = src;
});

export async function exportarSeccionesPdf({
  root, pais, titulo, periodo, archivo,
}: {
  root: HTMLElement;
  pais: Pais;
  titulo: string;   // "Resumen Q3 2026"
  periodo: string;  // "Julio – Septiembre 2026"
  archivo: string;  // sin extensión
}) {
  const [{ jsPDF }, { toPng }] = await Promise.all([import("jspdf"), import("html-to-image")]);
  const secciones = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-section]"));
  if (secciones.length === 0) throw new Error("No hay secciones para exportar");

  // Captura en tema claro (se ve mejor impreso) y vuelve al tema que tenía la persona
  const html = document.documentElement;
  const eraOscuro = html.classList.contains("dark");
  const imagenes: { src: string; w: number; h: number }[] = [];
  try {
    if (eraOscuro) { html.classList.remove("dark"); await esperar(400); }
    for (const el of secciones) {
      const src = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        filter: (n) => !(n instanceof HTMLElement && n.dataset.pdfIgnore !== undefined),
      });
      imagenes.push({ src, ...(await dimensiones(src)) });
    }
  } finally {
    if (eraOscuro) html.classList.add("dark");
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const PW = 210, PH = 297, M = 12, HEADER = 26, FOOTER = 10;
  const anchoUtil = PW - 2 * M;
  const altoUtil = PH - M - HEADER - FOOTER - M;
  const bandera = banderaPng(pais);
  const generado = new Date().toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const encabezado = () => {
    pdf.addImage(bandera, "PNG", M, M, 18, 12);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.setTextColor(17, 17, 17);
    pdf.text(`${NOMBRE_DASHBOARD} — ${PAIS_NOMBRE[pais]}`, M + 22, M + 5);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setTextColor(90, 90, 90);
    pdf.text(`${titulo} · ${periodo}`, M + 22, M + 10.5);
    pdf.setFontSize(8.5);
    pdf.text(`Seguimiento de ${AUTOR_DASHBOARD}`, M + 22, M + 15);
    pdf.setFontSize(7.5); pdf.setTextColor(130, 130, 130);
    pdf.text(`Generado: ${generado}`, PW - M, M + 5, { align: "right" });
    pdf.setDrawColor(249, 115, 22); pdf.setLineWidth(0.8);
    pdf.line(M, M + HEADER - 6, PW - M, M + HEADER - 6);
  };

  let y = M + HEADER;
  encabezado();
  for (const img of imagenes) {
    let w = anchoUtil;
    let h = (img.h / img.w) * w;
    if (h > altoUtil) { h = altoUtil; w = (img.w / img.h) * h; }
    if (y + h > M + HEADER + altoUtil) {
      pdf.addPage();
      encabezado();
      y = M + HEADER;
    }
    pdf.addImage(img.src, "PNG", M + (anchoUtil - w) / 2, y, w, h, undefined, "FAST");
    y += h + 4;
  }

  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(130, 130, 130);
    pdf.text(`${NOMBRE_DASHBOARD} · ${PAIS_NOMBRE[pais]} · ${AUTOR_DASHBOARD}`, M, PH - M + 4);
    pdf.text(`Página ${i} de ${total}`, PW - M, PH - M + 4, { align: "right" });
  }
  pdf.save(`${archivo}.pdf`);
}
