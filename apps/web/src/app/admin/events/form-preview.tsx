import { renderMarkdown } from "@/app/events/markdown";

export type EventFormValues = {
  title: string;
  summary: string;
  body: string;
  category: "event" | "update";
  startsAt: string;
  endsAt: string;
  location: string;
  isOnline: boolean;
  coverImageUrl: string;
};

// Live preview of the event as alumni will see it. The body goes through the
// same safe renderer as the detail page: HTML escaped, http/https links only.
export function EventPreview({ values }: { values: EventFormValues }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.5px] text-muted-foreground">Preview</p>
      {values.coverImageUrl && values.coverImageUrl.startsWith("https://") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={values.coverImageUrl} alt="" className="mt-3 w-full rounded object-cover" />
      )}
      <span className="mt-3 inline-flex rounded-sm bg-secondary px-3 py-1 text-xs font-medium tracking-[0.5px] uppercase">
        {values.category}
      </span>
      <h3 className="mt-2 text-xl font-semibold">{values.title || "Untitled"}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {values.startsAt ? new Date(values.startsAt).toLocaleString() : "TBA"} ·{" "}
        {values.isOnline ? "Online" : (values.location || "Online")}
      </p>
      {values.summary && <p className="mt-3 text-sm text-muted-foreground">{values.summary}</p>}
      <div className="mt-4 space-y-4 text-sm">{values.body ? renderMarkdown(values.body) : <p className="text-muted-foreground">Body is empty.</p>}</div>
    </div>
  );
}

export function toInput(values: EventFormValues) {
  return {
    title: values.title,
    summary: values.summary || undefined,
    body: values.body || undefined,
    category: values.category,
    startsAt: values.startsAt ? new Date(values.startsAt) : undefined,
    endsAt: values.endsAt ? new Date(values.endsAt) : undefined,
    location: values.location || undefined,
    isOnline: values.isOnline,
    coverImageUrl: values.coverImageUrl || undefined,
  };
}

export const emptyValues: EventFormValues = {
  title: "",
  summary: "",
  body: "",
  category: "event",
  startsAt: "",
  endsAt: "",
  location: "",
  isOnline: false,
  coverImageUrl: "",
};
