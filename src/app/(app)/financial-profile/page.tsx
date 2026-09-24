import type { Metadata } from "next";
import Link from "next/link";
import { deleteAssetAction, deleteProfileAction } from "@/app/actions/financial-profile";
import { ConfirmDelete } from "@/components/confirm-delete";
import { SuccessAlert } from "@/components/forms/alerts";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { profileStatusMessage } from "@/config/profile-status";
import { requireUser } from "@/lib/auth/session";
import {
  ASSET_CATEGORY_LABELS,
  ASSET_GROUP_DESCRIPTIONS,
  ASSET_GROUP_LABELS,
  HOUSING_STATUS_LABELS,
} from "@/lib/domain/financial-profile";
import { formatRupiah } from "@/lib/format/currency";
import type { FinancialProfile } from "@/lib/repositories/financial-profiles";
import { getFinancialOverview, type AssetGroupSummary } from "@/lib/services/financial-profile";

export const metadata: Metadata = { title: "Financial Profile" };

const EDIT_PATH = "/financial-profile/edit";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700";
const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:bg-canvas";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });

export default async function FinancialProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { status } = await searchParams;
  const message = profileStatusMessage(status);
  const overview = getFinancialOverview(user.id);
  const { profile } = overview;

  return (
    <>
      <PageHeader
        eyebrow="Financial Profile"
        title="Your financial position"
        description="The income, costs, housing and assets your retirement plan will be built on."
      />

      {message ? (
        <div className="mb-6">
          <SuccessAlert>{message}</SuccessAlert>
        </div>
      ) : null}

      {profile ? <ProfileDetails profile={profile} groups={overview.groups} totals={overview.totals} accountCount={overview.accountCount} /> : <EmptyProfile />}
    </>
  );
}

function EmptyProfile() {
  return (
    <section className="grid place-items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
        <Icon name="wallet" className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">You haven&apos;t created a financial profile yet</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted">
        It takes about two minutes: your age and retirement goal, monthly income and expenses, and
        your housing situation. You can add savings, investments, JHT and pension balances next.
      </p>
      <Link href={EDIT_PATH} className={`${primaryButton} mt-6`}>
        <Icon name="plus" className="size-4" />
        Create financial profile
      </Link>
    </section>
  );
}

