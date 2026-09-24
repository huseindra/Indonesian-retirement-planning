"use client";

import { useState } from "react";
import { describedBy, inputClass } from "./field";

const groupFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Formats digits with Indonesian thousand separators as the user types. */
export function formatDigits(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits ? groupFormatter.format(Number(digits)) : "";
}

/**
 * Rupiah amount input. Shows `Rp` and dot separators (25.000.000) while
 * submitting the formatted string, which the server parses.
 */
export function MoneyInput({
  name,
  defaultValue,
  error,
  hasHint = false,
  required = false,
  disabled = false,
}: {
  name: string;
  defaultValue?: string | number | null;
  error?: string;
  hasHint?: boolean;
  required?: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(() =>
    defaultValue === null || defaultValue === undefined ? "" : formatDigits(String(defaultValue)),
  );

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm text-muted"
      >
        Rp
      </span>
      <input
        id={name}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        maxLength={25}
        value={value}
        onChange={(event) => setValue(formatDigits(event.target.value))}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hasHint, error)}
        className={`${inputClass} pl-10 tabular-nums`}
      />
    </div>
  );
}
