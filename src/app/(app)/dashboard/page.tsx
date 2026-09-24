import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { ReadinessSummary, RetirementChart } from "@/components/retirement/readiness";
import { SummaryCard } from "@/components/summary-card";
import { requireUser } from "@/lib/auth/session";
import { ASSET_GROUP_LABELS, HOUSING_STATUS_LABELS, isPensionGroup } from "@/lib/domain/financial-profile";
import { formatRupiah, formatRupiahCompact } from "@/lib/format/currency";
import { getDashboardSummary, type DashboardSummary } from "@/lib/services/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

const PROFILE_PATH = "/financial-profile";
const PROFILE_EDIT_PATH = "/financial-profile/edit";

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
        description="A snapshot of where you stand today, based on your financial profile. Projections will appear here as more planning tools are added."
      />

      {profile ? null : <CompleteProfilePrompt />}

      <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Current Age"
          icon="calendar"
          placeholder={!profile}
          placeholderLabel="Not set"
          value={profile ? `${profile.currentAge} years` : "—"}
          detail={profile ? "From your financial profile" : <ProfileLink>Add your age</ProfileLink>}
        />
        <SummaryCard
          label="Target Retirement Age"
          icon="flag"
          placeholder={!profile}
          placeholderLabel="Not set"
          value={profile ? `${profile.targetRetirementAge} years` : "—"}
          detail={
            profile ? (
              `${profile.yearsToRetirement} ${profile.yearsToRetirement === 1 ? "year" : "years"} from now`
            ) : (
              <ProfileLink>Set a target age</ProfileLink>
            )
          }
        />
        <SummaryCard
          label="Current Savings"
          icon="piggy"
          placeholder={savings.accountCount === 0}
          placeholderLabel="Not set"
          value={savings.accountCount > 0 ? formatRupiah(savings.currentSavings) : "—"}
          detail={
            savings.accountCount === 0 ? (
              profile ? (
                <ProfileLink href={PROFILE_PATH}>Record your savings</ProfileLink>
              ) : (
                "Recorded in your financial profile"
              )
            ) : savings.pensionAssets > 0 ? (
              `+ ${formatRupiahCompact(savings.pensionAssets)} in JHT & pension funds`
            ) : (
              "Cash, savings and investments"
            )
          }
        />
        <SummaryCard
          label="Estimated Retirement Fund"
          icon="target"
          placeholder={summary.retirement.status !== "ready"}
          placeholderLabel="Not set"
          value={
            summary.retirement.status === "ready"
              ? formatRupiah(summary.retirement.result.projectedAssets.total)
              : "Not yet calculated"
          }
          detail={
            summary.retirement.status === "ready"
              ? `Projected at age ${summary.retirement.result.input.retirementAge} · ${formatRupiahCompact(
                  summary.retirement.result.requiredFund,
                )} needed`
              : "Available once your financial profile is complete."
          }
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RetirementReadinessPanel retirement={summary.retirement} />
        </div>
        <CashFlowPanel profile={profile} />
      </div>

      {profile ? <AssetGroupsPanel savings={savings} /> : null}
    </>
  );
}

function ProfileLink({ href = PROFILE_EDIT_PATH, children }: { href?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-brand-700 underline-offset-2 hover:underline">
      {children} →
    </Link>
  );
}

function CompleteProfilePrompt() {
  return (
    <section
      aria-labelledby="complete-profile-title"
      className="mb-6 flex flex-col gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-5 sm:flex-row sm:items-center sm:p-6 lg:mb-8"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-brand-700 shadow-xs">
        <Icon name="wallet" className="size-6" />
      </span>
      <div className="flex-1">
        <h2 id="complete-profile-title" className="text-base font-semibold text-brand-900">
          Complete your financial profile
        </h2>
        <p className="mt-1 text-sm text-brand-800">
          Add your age, income, living costs, housing and savings. Your dashboard will fill in
          as soon as it is saved — until then we won&apos;t show any figures.
        </p>
      </div>
      <Link
        href={PROFILE_EDIT_PATH}
        className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
      >
        Start profile
      </Link>
    </section>
  );
}

