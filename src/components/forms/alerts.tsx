import { Icon } from "../icons";

export function ErrorAlert({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
    >
      <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function SuccessAlert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      data-testid="success-message"
      className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-3 text-sm text-brand-800"
    >
      <Icon name="check" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

const BANNER_STYLES = {
  success: "border-brand-200 bg-brand-50 text-brand-800",
  info: "border-line bg-canvas text-ink",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
} as const;

const BANNER_ICON = { success: "check", info: "info", warning: "alert" } as const;

/** A status banner in one of three tones, for outcomes that are neither a plain success nor an error. */
export function Banner({
  tone,
  children,
}: {
  tone: keyof typeof BANNER_STYLES;
  children: React.ReactNode;
}) {
  return (
    <p
      role="status"
      data-testid="success-message"
      className={`flex items-start gap-2 rounded-lg border px-3.5 py-3 text-sm ${BANNER_STYLES[tone]}`}
    >
      <Icon name={BANNER_ICON[tone]} className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
