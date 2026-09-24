import { Icon, type IconName } from "./icons";

export function SummaryCard({
  label,
  value,
  detail,
  icon,
  placeholder = false,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon: IconName;
  /** Renders the card as not-yet-available (dashed border, "Soon" badge). */
  placeholder?: boolean;
}) {
  return (
    <article
      className={[
        "flex flex-col rounded-2xl bg-surface p-5 shadow-xs",
        placeholder ? "border border-dashed border-line" : "border border-line",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium text-muted">{label}</h2>
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-lg ${
            placeholder ? "bg-canvas text-muted" : "bg-brand-50 text-brand-700"
          }`}
        >
          <Icon name={icon} className="size-5" />
        </span>
      </div>
      <p
        className={`mt-3 font-semibold tracking-tight break-words ${
          placeholder ? "text-lg text-muted" : "text-2xl text-ink"
        }`}
      >
        {value}
      </p>
      {detail ? <p className="mt-1.5 text-xs text-muted sm:text-sm">{detail}</p> : null}
      {placeholder ? (
        <span className="mt-3 inline-flex w-fit rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">
          Coming soon
        </span>
      ) : null}
    </article>
  );
}
