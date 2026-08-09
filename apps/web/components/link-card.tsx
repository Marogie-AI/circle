import { ExternalIcon } from "@/components/icons";

/**
 * Rich preview for a post's link.
 *
 * Images use a plain <img>, deliberately NOT next/image: optimising remote images
 * requires opening `remotePatterns` to arbitrary hosts, which turns our server into an
 * open image proxy. referrerPolicy="no-referrer" stops the target site learning which
 * private group linked to it.
 */
export function LinkCard({
  url,
  title,
  description,
  image,
  site,
}: {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  site?: string | null;
}) {
  const host = site || (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  })();

  // No metadata came back (fetch failed, or not HTML): fall back to the bare link
  // rather than rendering an empty card.
  if (!title && !image && !description) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-7 flex min-w-0 items-center justify-between gap-4 rounded-xl border border-line bg-canvas px-4 py-3 text-sm font-medium text-ink transition hover:border-line hover:bg-hover"
      >
        <span className="min-w-0 truncate">{url}</span>
        <ExternalIcon size={16} className="shrink-0 text-faint" />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-7 block overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-line hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="aspect-[1.91/1] w-full bg-rail object-cover"
        />
      ) : null}
      <div className="min-w-0 px-4 py-3">
        <p className="flex items-center gap-1.5 text-xs text-faint">
          <span className="min-w-0 truncate">{host}</span>
          <ExternalIcon size={12} className="shrink-0" />
        </p>
        {title ? (
          <p className="mt-1 line-clamp-2 font-medium leading-snug text-ink">
            {title}
          </p>
        ) : null}
        {description ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted">{description}</p>
        ) : null}
      </div>
    </a>
  );
}
