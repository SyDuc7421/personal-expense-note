import * as React from "react"
import { cn } from "@/lib/utils"

/** Native <select>: uses the iOS picker wheel, which beats a custom popover on mobile. */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-11 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat px-2.5 pr-9 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23888%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')]",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