function CashFlowPanel({ profile }: { profile: DashboardSummary["profile"] }) {
  const rent = profile?.monthlyRent ?? 0;
  const leftOver = profile ? profile.monthlyIncome - profile.monthlyExpenses - rent : 0;

  return (
    <section
      aria-labelledby="cash-flow-title"
      className="rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-6"
    >
      <h2 id="cash-flow-title" className="text-base font-semibold">
        Monthly cash flow
      </h2>
      <p className="mt-1 text-sm text-muted">From your financial profile.</p>

      {profile ? (
        <>
          <dl className="mt-5 divide-y divide-line text-sm">
            <Row label="Income" value={formatRupiah(profile.monthlyIncome)} />
            <Row label="Living expenses" value={formatRupiah(profile.monthlyExpenses)} />
            {profile.housingStatus === "rent" ? <Row label="Rent" value={formatRupiah(rent)} /> : null}
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="font-medium">Left over</dt>
              <dd className={`font-semibold ${leftOver >= 0 ? "text-brand-700" : "text-red-700"}`}>
                {formatRupiah(leftOver)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 rounded-lg bg-canvas px-3 py-2.5 text-xs text-muted">
            <span className="font-medium text-ink">Housing: </span>
            {HOUSING_STATUS_LABELS[profile.housingStatus]}
            {profile.housingStatus === "own" && profile.propertyValue !== null
              ? ` · valued at ${formatRupiah(profile.propertyValue)}`
              : ""}
          </p>
        </>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No income or expenses recorded yet.
          <div className="mt-2">
            <ProfileLink>Add monthly finances</ProfileLink>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function AssetGroupsPanel({ savings }: { savings: DashboardSummary["savings"] }) {
  const total = savings.currentSavings + savings.pensionAssets;

  return (
    <section
      aria-labelledby="assets-title"
      className="mt-6 rounded-2xl border border-line bg-surface shadow-xs lg:mt-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2 id="assets-title" className="text-base font-semibold">
            Savings & pension assets
          </h2>
          <p className="mt-1 text-sm text-muted">
            {savings.accountCount} {savings.accountCount === 1 ? "record" : "records"} · total{" "}
            {formatRupiah(total)}
          </p>
        </div>
        <Link href={PROFILE_PATH} className="text-sm font-medium text-brand-700 hover:underline">
          Manage assets →
        </Link>
      </div>

      {savings.accountCount === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted sm:px-6">
          No assets recorded yet. <ProfileLink href={PROFILE_PATH}>Add your first asset</ProfileLink>
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {savings.groups.map(({ group, total: groupTotal, accounts }) => {
            const share = total > 0 ? (groupTotal / total) * 100 : 0;
            return (
              <li key={group} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{ASSET_GROUP_LABELS[group]}</p>
                    <p className="text-xs text-muted">
                      {accounts.length} {accounts.length === 1 ? "record" : "records"}
                      {total > 0 ? ` · ${share.toFixed(0)}% of total` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatRupiah(groupTotal)}</p>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-canvas" role="presentation">
                  <div
                    className={`h-full rounded-full ${isPensionGroup(group) ? "bg-brand-800" : "bg-brand-500"}`}
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

function RetirementReadinessPanel({ retirement }: { retirement: DashboardSummary["retirement"] }) {
  return (
    <section
      aria-labelledby="readiness-title"
      className="h-full rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="readiness-title" className="text-base font-semibold">
            Retirement readiness
          </h2>
          <p className="mt-1 text-sm text-muted">An estimate based on your profile and assumptions.</p>
        </div>
        <Link href="/retirement-plan" className="text-sm font-medium text-brand-700 hover:underline">
          View retirement plan →
        </Link>
      </div>

      {retirement.status === "ready" ? (
        <div className="mt-5 grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <ReadinessSummary result={retirement.result} compact />
          </div>
          <div className="xl:col-span-3">
            <RetirementChart result={retirement.result} />
          </div>
        </div>
      ) : retirement.status === "error" ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800" role="alert">
          <p className="font-semibold">We couldn&apos;t calculate your retirement plan.</p>
          <p className="mt-1">{retirement.message}</p>
          <Link href="/retirement-plan" className="mt-2 inline-block font-semibold underline">
            Fix it in Retirement Plan
          </Link>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          Complete your financial profile to see whether your savings are on track for retirement.
          <div className="mt-2">
            <ProfileLink>Complete financial profile</ProfileLink>
          </div>
        </div>
      )}
    </section>
  );
}
