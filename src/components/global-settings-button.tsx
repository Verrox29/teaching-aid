'use client';

import { useRouter } from 'next/navigation';

import {
  GLOBAL_SETTINGS_COOKIE_MAX_AGE_SECONDS,
  GLOBAL_SETTINGS_COOKIE_NAME,
  GLOBAL_SETTINGS_COOKIE_VALUE,
  GLOBAL_SETTINGS_PASSWORD,
  GLOBAL_SETTINGS_PATH
} from '@/lib/global-settings-access';
import { getUiText } from '@/lib/ui-language';
import { useUiLanguage } from '@/components/ui-language-toggle';

export function GlobalSettingsButton() {
  const router = useRouter();
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).globalSettings;

  function handleClick() {
    const password = window.prompt(t.passwordPrompt);
    if (password === null) {
      return;
    }

    if (password.trim() !== GLOBAL_SETTINGS_PASSWORD) {
      window.alert(t.wrongPassword);
      return;
    }

    document.cookie = `${GLOBAL_SETTINGS_COOKIE_NAME}=${GLOBAL_SETTINGS_COOKIE_VALUE}; path=${GLOBAL_SETTINGS_PATH}; max-age=${GLOBAL_SETTINGS_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    router.push(GLOBAL_SETTINGS_PATH);
  }

  return (
    <button className="ui-button ui-button-secondary" onClick={handleClick} type="button">
      {t.label}
    </button>
  );
}
