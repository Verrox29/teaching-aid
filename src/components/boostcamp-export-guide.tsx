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
      <ol className="mt-2 grid list-decimal gap-1 pl-5">
        <li>{t.boostcampGuideStep1}</li>
        <li>{t.boostcampGuideStep2}</li>
        <li>{t.boostcampGuideStep3}</li>
        <li>{t.boostcampGuideStep4}</li>
      </ol>
    </section>
  );
}
