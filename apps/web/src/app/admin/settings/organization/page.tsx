"use client";

import { hasPermission } from "@Alumni-Network/auth/permissions";
import { Button } from "@Alumni-Network/ui/components/button";
import { Input } from "@Alumni-Network/ui/components/input";
import { Label } from "@Alumni-Network/ui/components/label";
import { Textarea } from "@Alumni-Network/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

type Values = {
  name: string;
  shortName: string;
  description: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  address: string;
  homeCountry: string;
  timezone: string;
};

function isHttps(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function validate(values: Values) {
  const errors: Partial<Record<keyof Values, string>> = {};
  if (values.name.trim().length < 2) errors.name = "Name is required (2–120 characters).";
  if (values.shortName.trim() && values.shortName.trim().length < 2)
    errors.shortName = "Short name must be 2–20 characters.";
  if (values.description.length > 500) errors.description = "Description must be at most 500 characters.";
  if (values.logoUrl.trim() && !isHttps(values.logoUrl.trim()))
    errors.logoUrl = "Logo URL must be a valid HTTPS URL.";
  if (values.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim()))
    errors.contactEmail = "Enter a valid email address.";
  if (values.contactPhone.trim() && values.contactPhone.trim().length < 7)
    errors.contactPhone = "Contact phone must be 7–20 characters.";
  if (values.websiteUrl.trim() && !isHttps(values.websiteUrl.trim()))
    errors.websiteUrl = "Website URL must be a valid HTTPS URL.";
  if (values.address.length > 300) errors.address = "Address must be at most 300 characters.";
  if (values.homeCountry.trim() && !/^[A-Za-z]{2}$/.test(values.homeCountry.trim()))
    errors.homeCountry = "Enter a 2-letter country code (e.g. NG).";
  if (values.timezone.trim()) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: values.timezone.trim() });
    } catch {
      errors.timezone = "Enter a valid IANA timezone (e.g. Africa/Lagos).";
    }
  }
  return errors;
}

export default function AdminOrganizationSettingsPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) router.replace("/login");
    else if (session.user.role !== "admin" && !hasPermission(session.user, "settings:manage")) router.replace("/dashboard");
  }, [isPending, session, router]);

  if (isPending || !session?.user || (session.user.role !== "admin" && !hasPermission(session.user, "settings:manage"))) {
    return <p className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 text-sm text-muted-foreground md:px-6">Loading…</p>;
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">Admin</p>
      <h1 className="mt-2">Organization</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Public details shown on the landing page, header, and reports. Saved as one section.
      </p>
      <OrganizationForm />
    </main>
  );
}

function OrganizationForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const org = useQuery(trpc.settings.getOrganization.queryOptions());
  const [values, setValues] = useState<Values | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});

  useEffect(() => {
    if (org.data && !values) setValues(org.data);
  }, [org.data, values]);

  const save = useMutation(
    trpc.settings.saveOrganization.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(trpc.settings.getOrganization.queryKey(), data);
        setValues(data);
        setErrors({});
        toast.success("Organization settings saved");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (org.isPending) return <p className="mt-10 text-sm text-muted-foreground">Loading settings…</p>;
  if (!values) return <p className="mt-10 text-sm text-error-text">Could not load settings.</p>;

  const set = (field: keyof Values) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setValues((prev) => (prev ? { ...prev, [field]: event.target.value } : prev));

  const field = (
    id: string,
    label: string,
    error: string | undefined,
    control: React.ReactNode,
    helper?: string,
  ) => (
    <div className="space-y-1.5" key={id}>
      <Label htmlFor={id}>{label}</Label>
      {control}
      {error ? (
        <p className="text-xs text-error-text">{error}</p>
      ) : helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );

  return (
    <form
      className="mt-8 space-y-6 rounded-lg border bg-card p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const next = validate(values);
        setErrors(next);
        if (Object.keys(next).length > 0) return;
        save.mutate({
          ...values,
          homeCountry: values.homeCountry.trim().toUpperCase(),
          timezone: values.timezone.trim() || "UTC",
        });
      }}
    >
      {field("org-name", "Organization name *", errors.name, (
        <Input id="org-name" value={values.name} onChange={set("name")} maxLength={120} />
      ))}
      {field("org-short", "Short name", errors.shortName, (
        <Input id="org-short" value={values.shortName} onChange={set("shortName")} maxLength={20} placeholder="AN" />
      ), "Used for the compact header and the logo fallback monogram.")}
      {field("org-desc", "Description", errors.description, (
        <Textarea id="org-desc" value={values.description} onChange={set("description")} rows={3} maxLength={500} />
      ))}
      {field("org-logo", "Logo URL (HTTPS)", errors.logoUrl, (
        <Input id="org-logo" value={values.logoUrl} onChange={set("logoUrl")} maxLength={500} placeholder="https://…" inputMode="url" />
      ), "External HTTPS image. A missing or broken logo falls back to a monogram from the short name, or the first letters of the name.")}
      {field("org-email", "Contact email", errors.contactEmail, (
        <Input id="org-email" value={values.contactEmail} onChange={set("contactEmail")} maxLength={254} inputMode="email" />
      ))}
      {field("org-phone", "Contact phone", errors.contactPhone, (
        <Input id="org-phone" value={values.contactPhone} onChange={set("contactPhone")} maxLength={20} inputMode="tel" />
      ))}
      {field("org-website", "Website URL (HTTPS)", errors.websiteUrl, (
        <Input id="org-website" value={values.websiteUrl} onChange={set("websiteUrl")} maxLength={300} inputMode="url" placeholder="https://…" />
      ))}
      {field("org-address", "Address", errors.address, (
        <Textarea id="org-address" value={values.address} onChange={set("address")} rows={3} maxLength={300} />
      ))}
      {field("org-country", "Home country (ISO alpha-2)", errors.homeCountry, (
        <Input id="org-country" value={values.homeCountry} onChange={set("homeCountry")} maxLength={2} placeholder="NG" />
      ), "Used for the Abroad report metric.")}
      {field("org-timezone", "Timezone (IANA)", errors.timezone, (
        <Input id="org-timezone" value={values.timezone} onChange={set("timezone")} placeholder="UTC" />
      ), "Used for event times and report timestamps. Defaults to UTC.")}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save organization settings"}
      </Button>
    </form>
  );
}
