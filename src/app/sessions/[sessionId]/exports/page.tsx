import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin-shell';
import { ExportDownloadButton } from '@/components/export-download-button';
import { PendingNavigationLink } from '@/components/pending-navigation-link';
import { db, sessions } from '@/db';
import { shouldShowAdminDiagnostics } from '@/lib/admin-diagnostics';
import {
  getActiveExportVersions,
  getPairagogieExportContext,
  getSessionExportMetadataRecord
} from '@/lib/exports/repository';
import { recordSessionAdminPath } from '@/lib/session-navigation';

type SessionExportsPageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SessionExportsPage({
  params,
  searchParams
}: SessionExportsPageProps) {
  const { sessionId } = await params;
  const search = searchParams ? await searchParams : {};
  const notice = getSingleValue(search.notice);
  const error = getSingleValue(search.error);

  const rows = await db
    .select({
      slug: sessions.slug,
      title: sessions.title
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const session = rows[0] ?? null;

  if (!session) {
    notFound();
  }

  await recordSessionAdminPath(sessionId, `/sessions/${sessionId}/exports`);

  const active = await getActiveExportVersions();
  const context = await getPairagogieExportContext(sessionId);
  const metadata = await getSessionExportMetadataRecord(sessionId, session.title);
  const showAdminDiagnostics = shouldShowAdminDiagnostics();
  const exportReady =
    context.groups.length > 0 &&
    context.groups.every(
      (group) =>
        Boolean(group.evaluation?.teacherNotes?.trim()) &&
        Boolean(group.evaluation?.finalFeedback?.trim()) &&
        group.criteria.length > 0 &&
        group.criteria.every((criterion) => criterion.score !== null)
    );

  return (
    <AdminShell
      actions={
        <>
          <PendingNavigationLink className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/evaluation`}>
            AI scoring
          </PendingNavigationLink>
        </>
      }
      currentStep={4}
      description="Validate the export template, review the active mapping, and download the final files."
      sessionId={sessionId}
      slug={session.slug}
      subtitle="Grille & grades export"
      title={session.title}
    >
      {notice || error ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? 'border-[color:var(--app-danger)]/20 bg-[color:var(--app-danger)]/10 text-[color:var(--app-danger)]'
              : 'border-[color:var(--app-success)]/20 bg-[color:var(--app-success)]/10 text-[color:var(--app-success)]'
          }`}
        >
          {notice ?? error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="ui-card p-4">
          <p className="ui-section-title">Active template</p>
          <p className="mt-2 text-xl font-semibold">{active.template.version}</p>
          <p className="text-sm text-[color:var(--app-fg-muted)]">{active.template.fileName}</p>
        </div>
        <div className="ui-card p-4">
          <p className="ui-section-title">Active mapping</p>
          <p className="mt-2 text-xl font-semibold">{active.mapping.version}</p>
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            Template version: {active.mapping.templateVersion}
          </p>
        </div>
        <div className="ui-card p-4">
          <p className="ui-section-title">Group sheets</p>
          <p className="mt-2 text-xl font-semibold">{context.groups.length}</p>
          <p className="text-sm text-[color:var(--app-fg-muted)]">One cloned group sheet per export group.</p>
        </div>
      </section>

      <section className="ui-panel grid gap-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Session export metadata</h2>
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            These values are used in the Pairagogie template and the grades CSV.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ['Programme', metadata.programme],
            ['Class name', metadata.className],
            ['Subject', metadata.subject],
            ['Season', metadata.season],
            ['Professor name', metadata.professorName],
            ['Presentation date', metadata.sessionDate]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
              <p className="ui-section-title">{label}</p>
              <p className="mt-2 text-sm font-medium">{value || 'Not set'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ui-panel grid gap-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Validation</h2>
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            The current template and mapping must be compatible before activation or download.
          </p>
        </div>

        {context.validationIssues.length === 0 ? (
          <div className="ui-chip ui-chip-success px-4 py-3">Template and mapping are valid.</div>
        ) : (
          <div className="grid gap-2 rounded-2xl border border-[color:var(--app-danger)]/20 bg-[color:var(--app-danger)]/10 p-4 text-sm text-[color:var(--app-danger)]">
            {context.validationIssues.map((issue) => (
              <div key={issue}>{issue}</div>
            ))}
          </div>
        )}

        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            exportReady
              ? 'border-[color:var(--app-success)]/20 bg-[color:var(--app-success)]/10 text-[color:var(--app-success)]'
              : 'border-[color:var(--app-warning)]/20 bg-[color:var(--app-warning)]/10 text-[color:var(--app-warning)]'
          }`}
        >
          {exportReady
            ? 'Evaluation is ready for export.'
            : 'Some groups are still missing required notes, scores, or final feedback.'}
        </div>

        <div className="flex flex-wrap gap-3">
          <ExportDownloadButton
            downloadName={`pairagogie-${session.slug}.xlsx`}
            disabled={!exportReady}
            href={`/api/sessions/${sessionId}/exports/pairagogie`}
            label="Download Pairagogie Excel"
            variant="primary"
          />
          {showAdminDiagnostics ? (
            <ExportDownloadButton
              downloadName={`pairagogie-debug-${session.slug}.xlsx`}
              disabled={!exportReady}
              href={`/api/sessions/${sessionId}/exports/pairagogie?debug=1`}
              label="Download debug preview"
            />
          ) : null}
          <ExportDownloadButton
            downloadName={`grades-${session.slug}.csv`}
            disabled={!exportReady}
            href={`/api/sessions/${sessionId}/exports/grades`}
            label="Download grades CSV"
          />
          <ExportDownloadButton
            downloadName={`groups-${session.slug}.csv`}
            disabled={!exportReady}
            href={`/api/sessions/${sessionId}/exports/groups`}
            label="Download groups CSV"
          />
        </div>
      </section>
    </AdminShell>
  );
}
