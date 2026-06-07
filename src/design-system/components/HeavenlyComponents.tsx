import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export function HeavenlyButton({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      className={cn(
        "hd-button",
        variant === "primary" && "hd-button-primary",
        variant === "secondary" && "hd-button-secondary",
        variant === "ghost" && "border-transparent bg-transparent text-[var(--hd-color-text-secondary)] hover:text-[var(--hd-color-text)]",
        className,
      )}
      {...props}
    />
  );
}

export function HeavenlyCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("hd-card p-5", className)} {...props} />;
}

export function HeavenlyKpi({
  label,
  value,
  detail,
  className,
}: HTMLAttributes<HTMLDivElement> & { label: string; value: string; detail?: string }) {
  return (
    <HeavenlyCard className={cn("hd-kpi", className)}>
      <span className="text-sm font-medium text-[var(--hd-color-text-secondary)]">{label}</span>
      <strong className="font-['Poppins'] text-3xl font-bold text-[var(--hd-color-text)]">{value}</strong>
      {detail ? <span className="text-xs text-[var(--hd-color-accent)]">{detail}</span> : null}
    </HeavenlyCard>
  );
}

export function HeavenlyModal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/62 p-4 backdrop-blur-sm">
      <div className="hd-modal w-full max-w-xl p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-['Poppins'] text-xl font-bold text-[var(--hd-color-text)]">{title}</h2>
          <button className="hd-button h-10 min-h-10 w-10 p-0" type="button" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function HeavenlyNavbar({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav className={cn("hd-navbar border-b px-5 py-3", className)} {...props} />;
}

export function HeavenlySidebar({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <aside className={cn("hd-sidebar border-r px-4 py-5", className)} {...props} />;
}

export function HeavenlyFooter({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <footer className={cn("hd-footer border-t px-5 py-4 text-sm text-[var(--hd-color-text-secondary)]", className)} {...props} />;
}

export function HeavenlyChatBubble({
  role,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { role: "assistant" | "user" }) {
  return <div className={cn("hd-chat-bubble", className)} data-role={role} {...props} />;
}
