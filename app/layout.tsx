import type { Metadata } from "next";
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
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-canvas text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
