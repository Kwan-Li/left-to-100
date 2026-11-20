import type { Source, Status } from '../data/schema';
import { href } from '../site';

const TEXT: Record<Status, string> = {
  verified: 'Verified: two or more independent sources agree',
  reported: 'Reported: one original source so far',
  disputed: 'Disputed: independent sources disagree',
};

const badgeTitle = (status: Status, sources?: Source[], note?: string) =>
  [TEXT[status], note, sources?.map((s) => s.publisher).join(', ')].filter(Boolean).join(' · ');

/** Status badge for static tables and lists: every status is shown. */
export function StatusBadge({ status, sources, note }: { status: Status; sources?: Source[]; note?: string }) {
  const title = badgeTitle(status, sources, note);
  return (
    <span class={`badge ${status}`} title={title}>
      {status}
      <span class="sr-only"> ({title})</span>
    </span>
  );
}

/**
 * Status badge for the interactive forms and card tiles. Verified facts get no badge, so the exceptions
 * stand out. Reported and disputed badges link to the explanation on the data page.
 */
export function FormBadge({ status, sources, note }: { status: Status; sources?: Source[]; note?: string }) {
  if (status === 'verified') return null;
  const title = badgeTitle(status, sources, note);
  return (
    <a class={`badge ${status}`} href={href('/data/#statuses')} title={title}>
      {status}
      <span class="sr-only"> ({title})</span>
    </a>
  );
}
