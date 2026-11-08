import { cn } from "@Alumni-Network/ui/lib/utils";
import * as React from "react";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full resize-none rounded-md border border-input bg-card px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors outline-none placeholder:font-normal placeholder:text-muted-foreground hover:border-primary focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/10",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
