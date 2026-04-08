type PagePlaceholderProps = {
  title: string;
  description?: string;
};

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-3 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="text-slate-700">{description}</p> : null}
      <p className="text-sm text-slate-500">Skeleton page (V1).</p>
    </main>
  );
}
