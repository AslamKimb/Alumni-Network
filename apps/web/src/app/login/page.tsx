"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Card, CardContent } from "@Alumni-Network/ui/components/card";
import { Skeleton } from "@Alumni-Network/ui/components/skeleton";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

function LoginInner() {
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const publicAuth = useQuery(trpc.settings.publicAuth.queryOptions());
  const signupsOpen = publicAuth.data?.signupsOpen ?? true;
  const [showSignIn, setShowSignIn] = useState(() => searchParams.get("mode") === "signin");
  const [signInEmail, setSignInEmail] = useState<string | undefined>(undefined);

  // A visitor who arrives signed in has no business on the login form. Checked
  // once on mount, never reactively: a sign-up on this page creates a session,
  // and reacting to that would race the form's own push to /onboarding.
  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) router.replace("/dashboard");
    });
  }, [router]);

  // Keep the visible form in sync when navigating between
  // /login?mode=signin and /login?mode=signup without a remount.
  useEffect(() => {
    setShowSignIn(searchParams.get("mode") === "signin");
  }, [searchParams]);

  const signingIn = showSignIn || !signupsOpen;

  // Waiting beats guessing: a closed instance must never paint a sign-up form.
  if (publicAuth.isPending) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <Skeleton className="mx-auto h-16 w-64" />
          <Skeleton className="h-72 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">
            Alumni Network
          </p>
          <h1 className="mt-2">{signingIn ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {signingIn
              ? "Sign in to keep your alumni record up to date."
              : "Join the registry and keep your alumni record up to date."}
          </p>
        </div>
        <Card>
          <CardContent>
            {signingIn ? (
              <SignInForm
                onSwitchToSignUp={signupsOpen ? () => setShowSignIn(false) : undefined}
                initialEmail={signInEmail}
              />
            ) : (
              <SignUpForm
                onSwitchToSignIn={(email) => {
                  setSignInEmail(email);
                  setShowSignIn(true);
                }}
              />
            )}
          </CardContent>
        </Card>
        {publicAuth.data && !signupsOpen && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            New sign-ups are closed right now. Contact the alumni office to request an account.
          </p>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
