import { useState } from 'preact/hooks';
import type { Dataset } from '../data/schema';
import type { PlayerState } from '../lib/plan';
import { resetState, shareUrl } from '../lib/state';

export function ShareBar({ data, state, pageUrl }: { data: Dataset; state: PlayerState; pageUrl: string }) {
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');

  const share = async () => {
    const url = shareUrl(state, pageUrl);
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setMsg('Link copied. Open it on another device to carry your progress over.');
    } catch {
      setMsg('Copy this link to move your progress to another device:');
    }
  };

  const reset = () => {
    if (confirm('Reset all saved progress on this device? Your counts, card sets, chapter, and missable answers will be cleared.')) {
      resetState(data);
      setMsg('Progress reset.');
      setLink('');
    }
  };

  return (
    <div class="share">
      <div class="share-buttons">
        <button type="button" class="btn primary" onClick={share}>
          Copy share link
        </button>
        <button type="button" class="btn ghost" onClick={reset}>
          Reset progress
        </button>
      </div>
      <p class="share-msg muted" role="status" aria-live="polite">
        {msg || 'Saved on this device. No account needed.'}
      </p>
      {link && msg.startsWith('Copy') && (
        <input class="share-link" type="text" readOnly value={link} onFocus={(e) => (e.target as HTMLInputElement).select()} aria-label="Share link" />
      )}
    </div>
  );
}
