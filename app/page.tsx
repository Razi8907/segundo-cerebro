"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "#ffffff",
        color: "#1a1a1a",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      <div style={{ width: "100%", maxWidth: 640, padding: "2rem 1rem" }}>
        {/* Hero */}
        <div
          style={{
            position: "relative",
            padding: "3.5rem 2rem 2.5rem",
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, #d4001a08, #003f8a08)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#888",
              fontWeight: 500,
              marginBottom: "0.75rem",
            }}
          >
            Regional Commercial Operations
          </div>

          {/* Flags */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 0,
              marginBottom: "2rem",
            }}
          >
            {/* Paraguay flag */}
            <div style={{ transform: "rotate(-4deg) translateX(16px)", zIndex: 1 }}>
              <div
                style={{
                  width: 88,
                  height: 58,
                  borderRadius: 4,
                  overflow: "hidden",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                  display: "flex",
                  flexDirection: "column",
                  border: "0.5px solid rgba(0,0,0,0.1)",
                }}
              >
                <div style={{ flex: 1, background: "#D52B1E" }} />
                <div
                  style={{
                    flex: 1,
                    background: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: 11, color: "#009B3A" }}>&#9733;</span>
                </div>
                <div style={{ flex: 1, background: "#0038A8" }} />
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#cccccc",
                margin: "0 1.5rem",
                flexShrink: 0,
                zIndex: 2,
              }}
            />

            {/* Argentina flag */}
            <div style={{ transform: "rotate(4deg) translateX(-16px)", zIndex: 1 }}>
              <div
                style={{
                  width: 88,
                  height: 58,
                  borderRadius: 4,
                  overflow: "hidden",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                  display: "flex",
                  flexDirection: "column",
                  border: "0.5px solid rgba(0,0,0,0.1)",
                }}
              >
                <div style={{ flex: 1, background: "#74ACDF" }} />
                <div
                  style={{
                    flex: 1,
                    background: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <circle cx="7" cy="7" r="3" fill="#F6B40E" />
                    <g stroke="#F6B40E" strokeWidth="1">
                      <line x1="7" y1="0" x2="7" y2="4" />
                      <line x1="7" y1="10" x2="7" y2="14" />
                      <line x1="0" y1="7" x2="4" y2="7" />
                      <line x1="10" y1="7" x2="14" y2="7" />
                      <line x1="2" y1="2" x2="4.8" y2="4.8" />
                      <line x1="9.2" y1="9.2" x2="12" y2="12" />
                      <line x1="12" y1="2" x2="9.2" y2="4.8" />
                      <line x1="4.8" y1="9.2" x2="2" y2="12" />
                    </g>
                  </svg>
                </div>
                <div style={{ flex: 1, background: "#74ACDF" }} />
              </div>
            </div>
          </div>

          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.6rem, 5vw, 2.4rem)",
              fontWeight: 700,
              color: "#1a1a1a",
              lineHeight: 1.2,
              marginBottom: "0.4rem",
            }}
          >
            Dashboard de Seguimiento
            <br />
            Country
          </div>
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 300,
              color: "#555",
              letterSpacing: "0.06em",
              marginBottom: "2rem",
            }}
          >
            Raziel Busto Domaniczky
          </div>

          {/* Metrics */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: "2rem",
            }}
          >
            <div
              style={{
                background: "#f5f5f3",
                borderRadius: 8,
                padding: "0.75rem 1.25rem",
                minWidth: 100,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#999",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Paraguay
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 500, color: "#0038A8" }}>PY</div>
            </div>
            <div
              style={{
                background: "#f5f5f3",
                borderRadius: 8,
                padding: "0.75rem 1.25rem",
                minWidth: 100,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#999",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Argentina
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 500, color: "#D52B1E" }}>AR</div>
            </div>
            <div
              style={{
                background: "#f5f5f3",
                borderRadius: 8,
                padding: "0.75rem 1.25rem",
                minWidth: 100,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#999",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Mercados
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 500, color: "#1a1a1a" }}>2</div>
            </div>
          </div>
        </div>

        {/* Navigation Cards */}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            flexWrap: "wrap",
            padding: "0 1rem 2rem",
          }}
        >
          <Link
            href="/paraguay"
            style={{
              flex: "1 1 140px",
              maxWidth: 180,
              background: "#ffffff",
              border: "0.5px solid #e0e0e0",
              borderRadius: 12,
              padding: "1rem",
              cursor: "pointer",
              textAlign: "left",
              textDecoration: "none",
              display: "block",
              transition: "border-color 0.15s, background 0.15s",
            }}
            className="landing-card"
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10,
                fontSize: 13,
                fontWeight: 500,
                background: "#EEF2FF",
                color: "#0038A8",
              }}
            >
              PY
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a", marginBottom: 2 }}>
              Paraguay
            </div>
            <div style={{ fontSize: 11, color: "#999" }}>Seguimiento comercial</div>
          </Link>

          <Link
            href="/argentina"
            style={{
              flex: "1 1 140px",
              maxWidth: 180,
              background: "#ffffff",
              border: "0.5px solid #e0e0e0",
              borderRadius: 12,
              padding: "1rem",
              cursor: "pointer",
              textAlign: "left",
              textDecoration: "none",
              display: "block",
              transition: "border-color 0.15s, background 0.15s",
            }}
            className="landing-card"
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10,
                fontSize: 13,
                fontWeight: 500,
                background: "#FFF0F0",
                color: "#D52B1E",
              }}
            >
              AR
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a", marginBottom: 2 }}>
              Argentina
            </div>
            <div style={{ fontSize: 11, color: "#999" }}>Seguimiento comercial</div>
          </Link>
        </div>

        {/* Status bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "#aaa",
            paddingBottom: "1rem",
          }}
        >
          <span
            className="dot-live-landing"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#3B6D11",
            }}
          />
          <span>Activo &middot; Q2 2026</span>
        </div>
      </div>

      <style jsx>{`
        .landing-card:hover {
          border-color: #aaaaaa !important;
          background: #f9f9f7 !important;
        }
        .dot-live-landing {
          animation: pulse-landing 2s infinite;
        }
        @keyframes pulse-landing {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
