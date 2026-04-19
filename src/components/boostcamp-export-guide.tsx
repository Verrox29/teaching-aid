'use client';

type BoostcampExportGuideProps = {
  className?: string;
};

export function BoostcampExportGuide({ className }: BoostcampExportGuideProps) {
  return (
    <section className={`rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm text-[color:var(--app-fg-muted)] ${className ?? ''}`.trim()}>
      <p className="font-medium text-[color:var(--app-fg)]">How to export from Boostcamp</p>
      <ol className="mt-2 grid list-decimal gap-1 pl-5">
        <li>Log in to Boostcamp.</li>
        <li>Open the roster export view for the class.</li>
        <li>Export the roster as CSV.</li>
        <li>Use the exported file here, or paste the roster text if needed.</li>
      </ol>
    </section>
  );
}
