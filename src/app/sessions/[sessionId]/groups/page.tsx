import { PagePlaceholder } from '@/components/page-placeholder';

type SessionGroupsPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionGroupsPage({
  params
}: SessionGroupsPageProps) {
  const { sessionId } = await params;

  return (
    <PagePlaceholder
      title={`Session ${sessionId} · Groups`}
      description="Create and manage student groups for this session."
    />
  );
}
