import { PagePlaceholder } from '@/components/page-placeholder';

type SessionOrderPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionOrderPage({
  params
}: SessionOrderPageProps) {
  const { sessionId } = await params;

  return (
    <PagePlaceholder
      title={`Session ${sessionId} · Presentation Order`}
      description="Set and update the group presentation order."
    />
  );
}
