import type { Metadata } from "next";
import Link from "next/link";
import { generateInsightsAction } from "@/app/actions/ai-insights";
import { Banner, SuccessAlert } from "@/components/forms/alerts";
import { AiBadge } from "@/components/ai-insights/badges";
import { InsightCard } from "@/components/ai-insights/insight-card";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { aiInsightsStatusMessage } from "@/config/ai-insights-status";
import { getAiProvider } from "@/lib/ai/get-provider";
import { requireUser } from "@/lib/auth/session";
import type { AiInsightEventRow, AiInsightRow } from "@/lib/repositories/ai-insights";
import { getAssumptions } from "@/lib/services/cost-projection";
import { getInsightsPage } from "@/lib/services/ai-insights";
import { GenerateSubmitButton } from "./generate-button";

export const metadata: Metadata = { title: "AI Insights" };

const card = "rounded-2xl border border-line bg-surface shadow-xs";
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700";

const OPEN_STATUSES = new Set(["pending", "edited", "accepted"]);

function appliedScenarioId(insightId: number, events: AiInsightEventRow[]): number | null {
  const event = events.find((e) => e.insightId === insightId && e.eventType === "applied");
  const detail = event?.detail as { createdScenarioId?: number } | null;
  return detail?.createdScenarioId ?? null;
}

export default async function AiInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; message?: string; count?: string }>;
}) {
  const user = await requireUser();
  const { status, message, count } = await searchParams;
  const banner = aiInsightsStatusMessage(status, message, count);
  const page = getInsightsPage(user.id);
  const selection = getAiProvider();
  const currentAssumptions =
    page.baseline.status === "ready" ? getAssumptions(user.id).values : null;

  return (
    <>
      <PageHeader
        eyebrow="AI Insights"
        title="AI-interpreted observations about your plan"
        description="The AI only explains figures your Retirement Plan, Living Costs and Scenarios pages already calculated — it never runs its own financial math, and nothing here changes your saved plan unless you accept and apply it yourself."
      />

      <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-line bg-surface px-3.5 py-3 text-xs text-muted">
        <AiBadge />
        <span>
          marks text written by the AI. Every figure it cites is copied from a deterministic calculation you can
          check on the <Link href="/retirement-plan" className="font-medium text-brand-700 hover:underline">Retirement Plan</Link>{" "}
          and <Link href="/scenarios" className="font-medium text-brand-700 hover:underline">Scenarios</Link> pages.
        </span>
      </p>

      {banner ? (
        <div className="mb-6">
          {banner.tone === "success" ? <SuccessAlert>{banner.text}</SuccessAlert> : <Banner tone={banner.tone}>{banner.text}</Banner>}
        </div>
      ) : null}

      {page.baseline.status === "incomplete" ? (
        <Incomplete />
      ) : page.baseline.status === "error" ? (
        <BaselineError message={page.baseline.message} />
      ) : (
        <Ready
          insights={page.insights}
          events={page.events}
          providerUnavailable={selection.provider === null}
          unavailableReason={selection.provider === null ? selection.reason : null}
          currentAssumptions={currentAssumptions}
        />
      )}
    </>
  );
}

function Incomplete() {
  return (
    <section className={`${card} grid place-items-center px-6 py-12 text-center`}>
      <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
        <Icon name="sparkle" className="size-6" />
      </span>
      <h2 className="mt-4 text-base font-semibold">Complete your financial profile to get AI Insights</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted">
        Insights are built from your Retirement Plan, so we need your age, target retirement age and living costs
        first.
      </p>
      <Link href="/financial-profile/edit" className={`${primaryButton} mt-6`}>
        Complete financial profile
      </Link>
    </section>
  );
}

function BaselineError({ message }: { message: string }) {
  return (
    <section className={`${card} px-6 py-8`}>
      <p className="flex items-start gap-2 text-sm text-red-800">
        <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-semibold">Your retirement plan has an inconsistency, so insights can&apos;t be
          calculated.</span> {message}{" "}
          <Link href="/retirement-plan" className="font-semibold underline">
            Fix it in Retirement Plan
          </Link>
          .
        </span>
      </p>
    </section>
  );
}

function Ready({
  insights,
  events,
  providerUnavailable,
  unavailableReason,
  currentAssumptions,
}: {
  insights: AiInsightRow[];
  events: AiInsightEventRow[];
  providerUnavailable: boolean;
  unavailableReason: string | null;
  currentAssumptions: { inflationBps: number; investmentReturnBps: number } | null;
}) {
  const open = insights.filter((i) => OPEN_STATUSES.has(i.status));
  const history = insights.filter((i) => !OPEN_STATUSES.has(i.status));

  return (
    <div className="space-y-6">
      <section className={`${card} flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6`}>
        <div>
          <h2 className="text-base font-semibold">Generate insights</h2>
          <p className="mt-1 text-sm text-muted">
            {providerUnavailable
              ? unavailableReason ?? "AI Insights are not configured for this deployment."
              : "Runs the AI against your current plan. You can always accept, edit, reject or dismiss what it finds."}
          </p>
        </div>
        <form action={generateInsightsAction}>
          <GenerateSubmitButton hasInsights={insights.length > 0} disabled={providerUnavailable} />
        </form>
      </section>

      {insights.length === 0 ? (
        <section className={`${card} grid place-items-center px-6 py-12 text-center`} data-testid="no-insights">
          <span className="grid size-12 place-items-center rounded-full bg-canvas text-muted">
            <Icon name="sparkle" className="size-6" />
          </span>
          <h2 className="mt-4 text-base font-semibold">No insights yet</h2>
          <p className="mt-1.5 max-w-md text-sm text-muted">
            {providerUnavailable
              ? "AI Insights need an AI service to be configured. The rest of the app works fully without it."
              : "Generate insights to see what the AI notices in your current plan."}
          </p>
        </section>
      ) : (
        <>
          {open.length > 0 ? (
            <section aria-labelledby="open-insights-title" className="space-y-4">
              <h2 id="open-insights-title" className="text-lg font-semibold">
                Needs your review
              </h2>
              {open.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  currentAssumptions={currentAssumptions}
                  appliedScenarioId={appliedScenarioId(insight.id, events)}
                />
              ))}
            </section>
          ) : null}

          {history.length > 0 ? (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline">
                History ({history.length})
              </summary>
              <div className="mt-4 space-y-4">
                {history.map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    currentAssumptions={currentAssumptions}
                    appliedScenarioId={appliedScenarioId(insight.id, events)}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
