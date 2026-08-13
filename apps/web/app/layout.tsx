import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Circle",
  description: "Share the good stuff with your people",
};

/**
 * Runs before first paint so a dark-mode user never sees a white flash while React
 * hydrates. It has to stay inline and synchronous in <head> for that — moving it into
 * a component or a useEffect puts it after paint and the flash comes back.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("circle-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* next/script with beforeInteractive, not a bare <script>: React 19 does
            not execute a script element rendered by a component, and Next 16 now
            warns about it. beforeInteractive still injects it into <head> and
            runs it before hydration, which is what keeps the dark-mode flash away. */}
        <Script id="circle-theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
      </head>
      {/* bg-canvas is the flat base under the gradient globals.css paints on body, and
          the fallback if that background-image ever fails to apply. */}
      <body className="min-h-screen bg-canvas text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
