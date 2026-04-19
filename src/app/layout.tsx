import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

import { ThemeProvider } from '@/components/theme-provider';
import { UiLanguageProvider } from '@/components/ui-language-toggle';

export const metadata: Metadata = {
  title: 'teaching-aid',
  description: 'Lightweight self-hosted peer-to-peer session management app'
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--app-fg)]">
        <ThemeProvider>
          <UiLanguageProvider>{children}</UiLanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
