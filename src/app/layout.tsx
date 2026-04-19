import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import './globals.css';

import { ThemeProvider } from '@/components/theme-provider';
import { UiLanguageProvider } from '@/components/ui-language-toggle';
import { getUiLanguageFromCookieValue, UI_LANGUAGE_COOKIE_NAME } from '@/lib/ui-language';

export const metadata: Metadata = {
  title: 'teaching-aid',
  description: 'Lightweight self-hosted peer-to-peer session management app'
};

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = await cookies();
  const uiLanguage = getUiLanguageFromCookieValue(cookieStore.get(UI_LANGUAGE_COOKIE_NAME)?.value);

  return (
    <html lang={uiLanguage} suppressHydrationWarning>
      <body className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--app-fg)]">
        <ThemeProvider>
          <UiLanguageProvider>{children}</UiLanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
