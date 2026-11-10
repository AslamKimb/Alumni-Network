export default function Footer() {
  return (
    <footer className="mt-auto border-t bg-card px-4 py-3 md:px-6">
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>Built by</span>
        <a
          href="https://naslakk.com"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm bg-white px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Naslak — Digital Embrace (opens naslakk.com in a new tab)"
        >
          <img
            src="/naslak-logo.png"
            alt="Naslak"
            width={52}
            height={26}
            className="h-[26px] w-auto"
          />
        </a>
      </div>
    </footer>
  );
}
