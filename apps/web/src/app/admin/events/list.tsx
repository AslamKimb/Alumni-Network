"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@Alumni-Network/ui/components/button";

import { useTRPC } from "@/utils/trpc";

export default function AdminEventsList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "">("");
  const [category, setCategory] = useState<"event" | "update" | "">("");

  const flags = useQuery(trpc.settings.publicModuleFlags.queryOptions());
  const list = useQuery({
    ...trpc.events.listAdmin.queryOptions({
      search: search || undefined,
      status: status || undefined,
      category: category || undefined,
    }),
    enabled: flags.data?.events !== false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.events.listAdmin.queryKey() });
  const onError = (error: { message: string }) => toast.error(error.message);

  const publish = useMutation(trpc.events.publish.mutationOptions({ onSuccess: refresh, onError }));
  const unpublish = useMutation(trpc.events.unpublish.mutationOptions({ onSuccess: refresh, onError }));
  const remove = useMutation(trpc.events.delete.mutationOptions({ onSuccess: refresh, onError }));
  const busy = publish.isPending || unpublish.isPending || remove.isPending;

  if (flags.data?.events === false) {
    return (
      <div className="mt-10">
        <h1>Not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page is not available.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title or summary"
            className="h-10 rounded-md border px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-10 rounded-md border px-2">
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="h-10 rounded-md border px-2">
            <option value="">All</option>
            <option value="event">Event</option>
            <option value="update">Update</option>
          </select>
        </label>
        <Link href="/admin/events/new" className="ml-auto">
          <Button>New event</Button>
        </Link>
      </div>

      {list.isPending ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : !list.data || list.data.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No events match these filters.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Start</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-2">
                    <Link href={`/admin/events/${item.id}`} className="text-highlight underline">
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{item.category}</td>
                  <td className="px-4 py-2">{item.status}</td>
                  <td className="px-4 py-2">
                    {item.startsAt ? new Date(item.startsAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {item.status === "draft" ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => publish.mutate({ id: item.id })}>
                          Publish
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => unpublish.mutate({ id: item.id })}>
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
    </>
  );
}
