import Link from 'next/link';

type AdminTimelineNavProps = {
  currentStep: number;
  sessionId: string;
  slug: string;
};

type AdminStep = {
  href: (sessionId: string, slug: string) => string;
  label: string;
  step: number;
};

const adminSteps: AdminStep[] = [
  { step: 1, label: 'Student import', href: (sessionId, slug) => `/sessions/${sessionId}/students` },
  { step: 2, label: 'Group creation', href: (sessionId) => `/sessions/${sessionId}/groups` },
  { step: 3, label: 'Group enrolment', href: (sessionId) => `/sessions/${sessionId}` },
  { step: 4, label: 'Presentation order & upload', href: (sessionId) => `/sessions/${sessionId}/order` },
  { step: 5, label: 'AI scoring & feedback', href: (sessionId) => `/sessions/${sessionId}/evaluation` },
  { step: 6, label: 'Grille & grades export', href: (sessionId) => `/sessions/${sessionId}/exports` }
];

export function AdminTimelineNav({
  currentStep,
  sessionId,
  slug
}: AdminTimelineNavProps) {
  return (
    <nav aria-label="Admin timeline" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {adminSteps.map((step) => {
          const href = step.href(sessionId, slug);
          const isActive = step.step === currentStep;
          const isPast = step.step < currentStep;

          return (
            <Link
              key={step.step}
              aria-current={isActive ? 'step' : undefined}
              className={`inline-flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : isPast
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
              }`}
              href={href}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : isPast
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-500'
                }`}
              >
                {step.step}
              </span>
              <span className="truncate">{step.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
