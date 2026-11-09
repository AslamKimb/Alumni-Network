"use client";

import { Button } from "@Alumni-Network/ui/components/button";
import { Input } from "@Alumni-Network/ui/components/input";
import { Label } from "@Alumni-Network/ui/components/label";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

type Pending = "email" | "password" | "delete" | "signout" | null;

export default function AccountSettings() {
  const router = useRouter();
  const { data: session, refetch } = authClient.useSession();
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [pending, setPending] = useState<Pending>(null);

  const email = session?.user.email ?? "";
  const canDelete = email.length > 0 && confirmEmail.trim().toLowerCase() === email.toLowerCase();

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    const trimmed = newEmail.trim();
    if (!trimmed || trimmed.toLowerCase() === email.toLowerCase()) {
      toast.error("Enter a different email address.");
      return;
    }

    setPending("email");
    await authClient.changeEmail(
      { newEmail: trimmed },
      {
        onSuccess: async () => {
          await authClient.revokeOtherSessions();
          await refetch();
          setNewEmail("");
          toast.success("Email updated. Other devices were signed out.");
        },
        onError: (error) => {
          toast.error(error.error.message || error.error.statusText);
        },
      },
    );
    setPending(null);
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password must be different from the current password.");
      return;
    }

    setPending("password");
    await authClient.changePassword(
      { currentPassword, newPassword, revokeOtherSessions: true },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          toast.success("Password updated. Other devices were signed out.");
        },
        onError: (error) => {
          toast.error(error.error.message || error.error.statusText);
        },
      },
    );
    setPending(null);
  }

  async function deleteAccount() {
    if (!canDelete) return;

    setPending("delete");
    await authClient.deleteUser(undefined, {
      onSuccess: () => {
        toast.success("Your account was deleted.");
        router.push("/");
        router.refresh();
      },
      onError: (error) => {
        toast.error(error.error.message || error.error.statusText);
      },
    });
    setPending(null);
  }

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-lg border bg-card p-6">
        <h2 className="font-heading text-xl font-semibold">Email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You sign in with {email || "your email address"}.
        </p>
        <form className="mt-4 space-y-3" onSubmit={submitEmail}>
          <div className="space-y-1.5">
            <Label htmlFor="new-email">New email</Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              autoComplete="email"
              onChange={(event) => setNewEmail(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending !== null}>
            {pending === "email" ? "Updating…" : "Change email"}
          </Button>
          <p className="text-xs text-muted-foreground">
            No confirmation email is sent in this build, so check the address carefully. Changing
            it signs you out of every other device.
          </p>
        </form>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="font-heading text-xl font-semibold">Password</h2>
        <form className="mt-4 space-y-3" onSubmit={submitPassword}>
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <Button type="submit" variant="outline" disabled={pending !== null}>
            {pending === "password" ? "Updating…" : "Change password"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Changing it signs you out of every other device.
          </p>
        </form>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="font-heading text-xl font-semibold">Session</h2>
        <Button
          className="mt-4"
          variant="outline"
          disabled={pending !== null}
          onClick={() => {
            setPending("signout");
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => router.push("/"),
                onError: () => setPending(null),
              },
            });
          }}
        >
          Sign out
        </Button>
      </section>

      <section className="rounded-lg border border-destructive/40 bg-card p-6">
        <h2 className="font-heading text-xl font-semibold text-destructive">Delete account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This permanently deletes your account and your alumni record. Type {email} to confirm.
        </p>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="confirm-email">Email</Label>
            <Input
              id="confirm-email"
              type="email"
              value={confirmEmail}
              autoComplete="off"
              onChange={(event) => setConfirmEmail(event.target.value)}
            />
          </div>
          <Button
            variant="destructive"
            disabled={!canDelete || pending !== null}
            onClick={deleteAccount}
          >
            {pending === "delete" ? "Deleting…" : "Delete my account"}
          </Button>
        </div>
      </section>
    </div>
  );
}
