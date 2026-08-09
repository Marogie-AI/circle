"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";

/**
 * The <html class="dark"> is set by the inline script in app/layout.tsx before paint.
 * This only reads that existing state and flips it, so the two never disagree.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("circle-theme", next ? "dark" : "light");
    } catch {
      // private mode: the theme just won't persist, which is fine
    }
  };

  return (
    <button
      type="button"
      role="menuitem"
      onClick={toggle}
      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink transition hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
    >
      {dark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
