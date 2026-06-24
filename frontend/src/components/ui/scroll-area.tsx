import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Simple scrollable container. Replaces Radix ScrollArea which caused
 * blurry text on WebKitGTK due to nested overflow-hidden layers and
 * fractional-offset GPU compositing during scroll.
 */
const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("overflow-y-auto", className)}
    {...props}
  >
    {children}
  </div>
))
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
