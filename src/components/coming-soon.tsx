import Link from "next/link";
import type { NavItem } from "@/config/navigation";
import { Icon } from "./icons";
import { PageHeader } from "./page-header";

/** Placeholder page for a section that is listed in navigation but not built yet. */
export function ComingSoon({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader eyebrow="Coming soon" title={item.label} description={item.description} />
      <section className="grid place-items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
          <Icon name={item.icon} className="size-6" />
        </span>
        <h2 className="mt-4 text-base font-semibold">This section is on its way</h2>
        <p className="mt-1.5 max-w-md text-sm text-muted">
          {item.label} is planned for an upcoming release. Your dashboard already shows the data
          we have for you.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Back to dashboard
        </Link>
      </section>
    </>
  );
}
