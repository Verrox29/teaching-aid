'use client';

import Link, { type LinkProps } from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { type MouseEvent, type ReactNode, useEffect, useMemo, useRef } from 'react';

import { useInteractionFeedback } from '@/components/app-interaction-feedback';

type PendingNavigationLinkProps = LinkProps & {
  children: ReactNode;
  pendingDelayMs?: number;
  pendingLabel?: string;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

function resolveHrefString(href: LinkProps['href']) {
  if (typeof href === 'string') {
    return href;
  }

  if ('href' in href && typeof href.href === 'string') {
    return href.href;
  }

  if ('pathname' in href && typeof href.pathname === 'string') {
    const search = href.query ? `?${new URLSearchParams(href.query as Record<string, string>).toString()}` : '';
    const hash = typeof href.hash === 'string' && href.hash.length > 0 ? `#${href.hash}` : '';
    return `${href.pathname}${search}${hash}`;
  }

  return String(href);
}

function normalizeRouteKey(href: LinkProps['href']) {
  const resolved = resolveHrefString(href);

  try {
    const url = new URL(resolved, 'http://localhost');
    const search = url.searchParams.toString();
    return search ? `${url.pathname}?${search}` : url.pathname;
  } catch {
    return resolved;
  }
}

function useCurrentRouteKey() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useMemo(() => {
    const search = searchParams.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [pathname, searchParams]);
}

export function PendingNavigationLink({
  children,
  className,
  href,
  onClick,
  pendingDelayMs = 180,
  pendingLabel = 'Loading...',
  ...rest
}: PendingNavigationLinkProps) {
  const { beginNavigationPending } = useInteractionFeedback();
  const currentRouteKey = useCurrentRouteKey();
  const releaseRef = useRef<null | (() => void)>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const targetRouteKey = useMemo(() => normalizeRouteKey(href), [href]);

  function clearPending() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    releaseRef.current?.();
    releaseRef.current = null;
  }

  useEffect(
    () => () => {
      clearPending();
    },
    []
  );

  useEffect(() => {
    if (releaseRef.current && currentRouteKey === targetRouteKey) {
      clearPending();
    }
  }, [currentRouteKey, targetRouteKey]);

  return (
    <Link
      className={className}
      href={href}
      onClick={(event) => {
        onClick?.(event);

        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.altKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.button !== 0
        ) {
          return;
        }

        if (normalizeRouteKey(href) === currentRouteKey) {
          return;
        }

        clearPending();
        timerRef.current = window.setTimeout(() => {
          releaseRef.current = beginNavigationPending(pendingLabel);
          timerRef.current = null;
        }, pendingDelayMs);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
