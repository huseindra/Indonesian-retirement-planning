import { describedBy, inputClass } from "./field";

interface SuffixedInputProps {
  name: string;
  defaultValue: string;
  error?: string;
  hasHint?: boolean;
  placeholder?: string;
}

/** Text input with a unit shown inside the right edge (e.g. "years", "%"). */
function SuffixedInput({
  suffix,
  inputMode,
  maxLength,
  name,
  defaultValue,
  error,
  hasHint = false,
  placeholder,
}: SuffixedInputProps & { suffix: string; inputMode: "numeric" | "decimal"; maxLength: number }) {
  return (
    <div className="relative">
      <input
        id={name}
        name={name}
        type="text"
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete="off"
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hasHint, error)}
        className={`${inputClass} pr-24 tabular-nums`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-sm text-muted"
      >
        {suffix}
      </span>
    </div>
  );
}

/** Whole-number age in years. */
export function AgeInput(props: SuffixedInputProps) {
  return <SuffixedInput {...props} suffix="years" inputMode="numeric" maxLength={3} />;
}

/** Annual rate typed as a percentage, e.g. 3 or 3,5. */
export function PercentInput(props: SuffixedInputProps) {
  return <SuffixedInput {...props} suffix="% per year" inputMode="decimal" maxLength={7} />;
}
