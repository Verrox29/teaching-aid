'use client';

import { getUiText } from '@/lib/ui-language';
import { useUiLanguage } from '@/components/ui-language-toggle';

type BoostcampExportGuideProps = {
  className?: string;
};

export function BoostcampExportGuide({ className }: BoostcampExportGuideProps) {
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).sessionStudents;

  return (
    <section className={`rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm text-[color:var(--app-fg-muted)] ${className ?? ''}`.trim()}>
      <p className="font-medium text-[color:var(--app-fg)]">{t.boostcampGuideTitle}</p>
      <div className="mt-3 grid gap-4">
        <section className="grid gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--app-fg)]">
            {t.boostcampCsvGuideTitle}
          </p>
          <ol className="grid list-decimal gap-1 pl-5">
            {t.boostcampCsvGuideSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
        <section className="grid gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--app-fg)]">
            {t.boostcampTextGuideTitle}
          </p>
          <ol className="grid list-decimal gap-1 pl-5">
            {t.boostcampTextGuideSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}
