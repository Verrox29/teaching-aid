import { PagePlaceholder } from '@/components/page-placeholder';

type SessionExportsPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionExportsPage({
  params
}: SessionExportsPageProps) {
  const { sessionId } = await params;

  return (
    <PagePlaceholder
      title={`Session ${sessionId} · Exports`}
      description="Export session artifacts and evaluation outputs."
    />
  );
}
