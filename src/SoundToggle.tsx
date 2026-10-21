import { useEffect, useState } from 'react';
import { sound } from './sound';

// The sound switch, top right, always there (docs/02 §6.4). Remembered on
// this device; turning it on after the first stroke starts sound at once.

export function SoundToggle() {
  const [on, setOn] = useState(sound.enabled);
  useEffect(() => sound.subscribe(setOn), []);
  if (!sound.supported) return null;
  const label = on ? '关闭声音' : '打开声音';
  return (
    <button type="button" className={`icon-btn sound${on ? '' : ' off'}`} aria-label={label} aria-pressed={on} title={label} onClick={() => sound.setEnabled(!on)}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
        {on ? (
          <>
            <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
            <path d="M18 7a7 7 0 0 1 0 10" />
          </>
        ) : (
          <path d="M16 10l4 4m0-4l-4 4" />
        )}
      </svg>
    </button>
  );
}
