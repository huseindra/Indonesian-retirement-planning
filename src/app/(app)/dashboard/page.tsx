import type { Metadata } from "next";
import { ChartPlaceholder } from "@/components/chart-placeholder";
import { PageHeader } from "@/components/page-header";
import { SummaryCard } from "@/components/summary-card";
import { ASSET_CATEGORY_LABELS } from "@/config/asset-categories";
import { requireUser } from "@/lib/auth/session";
import { formatRupiah, formatRupiahCompact } from "@/lib/format/currency";
import { getDashboardSummary, type DashboardSummary } from "@/lib/services/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const summary = getDashboardSummary(user.id);
  const { profile, savings } = summary;
  const firstName = user.fullName.split(/\s+/)[0];

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={`Selamat datang, ${firstName}`}
        description="A snapshot of where you stand today. Projections will appear here as more planning tools are added."
      />

      <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Current Age"
          icon="calendar"
          value={profile ? `${profile.currentAge} years` : "—"}
          detail={profile ? `Living in ${profile.city}` : "Add your date of birth"}
        />
        <SummaryCard
          label="Target Retirement Age"
          icon="flag"
          value={profile ? `${profile.targetRetirementAge} years` : "—"}
          detail={
            profile
              ? profile.yearsToRetirement > 0
                ? `${profile.yearsToRetirement} years from now`
                : "You have reached your target age"
              : "Set a target retirement age"
          }
        />
        <SummaryCard
          label="Current Savings"
          icon="piggy"
          value={formatRupiah(savings.currentSavings)}
          detail={
            savings.pensionAssets > 0
              ? `+ ${formatRupiahCompact(savings.pensionAssets)} in pension funds`
              : "Cash, deposits and investments"
          }
        />
        <SummaryCard
          label="Estimated Retirement Fund"
          icon="target"
          placeholder
          value={
            summary.estimatedRetirementFund === null
              ? "Not yet calculated"
              : formatRupiah(summary.estimatedRetirementFund)
          }
          detail="Available once your Retirement Plan is set up."
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartPlaceholder />
        </div>
        <CashFlowPanel profile={profile} />
      </div>

      <AssetBreakdown savings={savings} />
    </>
  );
}

function CashFlowPanel({ profile }: { profile: DashboardSummary["profile"] }) {
  const surplus = profile ? profile.monthlyIncome - profile.monthlyExpenses : null;

  return (
    <section
      aria-labelledby="cash-flow-title"
      className="rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-6"
    >
      <h2 id="cash-flow-title" className="text-base font-semibold">
        Monthly cash flow
      </h2>
      <p className="mt-1 text-sm text-muted">From your financial profile.</p>

      {profile && surplus !== null ? (
        <dl className="mt-5 divide-y divide-line text-sm">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted">Income</dt>
            <dd className="font-medium">{formatRupiah(profile.monthlyIncome)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted">Living expenses</dt>
            <dd className="font-medium">{formatRupiah(profile.monthlyExpenses)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="font-medium">Left over</dt>
            <dd className={`font-semibold ${surplus >= 0 ? "text-brand-700" : "text-red-700"}`}>
              {formatRupiah(surplus)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-5 text-sm text-muted">No financial profile yet.</p>
      )}
    </section>
  );
}

function AssetBreakdown({ savings }: { savings: DashboardSummary["savings"] }) {
  const total = savings.currentSavings + savings.pensionAssets;

  return (
    <section
      aria-labelledby="assets-title"
      className="mt-6 rounded-2xl border border-line bg-surface shadow-xs lg:mt-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2 id="assets-title" className="text-base font-semibold">
            Savings & pension assets
          </h2>
          <p className="mt-1 text-sm text-muted">
            {savings.accounts.length} accounts · total {formatRupiah(total)}
          </p>
        </div>
      </div>

      {savings.accounts.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted sm:px-6">No accounts recorded yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {savings.accounts.map((account) => {
            const share = total > 0 ? (account.balance / total) * 100 : 0;
            return (
              <li key={account.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{account.name}</p>
                    <p className="text-xs text-muted">
                      {ASSET_CATEGORY_LABELS[account.category]}
                      {account.institution ? ` · ${account.institution}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatRupiah(account.balance)}</p>
                </div>
                <div
                  className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-canvas"
                  role="presentation"
                >
                  <div
                    className={`h-full rounded-full ${
                      account.category === "pension" ? "bg-brand-800" : "bg-brand-500"
                    }`}
                    style={{ width: `${share.toFixed(1)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
