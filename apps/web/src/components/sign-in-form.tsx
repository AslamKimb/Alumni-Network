import { Button } from "@Alumni-Network/ui/components/button";
import { Input } from "@Alumni-Network/ui/components/input";
import { Label } from "@Alumni-Network/ui/components/label";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignInForm({
  onSwitchToSignUp,
  initialEmail,
}: {
  onSwitchToSignUp?: () => void;
  initialEmail?: string;
}) {
  const router = useRouter();
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: initialEmail ?? "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            router.push("/dashboard");
            toast.success("Sign in successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <div>
          <form.Field name="email">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name}>Email</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  autoComplete="email"
                  aria-invalid={field.state.meta.errors.length > 0 ? true : undefined}
                  aria-describedby={
                    field.state.meta.errors.length > 0 ? `${field.name}-error` : undefined
                  }
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error, i) => (
                  <p
                    key={error?.message}
                    id={i === 0 ? `${field.name}-error` : undefined}
                    role="alert"
                    className="text-sm text-red-700 dark:text-destructive"
                  >
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div>
          <form.Field name="password">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name}>Password</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={field.state.meta.errors.length > 0 ? true : undefined}
                  aria-describedby={
                    field.state.meta.errors.length > 0 ? `${field.name}-error` : undefined
                  }
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error, i) => (
                  <p
                    key={error?.message}
                    id={i === 0 ? `${field.name}-error` : undefined}
                    role="alert"
                    className="text-sm text-red-700 dark:text-destructive"
                  >
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Submitting..." : "Sign In"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-4 flex flex-col items-center gap-1">
        <Button variant="link" size="sm" nativeButton={false} render={<Link href="/forgot-password" />}>
          Forgot password?
        </Button>
        {onSwitchToSignUp && (
          <Button variant="link" size="sm" onClick={onSwitchToSignUp}>
            Need an account? Sign Up
          </Button>
        )}
      </div>
    </div>
  );
}
