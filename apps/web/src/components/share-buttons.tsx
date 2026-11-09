"use client";

import { toast } from "sonner";

const btn =
  "inline-flex items-center rounded-md border px-2 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const encodedUrl = encodeURIComponent(url);
  const text = encodeURIComponent(title);
  const links: { label: string; href: string | null }[] = [
    { label: "Copy link", href: null },
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodedUrl}&text=${text}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}` },
    { label: "Email", href: `mailto:?subject=${text}&body=${encodedUrl}` },
  ];
  return (
    <div className="flex flex-wrap gap-1" aria-label="Share">
      {links.map(({ label, href }) =>
        href === null ? (
          <button
            key={label}
            type="button"
            aria-label={label}
            className={btn}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Link copied");
              } catch {
                toast.error("Could not copy link");
              }
            }}
          >
            {label}
          </button>
        ) : (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={btn}>
            {label}
          </a>
        ),
      )}
    </div>
  );
}

export function absoluteUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}
