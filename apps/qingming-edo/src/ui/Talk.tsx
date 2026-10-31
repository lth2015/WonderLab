import { useEffect, useRef, useState } from 'react';
import { characterById, ROLES } from '../content/world';
import { FALLBACK, TALK_CLOSE, TALK_TOPICS, TALK_TURNS, type TalkTopic } from '../content/talk';

// 即興のひとこと (spec §12): after a story, stay and talk a little. The player
// picks a topic (never types); the server voices the person with a model, and
// anything slow or unfit falls back to the script. A generated line is marked
// as improvised. Nothing here changes money, items or progress.

const API = (import.meta.env.VITE_EDO_API as string | undefined) ?? '/api';
const SHOW_WAIT_AFTER_MS = 600;
const GIVE_UP_MS = 10_000; // spec §12: over ~8 s, the script

type Said = { text: string; live: boolean };

/** Once the server says the feature is off (no key), stop asking for this visit. */
let talkOff = false;

export function Talk({ who, done, onClose }: { who: string; done: string[]; onClose(): void }) {
  const [turn, setTurn] = useState(0);
  const [said, setSaid] = useState<Said | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [showWait, setShowWait] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const name = characterById.get(who)?.displayName ?? '';

  useEffect(() => () => abort.current?.abort(), []);

  const ask = async (topic: TalkTopic) => {
    if (talkOff) {
      setSaid({ text: FALLBACK[who]?.[topic] ?? '……', live: false });
      setTurn((t) => t + 1);
      return;
    }
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setWaiting(true);
    setShowWait(false);
    const waitTimer = setTimeout(() => setShowWait(true), SHOW_WAIT_AFTER_MS);
    const giveUp = setTimeout(() => ctl.abort(), GIVE_UP_MS);
    let out: Said = { text: FALLBACK[who]?.[topic] ?? '……', live: false };
    try {
      const res = await fetch(`${API}/edo/talk`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ who, topic, done, turn }),
        signal: ctl.signal,
      });
      if (res.status === 503) talkOff = true;
      if (res.ok) {
        const j = (await res.json()) as { line?: unknown };
        if (typeof j.line === 'string' && j.line) out = { text: j.line, live: true };
      }
    } catch {
      /* cancelled, offline or slow: the script */
    }
    clearTimeout(waitTimer);
    clearTimeout(giveUp);
    if (ctl.signal.aborted && abort.current !== ctl) return; // superseded
    setSaid(out);
    setTurn((t) => t + 1);
    setWaiting(false);
    setShowWait(false);
  };

  const cancel = () => {
    abort.current?.abort();
    setWaiting(false);
    setShowWait(false);
  };

  const finished = turn >= TALK_TURNS;

  return (
    <div className="sheet dialogue talk" role="dialog" aria-live="polite" aria-label={`${name}と話す`}>
      <p className="speaker">
        {name}
        <small>{ROLES[who]}</small>
      </p>
      {waiting ? (
        <>
          <p className="narration">{showWait ? `${name}は少し考えている……` : '　'}</p>
          <button type="button" className="ghost" onClick={cancel}>
            やめる
          </button>
        </>
      ) : (
        <>
          {said ? (
            <>
              {said.live && <p className="improv-tag">即興のひとこと</p>}
              <p className="said">{said.text}</p>
            </>
          ) : (
            <p className="narration">何について話そう。</p>
          )}
          {finished ? (
            <>
              <p className="said">{TALK_CLOSE[who]}</p>
              <button type="button" className="primary next" onClick={onClose} autoFocus>
                閉じる
              </button>
            </>
          ) : (
            <>
              <div className="choices">
                {TALK_TOPICS.map((t) => (
                  <button type="button" key={t.id} className="choice" onClick={() => ask(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
              <button type="button" className="ghost" onClick={onClose}>
                町に戻る
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
