import Link from "next/link";

import { Button } from "@Alumni-Network/ui/components/button";
import { Card, CardContent } from "@Alumni-Network/ui/components/card";

export default function ResetPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">
            Alumni Network
          </p>
          <h1 className="mt-2">Choose a new password</h1>
        </div>
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This reset link cannot be used: the installation has no transactional email
              provider, so no reset link is ever issued.
            </p>
            <p className="text-sm text-muted-foreground">
              Contact the alumni office and they will help you get back into your account.
            </p>
            <Button className="w-full" nativeButton={false} render={<Link href="/login" />}>
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
