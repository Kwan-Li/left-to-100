import { useEffect, useRef, useState } from 'preact/hooks';
import { r1 } from '../copy/r1';
import type { Dataset } from '../data/schema';
import type { PlayerState } from '../lib/plan';
import { resetState, shareUrl } from '../lib/state';

export function ShareBar({ data, state, pageUrl }: { data: Dataset; state: PlayerState; pageUrl: string }) {
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  /** Reset is two steps: the first click swaps the buttons for an inline confirm. */
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
    else if (returnFocus.current) resetRef.current?.focus();
    returnFocus.current = false;
  }, [confirming]);

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
    resetState(data);
    setMsg('Progress reset.');
    setLink('');
    returnFocus.current = true;
    setConfirming(false);
  };

  const cancel = () => {
    returnFocus.current = true;
    setConfirming(false);
  };

  /** Opening the confirm drops any earlier "Link copied" status, so only the question is on screen. */
  const askReset = () => {
    setMsg('');
    setLink('');
    setConfirming(true);
  };

  return (
    <div class="share">
      <div
        class="btn-row"
        onKeyDown={(e) => {
          if (confirming && e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
      >
        {confirming ? (
          <>
            <button type="button" class="btn danger" onClick={reset}>
              {r1.resetConfirm}
            </button>
            <button type="button" class="btn ghost" ref={cancelRef} onClick={cancel}>
              {r1.resetCancel}
            </button>
          </>
        ) : (
          <>
            <button type="button" class="btn ghost" onClick={share}>
              Copy share link
            </button>
            <button type="button" class="btn ghost" ref={resetRef} onClick={askReset}>
              Reset progress
            </button>
          </>
        )}
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
