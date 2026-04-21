import Link from 'next/link';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

import { AdminTimelineNav } from '@/components/admin-timeline-nav';
import { SessionAdminHeaderControls } from '@/components/session-admin-header-controls';
import { ThemeToggle } from '@/components/theme-toggle';
import { UiLanguageToggle } from '@/components/ui-language-toggle';
import { getSessionAdminHeaderState } from '@/lib/session-admin-state';
import { getUiLanguageFromCookieValue, getUiText, UI_LANGUAGE_COOKIE_NAME } from '@/lib/ui-language';

type AdminShellProps = {
  actions?: ReactNode;
  children: ReactNode;
  currentStep?: number;
  description?: string;
  sessionId?: string;
  slug?: string;
  subtitle?: string;
  title: string;
};

export async function AdminShell({
  actions,
  children,
  currentStep,
  description,
  sessionId,
  slug,
  subtitle,
  title
}: AdminShellProps) {
  const showTimeline = typeof currentStep === 'number' && sessionId && slug;
  const isSessionAdminPage = Boolean(sessionId && slug);
  const sessionHeaderState = isSessionAdminPage && sessionId ? await getSessionAdminHeaderState(sessionId) : null;
  const cookieStore = await cookies();
  const uiLanguage = getUiLanguageFromCookieValue(cookieStore.get(UI_LANGUAGE_COOKIE_NAME)?.value);
  const t = getUiText(uiLanguage);
  const classBadgeLabel = sessionHeaderState?.sessionContext.className?.trim() || t.shared.notSet;
  const programmeBadgeLabel = sessionHeaderState?.sessionContext.programme?.trim() || t.shared.notSet;
  const sessionDateBadgeLabel = sessionHeaderState?.sessionContext.sessionDate?.trim() || t.shared.notSet;
  const sessionLanguageBadgeLabel = sessionHeaderState?.sessionLanguage === 'fr' ? 'FR' : 'EN';

  return (
    <main className="min-h-screen">
      <div
        className={`mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 sm:px-6 lg:px-8 ${
          isSessionAdminPage ? 'pb-4 pt-0' : 'py-4 lg:py-6'
        }`}
      >
        <section
          className={`ui-shell ${isSessionAdminPage ? 'sticky top-0 z-50 px-4 py-4 backdrop-blur-md sm:px-5 sm:py-4' : 'px-5 py-5 sm:px-6 sm:py-6'}`}
        >
          {isSessionAdminPage && sessionId && slug && sessionHeaderState ? (
            <div className="grid gap-2.5">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                <div className="min-w-0 space-y-1.5">
                  <h1 className="ui-session-admin-title">
                    {sessionHeaderState.sessionTitle || title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="ui-chip ui-chip-accent shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px]">
                      {classBadgeLabel}
                    </span>
                    <span className="ui-chip shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px]">
                      {t.shared.programme} {programmeBadgeLabel}
                    </span>
                    <span className="ui-chip shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px]">
                      {t.shared.date} {sessionDateBadgeLabel}
                    </span>
                    <span className="ui-chip shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                      {sessionLanguageBadgeLabel}
                    </span>
                  </div>
                </div>

                <SessionAdminHeaderControls
                  currentStep={currentStep}
                  sessionId={sessionId}
                  sessionTitle={sessionHeaderState.sessionTitle || title}
                  state={sessionHeaderState}
                />
              </div>

              <AdminTimelineNav currentStep={currentStep ?? 1} sessionId={sessionId} slug={slug} />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--app-fg-muted)]">
                    <span className="ui-chip ui-chip-accent">{t.shared.teacherAdmin}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="truncate">
                      <Link className="hover:text-[color:var(--app-accent-strong)]" href="/sessions">
                        {t.shared.sessions}
                      </Link>
                    </span>
                    {slug ? (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="truncate">{slug}</span>
                      </>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    {subtitle ? <p className="ui-section-title">{subtitle}</p> : null}
                    <h1 className="ui-page-title">{title}</h1>
                    {description ? <p className="max-w-3xl ui-page-copy">{description}</p> : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-start justify-end gap-3 self-start">
                  {actions}
                  <UiLanguageToggle />
                  <ThemeToggle />
                </div>
              </div>

              {showTimeline ? (
                <div className="mt-5">
                  <AdminTimelineNav currentStep={currentStep} sessionId={sessionId} slug={slug} />
                </div>
              ) : null}
            </>
          )}
        </section>

        <div className="pb-8">{children}</div>
      </div>
    </main>
  );
}