function ProfileDetails({
  profile,
  groups,
  totals,
  accountCount,
}: {
  profile: FinancialProfile;
  groups: AssetGroupSummary[];
  totals: { savings: number; pension: number; all: number };
  accountCount: number;
}) {
  const years = profile.targetRetirementAge - profile.currentAge;

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="profile-summary-title"
        className="rounded-2xl border border-line bg-surface shadow-xs"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 id="profile-summary-title" className="text-base font-semibold">
              Profile
            </h2>
            <p className="mt-1 text-xs text-muted">
              Last updated {dateFormatter.format(new Date(profile.updatedAt))}
            </p>
          </div>
          <Link href={EDIT_PATH} className={secondaryButton}>
            <Icon name="pencil" className="size-4" />
            Edit profile
          </Link>
        </div>

        <div className="grid grid-cols-1 divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          <DetailGroup title="Personal">
            <Detail label="Current age" value={`${profile.currentAge} years`} />
            <Detail label="Target retirement age" value={`${profile.targetRetirementAge} years`} />
            <Detail label="Years to retirement" value={`${years} ${years === 1 ? "year" : "years"}`} />
            <Detail label="City" value={profile.city ?? "Not set"} muted={!profile.city} />
          </DetailGroup>
          <DetailGroup title="Monthly finances">
            <Detail label="Income" value={formatRupiah(profile.monthlyIncome)} />
            <Detail label="Living expenses" value={formatRupiah(profile.monthlyExpenses)} />
          </DetailGroup>
          <DetailGroup title="Housing">
            <Detail label="Status" value={HOUSING_STATUS_LABELS[profile.housingStatus]} />
            {profile.housingStatus === "own" && profile.propertyValue !== null ? (
              <Detail label="Property value" value={formatRupiah(profile.propertyValue)} />
            ) : null}
            {profile.housingStatus === "rent" && profile.monthlyRent !== null ? (
              <Detail label="Monthly rent" value={formatRupiah(profile.monthlyRent)} />
            ) : null}
          </DetailGroup>
        </div>
      </section>

      <section aria-labelledby="assets-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="assets-title" className="text-lg font-semibold">
              Assets
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {accountCount === 0
                ? "No assets recorded yet."
                : `Savings & investments ${formatRupiah(totals.savings)} · JHT & pensions ${formatRupiah(totals.pension)}`}
            </p>
          </div>
          <Link href="/financial-profile/assets/new" className={primaryButton}>
            <Icon name="plus" className="size-4" />
            Add asset
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <AssetGroupCard key={group.group} summary={group} />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="danger-title"
        className="flex flex-col gap-4 rounded-2xl border border-red-200 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div>
          <h2 id="danger-title" className="text-base font-semibold">
            Delete financial profile
          </h2>
          <p className="mt-1 text-sm text-muted">
            Removes your profile and all {accountCount} asset {accountCount === 1 ? "record" : "records"}. This
            cannot be undone.
          </p>
        </div>
        <ConfirmDelete
          action={deleteProfileAction}
          title="Delete your financial profile?"
          description={
            <>
              Your personal, monthly, housing and asset information ({accountCount}{" "}
              {accountCount === 1 ? "record" : "records"}) will be permanently deleted. Your dashboard
              will be empty until you create a new profile.
            </>
          }
          triggerLabel="Delete profile"
          confirmLabel="Delete everything"
        />
      </section>
    </div>
  );
}

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      <dl className="mt-3 space-y-2.5 text-sm">{children}</dl>
    </div>
  );
}

function Detail({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right font-medium ${muted ? "text-muted" : ""}`}>{value}</dd>
    </div>
  );
}

function AssetGroupCard({ summary }: { summary: AssetGroupSummary }) {
  const { group, accounts, total } = summary;
  const headingId = `group-${group}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col rounded-2xl border border-line bg-surface shadow-xs"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h3 id={headingId} className="text-sm font-semibold">
            {ASSET_GROUP_LABELS[group]}
          </h3>
          <p className="mt-0.5 text-xs text-muted">{ASSET_GROUP_DESCRIPTIONS[group]}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold">{formatRupiah(total)}</p>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-6 text-center">
          <p className="text-sm text-muted">Nothing recorded yet.</p>
          <Link
            href={`/financial-profile/assets/new?group=${group}`}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            + Add {ASSET_GROUP_LABELS[group].split(" –")[0]}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center gap-2 py-3 pl-5 pr-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium break-words sm:truncate">{account.name}</p>
                <p className="text-xs text-muted sm:truncate">
                  {ASSET_CATEGORY_LABELS[account.category]}
                  {account.institution ? ` · ${account.institution}` : ""}
                </p>
                {/* On phones the balance sits under the name so names aren't truncated. */}
                <p className="mt-1 text-sm font-semibold tabular-nums sm:hidden">
                  {formatRupiah(account.balance)}
                </p>
              </div>
              <p className="hidden shrink-0 text-sm font-semibold tabular-nums sm:block">
                {formatRupiah(account.balance)}
              </p>
              <div className="flex shrink-0 items-center">
                <Link
                  href={`/financial-profile/assets/${account.id}/edit`}
                  aria-label={`Edit ${account.name}`}
                  className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
                >
                  <Icon name="pencil" className="size-5" />
                </Link>
                <ConfirmDelete
                  action={deleteAssetAction}
                  hiddenFields={{ id: account.id }}
                  variant="icon"
                  triggerLabel="Delete"
                  triggerAriaLabel={`Delete ${account.name}`}
                  title={`Delete “${account.name}”?`}
                  description={
                    <>
                      This removes the {ASSET_CATEGORY_LABELS[account.category].toLowerCase()} record with a
                      balance of {formatRupiah(account.balance)}.
                    </>
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
