import { cn } from "@Alumni-Network/ui/lib/utils";
import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10.5 w-full min-w-0 rounded-md border border-input bg-card px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:font-normal placeholder:text-muted-foreground hover:border-primary focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/10",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
