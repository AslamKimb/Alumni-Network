import { hasPermission } from "@Alumni-Network/auth/permissions";
import { Button } from "@Alumni-Network/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@Alumni-Network/ui/components/dropdown-menu";
import { Skeleton } from "@Alumni-Network/ui/components/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-10.5 w-24" />;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/login?mode=signin" />}>
          Sign In
        </Button>
        <Button nativeButton={false} render={<Link href="/login?mode=signup" />}>
          Sign Up
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <span className="max-w-40 truncate">{session.user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{session.user.email}</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/settings/account" />}>
            Account settings
          </DropdownMenuItem>
          {session.user.role === "admin" && (
            <DropdownMenuItem render={<Link href="/admin/access" />}>
              Manage access
            </DropdownMenuItem>
          )}
          {(session.user.role === "admin" ||
            hasPermission(session.user, "settings:manage")) && (
            <DropdownMenuItem render={<Link href="/admin/settings/organization" />}>
              Organization settings
            </DropdownMenuItem>
          )}
          {(session.user.role === "admin" ||
            hasPermission(session.user, "settings:manage")) && (
            <DropdownMenuItem render={<Link href="/admin/settings/auth" />}>
              Auth settings
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    router.push("/");
                  },
                },
              });
            }}
          >
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
