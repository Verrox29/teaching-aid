import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminTimelineNav } from '@/components/admin-timeline-nav';
import { SessionAdminHeaderControls } from '@/components/session-admin-header-controls';
import { ThemeToggle } from '@/components/theme-toggle';
import { getSessionAdminHeaderState } from '@/lib/session-admin-state';

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

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <section
          className={`ui-shell ${isSessionAdminPage ? 'px-4 py-4 sm:px-5 sm:py-4' : 'px-5 py-5 sm:px-6 sm:py-6'}`}
        >
          {isSessionAdminPage && sessionId && slug && sessionHeaderState ? (
            <SessionAdminHeaderControls sessionId={sessionId} slug={slug} state={sessionHeaderState} />
          ) : (
            <>
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--app-fg-muted)]">
                    <span className="ui-chip ui-chip-accent">Teacher admin</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="truncate">
                      <Link className="hover:text-[color:var(--app-accent-strong)]" href="/sessions">
                        Sessions
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

                <div className="flex flex-wrap items-center gap-3">
                  {actions}
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
