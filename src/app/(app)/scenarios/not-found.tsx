import Link from "next/link";
import { Icon } from "@/components/icons";

export default function ScenarioNotFound() {
  return (
    <section className="grid place-items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-canvas text-muted">
        <Icon name="info" className="size-6" />
      </span>
      <h1 className="mt-4 text-base font-semibold">Scenario not found</h1>
      <p className="mt-1.5 max-w-md text-sm text-muted">This scenario doesn&apos;t exist or may already have been deleted.</p>
      <Link href="/scenarios" className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Back to Scenarios
      </Link>
    </section>
  );
}
