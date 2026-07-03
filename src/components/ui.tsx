// ============================================================================
//  Shared inline-styled primitives used across screens. These mirror the
//  recurring card / pill / progress / empty patterns in the prototype so
//  screens stay consistent without a CSS framework.
// ============================================================================
import React, { useEffect, useId, useRef, useState } from "react";
import { color, font, radius, chart } from "@/theme";

export function Card({ children, style, padding = 20, onClick }: {
  children: React.ReactNode; style?: React.CSSProperties; padding?: number | string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      background: color.surface, border: `1px solid ${color.border}`,
      borderRadius: radius.xxl, padding, ...style,
    }}>{children}</div>
  );
}

export function CardHeader({ title, subtitle, right }: {
  title: string; subtitle?: string; right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: color.faint2, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

export function Chip({ label, ink = color.textMuted, tint = color.bg }: {
  label: string; ink?: string; tint?: string;
}) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700, color: ink, background: tint,
      padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

export function ProgressBar({ pct, fill = color.primary, height = 6, track = chart.track }: {
  pct: number; fill?: string; height?: number; track?: string;
}) {
  return (
    <div style={{ flex: 1, height, background: track, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: fill, borderRadius: 4 }} />
    </div>
  );
}

// Small empty-state block shown inside a card body when there's no data.
export function EmptyBlock({ message, minHeight = 96 }: { message: string; minHeight?: number }) {
  return (
    <div style={{
      minHeight, display: "flex", alignItems: "center", justifyContent: "center",
      textAlign: "center", color: color.faint3, fontSize: 13, padding: "18px 12px",
    }}>{message}</div>
  );
}

const HEALTH_COLORS: Record<string, { ink: string; tint: string }> = {
  green: { ink: "#0B6B37", tint: "#E7F4EC" },
  amber: { ink: "#8A6300", tint: "#FBF2D7" },
  red:   { ink: "#A1282B", tint: "#FBE7E8" },
  hold:  { ink: "#4A5266", tint: "#EEF1F6" },
};
export function HealthPill({ status, label }: { status: string; label: string }) {
  const c = HEALTH_COLORS[status] ?? HEALTH_COLORS.hold;
  return <Chip label={label} ink={c.ink} tint={c.tint} />;
}

export function statusDot(status: string): string {
  return { green: chart.onTrack, amber: chart.atRisk, red: chart.critical, hold: chart.onHold }[status] ?? chart.onHold;
}

// ============================================================================
//  Form / action primitives — single source of truth for the button, input,
//  select and label styles that were previously copy-pasted across screens.
//  Base values match the most common prototype variants; pass `style` to tune
//  the few outliers (e.g. a wider primary button) without redefining them.
// ============================================================================

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

const BTN_BASE: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
  fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
};
const BTN_VARIANT: Record<"primary" | "secondary", React.CSSProperties> = {
  primary:   { color: "#fff", background: color.primary, border: "none", padding: "10px 15px" },
  secondary: { color: color.textMuted, background: color.surface, border: `1px solid ${color.border2}`, padding: "9px 14px" },
};

export function Button({ variant = "primary", style, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{ ...BTN_BASE, ...BTN_VARIANT[variant], ...(disabled ? { opacity: 0.55, cursor: "not-allowed" } : null), ...style }}
    />
  );
}

// Shared focus-ring behaviour for inputs/selects/textareas (inline styles can't
// express :focus, so we track it in state — this is the visible focus indicator
// the bare inputs previously lacked).
function useFocusRing() {
  const [focused, setFocused] = useState(false);
  const ring: React.CSSProperties = focused
    ? { borderColor: color.primary, boxShadow: `0 0 0 3px ${color.primaryTint}` }
    : {};
  return { focused, ring, onFocus: () => setFocused(true), onBlur: () => setFocused(false) };
}

const FIELD_BASE: React.CSSProperties = {
  width: "100%", border: `1px solid ${color.border2}`, borderRadius: 9, padding: "10px 11px",
  fontSize: 13, fontFamily: "inherit", color: color.text, background: color.surface,
  outline: "none", boxSizing: "border-box",
};

export function Input({ style, onFocus, onBlur, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  const f = useFocusRing();
  return (
    <input
      {...rest}
      onFocus={(e) => { f.onFocus(); onFocus?.(e); }}
      onBlur={(e) => { f.onBlur(); onBlur?.(e); }}
      style={{ ...FIELD_BASE, ...f.ring, ...style }}
    />
  );
}

export function Textarea({ style, onFocus, onBlur, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const f = useFocusRing();
  return (
    <textarea
      {...rest}
      onFocus={(e) => { f.onFocus(); onFocus?.(e); }}
      onBlur={(e) => { f.onBlur(); onBlur?.(e); }}
      style={{ ...FIELD_BASE, resize: "vertical", ...f.ring, ...style }}
    />
  );
}

export function Select({ style, onFocus, onBlur, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const f = useFocusRing();
  return (
    <select
      {...rest}
      onFocus={(e) => { f.onFocus(); onFocus?.(e); }}
      onBlur={(e) => { f.onBlur(); onBlur?.(e); }}
      style={{ ...FIELD_BASE, cursor: "pointer", ...f.ring, ...style }}
    >{children}</select>
  );
}

const LABEL_STYLE: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", marginBottom: 5 };

// Label + control wrapper that associates the two via htmlFor/id (accessibility).
export function Field({ label, children, style, labelStyle }: {
  label: string; children: (id: string) => React.ReactNode; style?: React.CSSProperties; labelStyle?: React.CSSProperties;
}) {
  const id = useId();
  return (
    <div style={style}>
      <label htmlFor={id} style={{ ...LABEL_STYLE, ...labelStyle }}>{label}</label>
      {children(id)}
    </div>
  );
}

// ============================================================================
//  Accessible modal — role="dialog" + aria-modal, Escape to close, focus trap,
//  focus restore, and body scroll-lock. Replaces the bare click-to-close
//  overlay so every modal in the app is keyboard-operable.
// ============================================================================
export function Modal({ children, onClose, width = 460, label }: {
  children: React.ReactNode; onClose: () => void; width?: number; label?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      ) ?? []).filter((el) => el.offsetParent !== null);

    // Move focus into the dialog.
    (focusables()[0] ?? panelRef.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key === "Tab") {
        const els = focusables();
        if (els.length === 0) { e.preventDefault(); return; }
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(17,22,58,0.42)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={label ? undefined : titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ width, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", background: color.surface, borderRadius: 16, padding: 24, boxShadow: "0 24px 60px rgba(17,22,58,0.3)", outline: "none" }}
      >{children}</div>
    </div>
  );
}

// ============================================================================
//  Error boundary — catches render errors so one broken screen doesn't blank
//  the whole app. (Empty states remain the default for "no data"; this is for
//  genuine unexpected failures.)
// ============================================================================
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to the console for diagnostics; a real deployment would report this.
    console.error("Screen crashed:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <Card style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: color.ink, marginBottom: 6 }}>
              Something went wrong on this screen
            </div>
            <div style={{ fontSize: 13.5, color: color.subtle, marginBottom: 18 }}>
              An unexpected error stopped this view from rendering. Try again, or reload the page.
            </div>
            <Button variant="secondary" onClick={() => this.setState({ error: null })} style={{ margin: "0 auto" }}>
              Try again
            </Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
