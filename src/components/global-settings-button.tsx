'use client';

import { useRouter } from 'next/navigation';

import {
  GLOBAL_SETTINGS_COOKIE_MAX_AGE_SECONDS,
  GLOBAL_SETTINGS_COOKIE_NAME,
  GLOBAL_SETTINGS_COOKIE_VALUE,
  GLOBAL_SETTINGS_PASSWORD,
  GLOBAL_SETTINGS_PATH
} from '@/lib/global-settings-access';

export function GlobalSettingsButton() {
  const router = useRouter();

  function handleClick() {
    const password = window.prompt('Enter the global settings password');
    if (password === null) {
      return;
    }

    if (password.trim() !== GLOBAL_SETTINGS_PASSWORD) {
      window.alert('Incorrect password.');
      return;
    }

    document.cookie = `${GLOBAL_SETTINGS_COOKIE_NAME}=${GLOBAL_SETTINGS_COOKIE_VALUE}; path=${GLOBAL_SETTINGS_PATH}; max-age=${GLOBAL_SETTINGS_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    router.push(GLOBAL_SETTINGS_PATH);
  }

  return (
    <button className="ui-button ui-button-secondary" onClick={handleClick} type="button">
      Global settings
    </button>
  );
}
