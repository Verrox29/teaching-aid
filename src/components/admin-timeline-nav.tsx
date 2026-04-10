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
    <nav aria-label="Admin timeline" className="ui-panel overflow-hidden p-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {adminSteps.map((step) => {
          const href = step.href(sessionId, slug);
          const isActive = step.step === currentStep;
          const isPast = step.step < currentStep;

          return (
            <Link
              key={step.step}
              aria-current={isActive ? 'step' : undefined}
              className={`ui-timeline-step ${isActive ? 'ui-timeline-step-active' : isPast ? 'ui-timeline-step-complete' : 'ui-timeline-step-future'}`}
              href={href}
            >
              <span className="ui-timeline-dot">
                {step.step}
              </span>
              <span className="min-w-0 truncate text-sm font-medium">{step.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
