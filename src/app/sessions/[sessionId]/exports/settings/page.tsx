import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { saveExportMappingAction, saveExportTemplateAction } from '../actions';

import { AdminShell } from '@/components/admin-shell';
import { BranchingAiSettingsPanel } from '@/components/branching-ai-settings-panel';
import { db, sessions } from '@/db';
import { getBranchingAiAdminAccessState } from '@/lib/ai/admin-auth';
import { getBranchingAiAdminView } from '@/lib/ai';
import { getActiveExportVersions, listExportMappingVersions, listExportTemplateVersions } from '@/lib/exports/repository';
import { recordSessionAdminPath } from '@/lib/session-navigation';

type SessionExportSettingsPageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SessionExportSettingsPage({
  params,
  searchParams
}: SessionExportSettingsPageProps) {
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

  await recordSessionAdminPath(sessionId, `/sessions/${sessionId}/exports/settings`);

  const branchingAiAccessState = await getBranchingAiAdminAccessState();
  const branchingAiView = branchingAiAccessState.unlocked ? await getBranchingAiAdminView() : null;
  const active = await getActiveExportVersions();
  const templateVersions = await listExportTemplateVersions();
  const mappingVersions = await listExportMappingVersions();

  return (
    <AdminShell
      actions={
        <>
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/exports`}>
            Back to exports
          </Link>
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/evaluation`}>
            AI scoring
          </Link>
        </>
      }
      currentStep={5}
      description="Manage the active Pairagogie template, mapping, and Branching AI setup."
      sessionId={sessionId}
      slug={session.slug}
      subtitle="Main admin settings"
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

      <section className="mb-6">
        <BranchingAiSettingsPanel
          accessState={branchingAiAccessState}
          initialView={branchingAiView}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
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
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <form action={saveExportTemplateAction} className="ui-panel grid gap-4 p-6" encType="multipart/form-data">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Template upload</h2>
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              Upload a replacement `.xlsx` template. Validation runs before activation.
            </p>
          </div>

          <input name="sessionId" type="hidden" value={sessionId} />
          <label className="grid gap-2 text-sm font-medium">
            Template file
            <input
              accept=".xlsx,.xls"
              className="ui-input"
              name="templateFile"
              type="file"
            />
          </label>

          <label className="flex items-center gap-3 text-sm font-medium">
            <input defaultChecked name="activate" type="checkbox" />
            Activate after validation
          </label>

          <div className="flex justify-end">
            <button className="ui-button ui-button-primary" type="submit">
              Upload template
            </button>
          </div>

          <div className="space-y-2">
            <p className="ui-section-title">Available template versions</p>
            <div className="grid gap-2">
              {templateVersions.map((version) => (
                <div
                  key={version.version}
                  className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{version.version}</span>
                    <span className="ui-chip">{version.isActive ? 'Active' : 'Draft'}</span>
                  </div>
                  <p className="text-[color:var(--app-fg-muted)]">{version.fileName}</p>
                </div>
              ))}
            </div>
          </div>
        </form>

        <form action={saveExportMappingAction} className="ui-panel grid gap-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Mapping editor</h2>
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              Paste the structured mapping JSON. Validation runs before activation.
            </p>
          </div>

          <input name="sessionId" type="hidden" value={sessionId} />
          <textarea
            className="ui-textarea font-mono text-sm"
            defaultValue={JSON.stringify(active.mapping.mappingJson, null, 2)}
            name="mappingText"
          />

          <label className="flex items-center gap-3 text-sm font-medium">
            <input defaultChecked name="activate" type="checkbox" />
            Activate after validation
          </label>

          <div className="flex justify-end">
            <button className="ui-button ui-button-primary" type="submit">
              Save mapping
            </button>
          </div>

          <div className="space-y-2">
            <p className="ui-section-title">Available mapping versions</p>
            <div className="grid gap-2">
              {mappingVersions.map((version) => (
                <div
                  key={version.version}
                  className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{version.version}</span>
                    <span className="ui-chip">{version.isActive ? 'Active' : 'Draft'}</span>
                  </div>
                  <p className="text-[color:var(--app-fg-muted)]">
                    Template link: {version.templateVersion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
