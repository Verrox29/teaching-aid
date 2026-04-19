import { redirect } from 'next/navigation';

type SessionExportSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SessionExportSettingsPage({ searchParams }: SessionExportSettingsPageProps) {
  const search = searchParams ? await searchParams : {};
  const notice = getSingleValue(search.notice);
  const error = getSingleValue(search.error);
  const params = new URLSearchParams();

  if (notice) {
    params.set('notice', notice);
  }

  if (error) {
    params.set('error', error);
  }

  redirect(params.toString() ? `/sessions/settings?${params.toString()}` : '/sessions/settings');
}
