"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";

type Option = { value: string; label: string; disabled?: boolean };

type SelectProps = {
  label: string;
  value: string;
  options: Option[];
  disabled?: boolean;
  onValueChange: (value: string) => void;
};

// Base UI owns keyboard navigation, typeahead, focus, and popup accessibility.
export function Select({
  label,
  value,
  options,
  disabled,
  onValueChange,
}: SelectProps) {
  return (
    <div>
      <SelectPrimitive.Root
        value={value}
        items={options}
        disabled={disabled}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next);
        }}
      >
        <SelectPrimitive.Label className="text-sm font-heading">
          {label}
        </SelectPrimitive.Label>
        <SelectPrimitive.Trigger className="mt-2 flex h-12 w-full items-center justify-between gap-3 rounded-base border-2 border-border bg-input-background px-3 text-left text-foreground shadow-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-background disabled:cursor-not-allowed disabled:opacity-60">
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-4"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner
            sideOffset={8}
            alignItemWithTrigger={false}
            className="z-50 outline-none"
          >
            <SelectPrimitive.Popup className="max-h-[var(--available-height)] min-w-[var(--anchor-width)] overflow-y-auto rounded-base border-2 border-border bg-secondary-background p-1 text-foreground shadow-shadow">
              <SelectPrimitive.List>
                {options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-base px-3 py-2 text-sm outline-none data-highlighted:bg-main data-highlighted:text-main-foreground data-disabled:cursor-not-allowed data-disabled:opacity-40"
                  >
                    <SelectPrimitive.ItemText>
                      {option.label}
                    </SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator>
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="size-4"
                      >
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
