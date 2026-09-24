export function PageHeader({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="mb-6 lg:mb-8">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">{eyebrow}</p>
      ) : null}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {description ? <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{description}</p> : null}
    </header>
  );
}
