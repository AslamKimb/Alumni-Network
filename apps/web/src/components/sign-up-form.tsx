import { Button } from "@Alumni-Network/ui/components/button";
import { Checkbox } from "@Alumni-Network/ui/components/checkbox";
import { Input } from "@Alumni-Network/ui/components/input";
import { Label } from "@Alumni-Network/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignUpForm({
  onSwitchToSignIn,
}: {
  onSwitchToSignIn: (email?: string) => void;
}) {
  const router = useRouter();
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
      consent: false,
    },
    onSubmit: async ({ value }) => {
      // `consent` is a sign-up body extension read by the server hook, not a Better Auth user field.
      const payload = {
        email: value.email,
        password: value.password,
        name: value.name,
        consent: value.consent,
      };
      await authClient.signUp.email(
        payload as Parameters<typeof authClient.signUp.email>[0],
        {
          onSuccess: () => {
            router.push("/onboarding");
            toast.success("Sign up successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
            // The address already has an account: hand them the sign-in form
            // instead of leaving them on a sign-up form that cannot succeed.
            if (error.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
              onSwitchToSignIn(value.email);
            }
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .min(2, "Name must be at least 2 characters")
          .max(120, "Name must be at most 120 characters"),
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        consent: z
          .boolean()
          .refine((v) => v === true, "You must consent to storing your record"),
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
          <form.Field name="name">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name}>Full name</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  autoComplete="name"
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
                  autoComplete="new-password"
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

        <div className="space-y-1.5">
          <form.Field name="consent">
            {(field) => (
              <>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={field.name}
                    checked={field.state.value}
                    aria-invalid={field.state.meta.errors.length > 0 ? true : undefined}
                    aria-describedby={
                      field.state.meta.errors.length > 0 ? `${field.name}-error` : undefined
                    }
                    onCheckedChange={(checked) => field.handleChange(checked === true)}
                  />
                  <div className="space-y-0.5 leading-relaxed">
                    <Label htmlFor={field.name} className="text-sm">
                      I consent to storing my alumni record
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Your record is visible to administrators only, never to other
                      alumni.
                    </p>
                  </div>
                </div>
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
              </>
            )}
          </form.Field>
        </div>

        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Submitting..." : "Sign Up"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-4 text-center">
        <Button variant="link" size="sm" onClick={() => onSwitchToSignIn()}>
          Already have an account? Sign In
        </Button>
      </div>
    </div>
  );
}
