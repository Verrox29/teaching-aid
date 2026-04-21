type BackActionContentProps = {
  label: string;
};

export function BackArrowIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.25 4.75L3.75 10L8.25 15.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <path
        d="M16.25 10H4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function ResponsiveBackActionContent({ label }: BackActionContentProps) {
  return (
    <>
      <BackArrowIcon className="h-4 w-4" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </>
  );
}
