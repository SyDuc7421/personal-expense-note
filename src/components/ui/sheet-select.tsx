import { Check, ChevronDown } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "./drawer"

export interface SheetSelectOption {
  value: string
  label: string
  icon?: string
}

interface SheetSelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: SheetSelectOption[]
  /** Sheet title and the trigger's accessible name. */
  label: string
  /** Trigger text when `value` is "" (an option with value "" can act as "clear"). */
  placeholder?: string
  className?: string
  "aria-invalid"?: boolean
}

/** Select whose options open in a bottom sheet (thumb zone, spec 10.2), styled like Input. */
function SheetSelect({ id, value, onValueChange, options, label, placeholder, className, ...props }: SheetSelectProps) {
  const [open, setOpen] = React.useState(false)
  const selected = value === "" ? undefined : options.find((o) => o.value === value)

  return (
    <>
      <button
        id={id}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={props["aria-invalid"]}
        data-slot="sheet-select"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30",
          className
        )}
      >
        {selected?.icon && <span aria-hidden>{selected.icon}</span>}
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder ?? label}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto flex w-full max-w-md min-h-0 flex-col">
            <DrawerHeader>
              <DrawerTitle>{label}</DrawerTitle>
              <DrawerDescription className="sr-only">{label}</DrawerDescription>
            </DrawerHeader>
            <ul
              role="listbox"
              aria-label={label}
              className="overflow-y-auto border-t px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
            >
              {options.map((o) => {
                const isSelected = o.value === value
                return (
                  <li
                    key={o.value}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onClick={() => {
                      onValueChange(o.value)
                      setOpen(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onValueChange(o.value)
                        setOpen(false)
                      }
                    }}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-3 text-base outline-none active:bg-muted focus-visible:bg-muted",
                      isSelected && "bg-secondary/40 font-semibold"
                    )}
                  >
                    {o.icon && <span className="text-xl" aria-hidden>{o.icon}</span>}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {isSelected && <Check className="size-5 text-primary" aria-hidden />}
                  </li>
                )
              })}
            </ul>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

export { SheetSelect }
