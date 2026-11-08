"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type * as React from "react";

/**
 * shadcn/ui's dropdown menu, copied in on the Base UI primitive (no Radix) and
 * re-skinned for the pearl/emerald tokens (AGENTS §6). Base UI owns the behaviour —
 * portal, collision-aware placement, arrow keys, typeahead, Escape, focus return —
 * so there is no hand-rolled menu state here.
 */
function cx(...classes: unknown[]) {
  return classes.filter((value): value is string => typeof value === "string" && value !== "").join(" ");
}

const TRIGGER =
  "inline-flex h-10 w-10 items-center justify-center rounded-sm border border-emerald text-emerald transition-colors duration-150 hover:bg-emerald-soft disabled:pointer-events-none disabled:opacity-60";

const POPUP =
  "z-50 max-h-[var(--available-height)] min-w-52 overflow-y-auto rounded-sm border border-gold/50 bg-surface p-1 text-small text-ink shadow-card outline-none transition-opacity duration-100 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0";

const ITEM =
  "flex cursor-default select-none items-center gap-2 rounded-xs px-3 py-2 text-small text-ink outline-none data-[highlighted]:bg-emerald-soft data-[highlighted]:text-emerald data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:shrink-0";

export function DropdownMenu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />;
}

export function DropdownMenuTrigger({ className, ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger className={cx(TRIGGER, className)} {...props} />;
}

export function DropdownMenuContent({
  className,
  align = "end",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 6,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup className={cx(POPUP, className)} {...props} />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return <MenuPrimitive.Item className={cx(ITEM, className)} {...props} />;
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator className={cx("my-1 h-px bg-rule", className)} {...props} />
  );
}
