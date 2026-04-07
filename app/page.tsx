"use client";

import Link from "next/link";
import ThemeToggle from "./components/ThemeToggle";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-page)" }}>
      <div className="w-full max-w-2xl py-12">
        {/* Dropi Logo + Title */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl dropi-gradient flex items-center justify-center text-3xl font-bold text-white mx-auto mb-5 shadow-lg shadow-orange-500/20">
            D
          </div>
          <p className="text-xs tracking-[0.2em] uppercase text-orange-400/70 font-medium mb-3">
            Regional Commercial Operations
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold t-primary leading-tight mb-2">
            Dashboard de Seguimiento
            <br />
            <span className="gradient-text">Country</span>
          </h1>
          <p className="text-base t-secondary font-light tracking-wide">
            Raziel Busto Domaniczky
          </p>
        </div>

        {/* Flags Row */}
        <div className="flex items-center justify-center gap-6 mb-10">
          <div className="text-center">
            <div className="text-6xl mb-1 drop-shadow-lg" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }}>
              &#127477;&#127486;
            </div>
            <span className="text-[10px] t-muted uppercase tracking-wider">Paraguay</span>
          </div>
          <div className="w-px h-12 bg-gray-700" />
          <div className="text-center">
            <div className="text-6xl mb-1 drop-shadow-lg" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }}>
              &#127462;&#127479;
            </div>
            <span className="text-[10px] t-muted uppercase tracking-wider">Argentina</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex justify-center gap-3 mb-10 flex-wrap">
          <div className="rounded-xl px-5 py-3 text-center border border-orange-500/20" style={{ background: "var(--bg-card-hover)" }}>
            <p className="text-[10px] t-muted uppercase tracking-wider mb-1">Mercados</p>
            <p className="text-2xl font-bold text-orange-400">2</p>
          </div>
          <div className="rounded-xl px-5 py-3 text-center border border-blue-500/20" style={{ background: "var(--bg-card-hover)" }}>
            <p className="text-[10px] t-muted uppercase tracking-wider mb-1">Proveedores</p>
            <p className="text-2xl font-bold text-blue-400">270</p>
          </div>
          <div className="rounded-xl px-5 py-3 text-center border border-green-500/20" style={{ background: "var(--bg-card-hover)" }}>
            <p className="text-[10px] t-muted uppercase tracking-wider mb-1">Dropshippers</p>
            <p className="text-2xl font-bold text-green-400">611</p>
          </div>
          <div className="rounded-xl px-5 py-3 text-center border border-purple-500/20" style={{ background: "var(--bg-card-hover)" }}>
            <p className="text-[10px] t-muted uppercase tracking-wider mb-1">Periodo</p>
            <p className="text-2xl font-bold text-purple-400">Q2</p>
          </div>
        </div>

        {/* Country Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {/* Paraguay */}
          <Link
            href="/paraguay"
            className="group relative rounded-2xl p-6 border border-orange-500/20 transition-all hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 overflow-hidden"
            style={{ background: "var(--bg-card)" }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10 text-8xl leading-none" style={{ transform: "translate(10px, -10px)" }}>
              &#127477;&#127486;
            </div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl">&#127477;&#127486;</div>
                <div>
                  <h2 className="text-lg font-bold t-primary group-hover:text-orange-400 transition-colors">Paraguay</h2>
                  <p className="text-xs t-muted">Dropi PY</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-card-hover)" }}>
                  <p className="text-[10px] t-muted">Proveedores</p>
                  <p className="text-sm font-bold text-orange-400">226</p>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-card-hover)" }}>
                  <p className="text-[10px] t-muted">Dropshippers</p>
                  <p className="text-sm font-bold text-orange-400">299</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  Meta: 40K mov
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  Q1 + Abril
                </span>
              </div>
              <div className="mt-4 flex items-center text-xs t-muted group-hover:text-orange-400 transition-colors">
                Ir al dashboard
                <svg className="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </div>
            </div>
          </Link>

          {/* Argentina */}
          <Link
            href="/argentina"
            className="group relative rounded-2xl p-6 border border-sky-500/20 transition-all hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/10 overflow-hidden"
            style={{ background: "var(--bg-card)" }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10 text-8xl leading-none" style={{ transform: "translate(10px, -10px)" }}>
              &#127462;&#127479;
            </div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl">&#127462;&#127479;</div>
                <div>
                  <h2 className="text-lg font-bold t-primary group-hover:text-sky-400 transition-colors">Argentina</h2>
                  <p className="text-xs t-muted">Dropi AR</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-card-hover)" }}>
                  <p className="text-[10px] t-muted">Proveedores</p>
                  <p className="text-sm font-bold text-sky-400">44</p>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-card-hover)" }}>
                  <p className="text-[10px] t-muted">Dropshippers</p>
                  <p className="text-sm font-bold text-sky-400">312</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Meta: 12K mov
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  Q1 + Abril
                </span>
              </div>
              <div className="mt-4 flex items-center text-xs t-muted group-hover:text-sky-400 transition-colors">
                Ir al dashboard
                <svg className="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </div>
            </div>
          </Link>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>Activo &middot; Q2 2026</span>
          <span className="mx-2 text-gray-700">|</span>
          <span className="text-orange-500/50">Powered by Dropi</span>
          <span className="mx-2 text-gray-700">|</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
