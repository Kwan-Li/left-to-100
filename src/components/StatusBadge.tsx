import type { Source, Status } from '../data/schema';

const TEXT: Record<Status, string> = {
  verified: 'Verified: two or more independent sources agree',
  reported: 'Reported: one original source so far',
  disputed: 'Disputed: independent sources disagree',
};

export function StatusBadge({ status, sources, note }: { status: Status; sources?: Source[]; note?: string }) {
  const title = [TEXT[status], note, sources?.map((s) => s.publisher).join(', ')].filter(Boolean).join(' · ');
  return (
    <span class={`badge ${status}`} title={title}>
      {status}
      <span class="sr-only"> ({title})</span>
    </span>
  );
}
