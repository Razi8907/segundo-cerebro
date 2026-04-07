"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/** Chart-friendly color palette for current theme */
export function useChartColors() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return {
    tooltipBg: dark ? "#16213e" : "#ffffff",
    tooltipBorder: dark ? "rgba(249,115,22,0.3)" : "rgba(249,115,22,0.5)",
    tooltipText: dark ? "#F97316" : "#9a3412",
    gridStroke: dark ? "#2a2a4a" : "#e5e7eb",
    axisTick: dark ? "#9ca3af" : "#6b7280",
    refLineStroke: dark ? "#6B7280" : "#d1d5db",
  };
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem("sc-theme") as Theme | null;
    const initial = saved || "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("sc-theme", next);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
