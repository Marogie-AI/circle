import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

// Split shell for signed-out entry points: form left, art panel right.
// Deliberately has no sidebar — these pages are reached by people who may not
// have an account yet.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen">
      {/* Fixed-width form column so the panel absorbs every extra pixel on wide
          screens. min-w-0 lets it shrink past the form's intrinsic width
          instead of pushing the fields out of the viewport. */}
      <div className="flex min-w-0 flex-1 flex-col px-6 py-10 lg:w-[28rem] lg:flex-none">
        {/* Wordmark lives here, not in the pages, so login and signup cannot
            drift apart on its size or position. */}
        {/* Negative gap: the PNG carries its own transparent margin, so a
            positive gap reads as a much wider space than it is. */}
        <Link href="/" className="w-fit rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2">
          {/* Same lockup component as the sidebar, just larger — the two cannot
              drift apart on spacing or optical alignment any more. */}
          <Wordmark size={56} className="[&>span]:text-2xl" />
        </Link>
        <div className="flex flex-1 items-center justify-center py-12">
          {children}
        </div>
      </div>
      {/* Decorative panel. Collapses below lg rather than stacking above the
          form and shoving the fields off a phone screen. Swap the inner span
          for an <Image fill> when there is real art to put here. */}
      <div
        aria-hidden="true"
        className="relative hidden flex-1 overflow-hidden bg-rail lg:block"
      >
        {/* 4:3 source, object-cover: the panel ranges from 0.75 to ~1.5 aspect
            across viewports, so either axis can be cropped. The poster is also
            the reduced-motion fallback, hence the media query below. */}
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/auth-panel.jpg"
          className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
        >
          <source src="/auth-panel.webm" type="video/webm" />
          <source src="/auth-panel.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 hidden bg-[url('/auth-panel.jpg')] bg-cover bg-center motion-reduce:block" />
      </div>
    </main>
  );
}
