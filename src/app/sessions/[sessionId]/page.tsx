import { PagePlaceholder } from '@/components/page-placeholder';

type SessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = await params;

  return (
    <PagePlaceholder
      title={`Session ${sessionId}`}
      description="Session overview and quick navigation to admin workflows."
    />
  );
}
