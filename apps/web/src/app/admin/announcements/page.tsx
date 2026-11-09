"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { hasPermission } from "@Alumni-Network/auth/permissions";
import { Button } from "@Alumni-Network/ui/components/button";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminAnnouncementsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "">("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    ...trpc.announcements.listAdmin.queryOptions({
      search: search || undefined,
      status: status || undefined,
    }),
    enabled: !sessionPending && !!session?.user,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: trpc.announcements.listAdmin.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.announcements.listPublished.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.announcements.unreadCount.queryKey() });
  };
  const onError = (err: { message: string }) => {
    setError(err.message);
    toast.error(err.message);
  };

  const create = useMutation(
    trpc.announcements.create.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Saved as draft");
        setShowForm(false);
        setTitle("");
        setBody("");
        setEditingId(null);
        setError(null);
      },
      onError,
    }),
  );
  const update = useMutation(
    trpc.announcements.update.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Saved");
      },
      onError,
    }),
  );
  const publish = useMutation(
    trpc.announcements.publish.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Published");
      },
      onError,
    }),
  );
  const unpublish = useMutation(
    trpc.announcements.unpublish.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Unpublished");
      },
      onError,
    }),
  );
  const remove = useMutation(
    trpc.announcements.delete.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Deleted");
        setShowForm(false);
        setEditingId(null);
      },
      onError,
    }),
  );
  const busy =
    create.isPending || update.isPending || publish.isPending || unpublish.isPending || remove.isPending;

  if (sessionPending) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 md:px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!session?.user) {
    router.replace("/login");
    return null;
  }

  if (session.user.role !== "admin" && !hasPermission(session.user, "announcements:manage")) {
    router.replace("/dashboard");
    return null;
  }

  const titleValid = title.trim().length >= 3 && title.length <= 140;
  const bodyValid = body.trim().length > 0;
  const canPublish = titleValid && bodyValid;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 md:px-6">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Announcements</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Draft, publish, and delete announcements alumni see under Announcements.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title or body"
            className="h-10 rounded-md border px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="h-10 rounded-md border px-2"
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <Button
          type="button"
          className="ml-auto"
          onClick={() => {
            setEditingId(null);
            setTitle("");
            setBody("");
            setError(null);
            setShowForm((v) => !v);
          }}
        >
          New announcement
        </Button>
      </div>

      {showForm && (
        <form
          className="mt-6 space-y-4 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (editingId) {
              update.mutate({ id: editingId, title, body });
            } else {
              create.mutate({ title, body });
            }
          }}
        >
          <p className="text-sm font-medium">{editingId ? "Edit announcement" : "New announcement"}</p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Title</span>
            <input
              required
              minLength={3}
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 rounded-md border px-3"
            />
            <span className="text-xs text-muted-foreground">
              3–140 characters. Required to publish.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Body</span>
            <textarea
              rows={8}
              maxLength={20000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="rounded-md border px-3 py-2"
              placeholder="Plain text announcement body"
            />
            <span className="text-xs text-muted-foreground">
              Draft may lack a body; publish is blocked until title and body are set.
            </span>
          </label>
          {!canPublish && (
            <p className="text-xs text-muted-foreground">
              Publish requires a valid title (3–140 chars) and a non-empty body.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {editingId ? "Save" : "Save draft"}
            </Button>
            {editingId && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    if (!canPublish) {
                      setError("Cannot publish: missing title, body");
                      return;
                    }
                    publish.mutate({ id: editingId });
                  }}
                >
                  Publish
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Delete "${title}" permanently?`)) {
                      remove.mutate({ id: editingId });
                    }
                  }}
                >
                  Delete
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {list.isPending ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : list.isError || !list.data ? (
        <p className="mt-8 text-sm text-destructive">Could not load announcements.</p>
      ) : list.data.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No announcements match these filters.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Published</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className="text-highlight underline"
                      onClick={() => {
                        setEditingId(item.id);
                        setTitle(item.title);
                        setBody(item.body);
                        setError(null);
                        setShowForm(true);
                      }}
                    >
                      {item.title}
                    </button>
                  </td>
                  <td className="px-4 py-2">{item.status}</td>
                  <td className="px-4 py-2">{fmtDate(item.publishedAt)}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {item.status === "draft" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => publish.mutate({ id: item.id })}
                        >
                          Publish
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => unpublish.mutate({ id: item.id })}
                        >
                          Unpublish
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Delete "${item.title}" permanently?`)) {
                            remove.mutate({ id: item.id });
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
