"use client"

import { Toaster as SonnerToaster } from "sonner"

type ToasterProps = React.ComponentProps<typeof SonnerToaster>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <SonnerToaster
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/80 group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:backdrop-blur-sm",
          error:
            "group-[.toaster]:bg-destructive/85 group-[.toaster]:text-destructive-foreground group-[.toaster]:border-destructive/30",
          warning:
            "group-[.toaster]:bg-warning/85 group-[.toaster]:text-warning-foreground group-[.toaster]:border-warning/30",
          info:
            "group-[.toaster]:bg-info/85 group-[.toaster]:text-info-foreground group-[.toaster]:border-info/30",
          success:
            "group-[.toaster]:bg-primary/85 group-[.toaster]:text-primary-foreground group-[.toaster]:border-primary/30",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
