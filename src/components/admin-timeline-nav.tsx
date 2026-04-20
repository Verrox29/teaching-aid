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
  {
    step: 1,
    label: 'Pairagogie & students setup',
    href: (sessionId, slug) => `/sessions/${sessionId}/students`
  },
  { step: 2, label: 'Group creation', href: (sessionId) => `/sessions/${sessionId}/groups` },
  { step: 3, label: 'AI scoring & feedback', href: (sessionId) => `/sessions/${sessionId}/evaluation` },
  { step: 4, label: 'Grille & grades export', href: (sessionId) => `/sessions/${sessionId}/exports` }
];

export function AdminTimelineNav({
  currentStep,
  sessionId,
  slug
}: AdminTimelineNavProps) {
  return (
    <nav aria-label="Admin timeline" className="ui-panel overflow-hidden p-1.5">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
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
              <span className="ui-timeline-dot">{isPast ? '✓' : step.step}</span>
              <span className="text-left text-sm font-medium leading-snug whitespace-normal break-words">
                {step.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
