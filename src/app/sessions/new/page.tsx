import { cookies } from 'next/headers';
import Link from 'next/link';

import { AdminShell } from '@/components/admin-shell';
import { ResponsiveBackActionContent } from '@/components/back-action';
import { SessionCreateForm } from '@/components/session-create-form';
import { getUiLanguageFromCookieValue, UI_LANGUAGE_COOKIE_NAME } from '@/lib/ui-language';

export default async function NewSessionPage() {
  const cookieStore = await cookies();
  const uiLanguage = getUiLanguageFromCookieValue(cookieStore.get(UI_LANGUAGE_COOKIE_NAME)?.value);

  return (
    <AdminShell
      actions={
        <Link className="ui-button ui-button-ghost" href="/sessions">
          <ResponsiveBackActionContent label={uiLanguage === 'fr' ? 'Retour aux sessions' : 'Back to sessions'} />
        </Link>
      }
      description={
        uiLanguage === 'fr'
          ? 'Configurez une session entre pairs et renseignez ses informations de base.'
          : 'Set up a peer-to-peer session and capture its core details.'
      }
      title={uiLanguage === 'fr' ? 'Créer la session' : 'Create session'}
    >
      <div className="max-w-3xl">
        <SessionCreateForm />
      </div>
    </AdminShell>
  );
}
