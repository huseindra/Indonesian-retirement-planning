export const inputClass =
  "block w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-base text-ink shadow-xs " +
  "placeholder:text-muted/70 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25 " +
  "disabled:opacity-60 aria-invalid:border-red-500 aria-invalid:ring-red-500/20 sm:text-sm";

/** Ids used to wire a control to its hint and error text. */
export function fieldIds(name: string) {
  return { hint: `${name}-hint`, error: `${name}-error` };
}

export function describedBy(name: string, hasHint: boolean, error?: string): string | undefined {
  const ids = fieldIds(name);
  const parts = [hasHint ? ids.hint : null, error ? ids.error : null].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

export function Field({
  name,
  label,
  hint,
  error,
  optional = false,
  children,
}: {
  name: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const ids = fieldIds(name);
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
        {optional ? <span className="ml-1 font-normal text-muted">(optional)</span> : null}
      </label>
      {hint ? (
        <p id={ids.hint} className="mt-0.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={ids.error} className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-6">
      <legend className="sr-only">{title}</legend>
      <h2 aria-hidden="true" className="text-base font-semibold">
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
