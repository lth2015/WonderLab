import { Glossed } from './Glossed';
import { Face } from './Face';
import { useEffect, useRef, useState } from 'react';
import { characterById, ROLES } from '../content/world';
import { aboutLine, aboutWhom } from '../content/about';
import { FALLBACK, TALK_CLOSE, TALK_TOPICS, TALK_TURNS, type TalkTopic } from '../content/talk';

// 即興のひとこと (spec §12): after a story, stay and talk a little. The player
// picks a topic (never types); the server voices the person with a model, and
// anything slow or unfit falls back to the script. A generated line is marked
// as improvised. Nothing here changes money, items or progress.

const API = (import.meta.env.VITE_EDO_API as string | undefined) ?? '/api';
const SHOW_WAIT_AFTER_MS = 600;
// spec §12: a cancellable wait within 2 s (shown at 0.6 s); past 8 s, the script line
const GIVE_UP_MS = 8_000;

type Said = { text: string; live: boolean };

/** Once the server says the feature is off (no key), stop asking for this visit. */
let talkOff = false;

export function Talk({ who, done, complete, onClose }: { who: string; done: string[]; complete: string[]; onClose(): void }) {
  const [turn, setTurn] = useState(0);
  // 人のこと: the list of people to ask about is open; each is asked once a visit
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState<string[]>([]);
  const whom = aboutWhom(who, complete).filter((x) => !asked.includes(x));
  const [said, setSaid] = useState<Said | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [showWait, setShowWait] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const name = characterById.get(who)?.displayName ?? '';

  useEffect(() => () => abort.current?.abort(), []);
  // a new line (or the list of people) starts from the top of the sheet, never half scrolled
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sheet.current?.scrollTo({ top: 0 });
  }, [said, asking]);

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
    if (abort.current !== ctl) return; // cancelled or superseded: say nothing, count nothing
    abort.current = null;
    setSaid(out);
    setTurn((t) => t + 1);
    setWaiting(false);
    setShowWait(false);
  };

  const askAbout = (subject: string) => {
    // scripted: what one person thinks of another is never generated
    setSaid({ text: aboutLine(who, subject, complete), live: false });
    setAsked((a) => [...a, subject]);
    setAsking(false);
    setTurn((t) => t + 1);
  };

  const cancel = () => {
    // stopping waiting is not a turn: the pending answer is dropped, nothing is said
    const ctl = abort.current;
    abort.current = null;
    ctl?.abort();
    setWaiting(false);
    setShowWait(false);
  };

  const finished = turn >= TALK_TURNS;

  return (
    <div ref={sheet} className="sheet dialogue talk" role="dialog" aria-live="polite" aria-label={`${name}と話す`}>
      <div className="line-body">
        <Face who={who} />
        <p className="speaker">
          {name}
          <small>{ROLES[who]}</small>
        </p>
        {waiting ? <p className="narration">{showWait ? `${name}は少し考えている……` : '　'}</p> : said ? (
          <>
            {said.live && <p className="improv-tag">即興のひとこと</p>}
            <Glossed className="said" text={said.text} />
          </>
        ) : (
          <p className="narration">何について話そう。</p>
        )}
        {!waiting && finished && <p className="said">{TALK_CLOSE[who]}</p>}
      </div>
      {waiting ? (
        <>
          <button type="button" className="ghost" onClick={cancel}>
            やめる
          </button>
        </>
      ) : (
        <>
          {finished ? (
            <>
              <button type="button" className="primary next" onClick={onClose} autoFocus>
                閉じる
              </button>
            </>
          ) : (
            <>
              {asking ? (
                <div className="choices about" role="group" aria-label="だれのことを聞く？">
                  {whom.map((x) => (
                    <button type="button" key={x} className="choice" onClick={() => askAbout(x)}>
                      {characterById.get(x)?.displayName}のこと
                    </button>
                  ))}
                </div>
              ) : (
                <div className="choices">
                  {TALK_TOPICS.map((t) => (
                    <button type="button" key={t.id} className="choice" onClick={() => ask(t.id)}>
                      {t.label}
                    </button>
                  ))}
                  {whom.length > 0 && (
                    <button type="button" className="choice" onClick={() => setAsking(true)}>
                      町の人のこと…
                    </button>
                  )}
                </div>
              )}
              <button type="button" className="ghost" onClick={asking ? () => setAsking(false) : onClose}>
                {asking ? 'ほかの話にする' : '町に戻る'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
