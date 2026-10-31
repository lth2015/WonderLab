import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Effect, HotspotDef, SaveData } from './contract';
import { NODES, ON_CLOSE, RECALL_START } from './content/script';
import { AMBIENT, HOTSPOTS, ROLES, characterById, kazeComposition, type Subject } from './content/world';
import { load, persist, type LoadResult } from './engine/save';
import { addPage, addRecallPage, apply, hasFlag, questState } from './engine/state';
import { entryFor, nearby, visibleSpots } from './engine/story';
import { Street, type StreetApi } from './scene/Street';
import { Journal } from './ui/Journal';
import { Settings } from './ui/Settings';
import { Sketch } from './ui/Sketch';
import { Wrap } from './ui/Wrap';
import { Tea } from './ui/Tea';
import { Tenugui } from './ui/Tenugui';
import { Talk } from './ui/Talk';
import { TALK_STORIES } from './content/talkStories';
import { posesFor } from './scene/painted';

type Panel = 'journal' | 'items' | 'nearby' | 'settings' | null;
const IDLE_MS = 8000; // spec §6

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const memoryStore = { getItem: () => null, setItem: () => {} };

export function App() {
  const [boot] = useState<LoadResult>(() => load(storage() ?? memoryStore));
  const [save, setSaveRaw] = useState<SaveData>(boot.save);
  // A save from a newer version is left untouched (engine/save.ts).
  const writable = useRef(boot.kind !== 'newer');
  const setSave = useCallback((next: SaveData) => {
    setSaveRaw(next);
    // Recorded as soon as progress is decided (spec §19 保存).
    if (writable.current) persist(storage() ?? memoryStore, next);
  }, []);
  const saveRef = useRef(save);
  saveRef.current = save;
  const commit = useCallback((effects: Effect[]) => setSave(apply(saveRef.current, effects)), [setSave]);

  const [entered, setEntered] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [dialogue, setDialogue] = useState<{ node: string; line: number } | null>(null);
  const [candidates, setCandidates] = useState<HotspotDef[] | null>(null);
  const [sketch, setSketch] = useState<Subject | null>(null);
  const [talk, setTalk] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [game, setGame] = useState<{ id: 'wrap' | 'tea' | 'tenugui'; then: string | null } | null>(null);
  const [toast, setToast] = useState<string | null>(
    boot.kind === 'corrupt'
      ? '記録が読めなかったため、元の記録を退避して最初から始めます。'
      : boot.kind === 'newer'
        ? '新しい版の記録が見つかりました。その記録は書き換えず、この画面では保存しません。'
        : null,
  );
  const [reacting, setReacting] = useState<Set<string>>(new Set());
  const [hint, setHint] = useState<string | null>(null);
  const dismissedHint = useRef<string | null>(null);
  const street = useRef<StreetApi>(null);
  const lastActivity = useRef(performance.now());

  const reduceMotion = save.settings.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const busy = !!(dialogue || candidates || sketch || game || panel || talk);

  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(save.settings.textScale));
    document.documentElement.classList.toggle('rm', reduceMotion);
  }, [save.settings.textScale, reduceMotion]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------------------------------------------------------------- dialogue
  // 回想: replaying a finished story. Nothing it says changes money, flags or quests.
  const [recall, setRecallState] = useState<string | null>(null);
  const recallRef = useRef<string | null>(null);
  const setRecall = (q: string | null) => {
    recallRef.current = q;
    setRecallState(q);
  };

  const openNode = useCallback(
    (id: string) => {
      const n = NODES[id];
      if (!n) return setDialogue(null);
      const inRecall = !!recallRef.current;
      // a node that is only about being paid is passed over in 回想
      if (inRecall && linesOf(n, true).length === 0) {
        if (n.next) return openNode(n.next);
        recallRef.current = null;
        setRecallState(null);
        return setDialogue(null);
      }
      let next = n.effects && !inRecall ? apply(saveRef.current, n.effects) : saveRef.current;
      // a node may leave a journal page: made once, kept even if the dialogue is closed early
      if (n.page && !inRecall) next = addPage(next, { pageId: n.page.pageId, compositionId: n.page.compositionId, titleStyle: 'plain', madeAt: new Date().toISOString() });
      if (inRecall) {
        // a memory is not where the player stands: bring the speaker into view
        const who = linesOf(n, true).find((l) => l.by !== 'narration')?.by;
        const spot = who && HOTSPOTS.find((h) => h.id === `h-${who}`);
        if (spot) street.current?.focus(spot.anchor.x);
      }
      if (n.page && inRecall) {
        const before = next;
        next = addRecallPage(next, n.page.pageId, n.page.compositionId);
        if (next !== before) setToast('回想のなかで、もう一枚の頁が残った。');
      }
      if (next !== saveRef.current) setSave(next);
      setDialogue({ node: id, line: 0 });
    },
    [setSave],
  );

  const openTarget = useCallback(
    (spot: HotspotDef) => {
      setCandidates(null);
      setHint(null);
      if (spot.kind === 'ambient') {
        const id = spot.targetId;
        setReacting((r) => new Set(r).add(id));
        setTimeout(() => setReacting((r) => ((r = new Set(r)), r.delete(id), r)), 1400);
        setToast(AMBIENT[id] ?? null);
        return;
      }
      if (spot.kind === 'character' && !hasFlag(saveRef.current, `met_${spot.targetId}`)) {
        commit([{ type: 'setFlag', flag: `met_${spot.targetId}` }]);
      }
      const node = entryFor(spot.targetId, saveRef.current);
      if (node) openNode(node);
    },
    [commit, openNode],
  );

  const onTap = useCallback(
    (hits: HotspotDef[]) => {
      if (hits.length === 1) openTarget(hits[0]);
      else if (hits.length > 1) setCandidates(hits);
    },
    [openTarget],
  );

  const closeDialogue = () => {
    if (recallRef.current) {
      const goOn = dialogue && NODES[dialogue.node].recallNext;
      if (goOn) return openNode(goOn);
      setRecall(null);
      setDialogue(null);
      return;
    }
    if (dialogue && ON_CLOSE[dialogue.node]) commit(ON_CLOSE[dialogue.node]);
    setDialogue(null);
  };

  /** Leaves 回想 from anywhere (a choice to walk away, a game closed early). */
  const endRecall = () => {
    setRecall(null);
    setDialogue(null);
  };

  const startRecall = (quest: string) => {
    const start = RECALL_START[quest];
    if (!start) return;
    setPanel(null);
    setRecall(quest);
    openNode(start);
  };

  const advance = () => {
    if (!dialogue) return;
    const n = NODES[dialogue.node];
    if (dialogue.line < linesOf(n, !!recall).length - 1) return setDialogue({ ...dialogue, line: dialogue.line + 1 });
    if (n.choices) return;
    if (n.next) return openNode(n.next);
    closeDialogue();
  };

  const choose = (i: number) => {
    const c = NODES[dialogue!.node].choices![i];
    if (c.effects && !recallRef.current) commit(c.effects);
    if (c.talk) {
      const n = NODES[dialogue!.node];
      if (ON_CLOSE[dialogue!.node]) commit(ON_CLOSE[dialogue!.node]);
      setDialogue(null);
      setTalk(n.lines.find((l) => l.by !== 'narration')?.by ?? null);
      return;
    }
    if (c.sketch) {
      setDialogue(null);
      setSketch(c.sketch);
    } else if (c.game) {
      setDialogue(null);
      setGame({ id: c.game, then: c.next ?? null });
    } else if (c.next) {
      // in 回想, turning the request down simply ends the memory
      if (recallRef.current && /declined$/.test(c.next)) return endRecall();
      openNode(c.next);
    } else closeDialogue();
  };

  const finishSketch = (subject: Subject, framing: 'near' | 'wide', titleStyle: string) => {
    const now = new Date();
    if (recallRef.current) {
      const before = saveRef.current;
      const s = addRecallPage(before, 'p01-kaze', kazeComposition(subject, framing), titleStyle, now);
      if (s !== before) {
        setSave(s);
        setToast('回想のなかで、もう一枚の頁が残った。');
      }
      setSketch(null);
      openNode(`kaze.after.${subject}`);
      return;
    }
    let s = addPage(saveRef.current, { pageId: 'p01-kaze', compositionId: kazeComposition(subject, framing), titleStyle, madeAt: now.toISOString() });
    s = apply(s, [{ type: 'setFlag', flag: 'kaze_page' }, { type: 'questState', quest: 'kaze', state: 'ready' }], now);
    setSave(s);
    setSketch(null);
    openNode(`kaze.after.${subject}`);
  };

  // ---------------------------------------------------------------- idle hint
  const nb = useMemo(() => nearby(save), [save]);
  const activity = useCallback(() => {
    lastActivity.current = performance.now();
    setHint(null);
  }, []);
  useEffect(() => {
    if (!entered || busy) return;
    const t = setInterval(() => {
      if (document.hidden) return (lastActivity.current = performance.now()); // paused in the background
      const first = nb[0];
      if (!first || dismissedHint.current === first.id) return;
      if (performance.now() - lastActivity.current > IDLE_MS) setHint(first.id);
    }, 1000);
    return () => clearInterval(t);
  }, [entered, busy, nb]);

  const goTo = (spotId: string, open: boolean) => {
    const spot = HOTSPOTS.find((h) => h.id === spotId);
    if (!spot) return;
    setPanel(null);
    setHint(null);
    street.current?.focus(spot.anchor.x);
    if (open) openTarget(spot);
  };

  const spots = useMemo(() => visibleSpots(save), [save]);
  const node = dialogue ? NODES[dialogue.node] : null;
  const shown = node ? linesOf(node, !!recall) : [];
  const line = shown[dialogue?.line ?? 0];
  const atLast = node && dialogue!.line === shown.length - 1;
  const hasProgress = save.progress.flags.length > 0;

  return (
    <div className="app">
      <header className="top">
        <span className="place">日本橋北詰</span>
        <span className="time">朝</span>
        <button type="button" className="ghost" onClick={() => setPanel('settings')}>
          設定
        </button>
      </header>

      <main className="stage">
        <Street
          apiRef={street}
          spots={spots}
          poses={posesFor(save)}
          reacting={reacting}
          reduceMotion={reduceMotion}
          interactive={entered && !busy}
          talking={!!(dialogue || candidates || talk)}
          zoomed={zoomed}
          onTap={onTap}
          onActivity={activity}
        />

        {!entered && (
          <section className="title" aria-labelledby="title-h">
            <h1 id="title-h">
              <span className="series">清明上河図：江戸編</span>
              日本橋、ひと頁
            </h1>
            <p>絵師の見習いとして、春の日本橋をしばらく歩きます。</p>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setEntered(true);
                activity();
              }}
            >
              {hasProgress ? '絵巻の続きへ' : '絵巻に入る'}
            </button>
            <p className="note">『熈代勝覧』に着想を得た創作です。人物・店・出来事は創作です。</p>
          </section>
        )}

        {entered && !busy && (
          <button type="button" className="zoom-btn" aria-pressed={zoomed} onClick={() => setZoomed((z) => !z)}>
            {zoomed ? 'もとに戻す' : '近くで見る'}
          </button>
        )}

        {hint && !busy && (
          <div className="hint" role="status">
            <span>{nb.find((n) => n.id === hint)?.text}</span>
            <button type="button" onClick={() => goTo(nb.find((n) => n.id === hint)!.spotId, false)}>
              場所を見る
            </button>
            <button
              type="button"
              className="ghost"
              aria-label="案内を閉じる"
              onClick={() => {
                dismissedHint.current = hint;
                setHint(null);
              }}
            >
              閉じる
            </button>
          </div>
        )}

        {toast && (
          <div className="toast" role="status" aria-live="polite">
            {toast}
          </div>
        )}
      </main>

      {candidates && (
        <div className="sheet" role="dialog" aria-label="どれに声をかけますか">
          <p className="sheet-title">どれに声をかけますか</p>
          {candidates.map((c) => (
            <button type="button" key={c.id} className="choice" onClick={() => openTarget(c)}>
              {characterById.get(c.targetId)?.displayName ?? AMBIENT[c.targetId] ?? '紙'}
            </button>
          ))}
          <button type="button" className="ghost" onClick={() => setCandidates(null)}>
            町に戻る
          </button>
        </div>
      )}

      {node && line && (
        <div className={`sheet dialogue${recall ? ' recall' : ''}`} role="dialog" aria-live="polite" aria-label={recall ? '回想' : '会話'}>
          {recall && <p className="recall-tag">回想　— 文は増えません</p>}
          {line.by !== 'narration' && (
            <p className="speaker">
              {characterById.get(line.by)?.displayName}
              <small>{ROLES[line.by]}</small>
            </p>
          )}
          <p className={line.by === 'narration' ? 'narration' : 'said'}>{line.text}</p>
          {atLast && node.choices ? (
            <div className="choices">
              {node.choices.map((c, i) => (
                <button type="button" key={c.label} className="choice" onClick={() => choose(i)}>
                  {c.label}
                </button>
              ))}
            </div>
          ) : (
            <button type="button" className="primary next" onClick={advance} autoFocus>
              {atLast && !node.next ? '閉じる' : '次へ'}
            </button>
          )}
          {atLast && node.choices && (
            <button type="button" className="ghost" onClick={recall ? endRecall : closeDialogue}>
              {recall ? '回想を閉じる' : '町に戻る'}
            </button>
          )}
        </div>
      )}

      {talk && (
        <Talk who={talk} done={TALK_STORIES.filter((q) => questState(save, q) === 'complete')} onClose={() => setTalk(null)} />
      )}
      {game && (() => {
        const done = () => {
          const then = game.then;
          setGame(null);
          if (then) openNode(then);
        };
        const cancel = () => {
          setGame(null);
          if (recallRef.current) endRecall();
        };
        if (game.id === 'wrap') return <Wrap onDone={done} onCancel={cancel} />;
        if (game.id === 'tea') return <Tea onDone={done} onCancel={cancel} />;
        return <Tenugui onDone={done} onCancel={cancel} />;
      })()}
      {sketch && <Sketch subject={sketch} onDone={finishSketch} onCancel={() => { setSketch(null); if (recallRef.current) endRecall(); }} reduceMotion={reduceMotion} />}

      {panel === 'journal' && <Journal save={save} onClose={() => setPanel(null)} onToast={setToast} onRecall={startRecall} />}
      {panel === 'items' && (
        <div className="panel" role="dialog" aria-labelledby="items-h">
          <h2 id="items-h">持ち物</h2>
          <p className="purse">
            所持金 <strong>{save.wallet.balanceMinor}</strong> 文
          </p>
          <p className="small">文はこの町の中だけで使うお金です。金額は遊びのための調整値で、1805年の物価ではありません。</p>
          {hasFlag(save, 'dougu_carry') && questState(save, 'dougu') !== 'complete' ? (
            <ul className="list">
              <li>お紺から預かった包み（金次さんの弁当箱・箸箱・砥石）</li>
            </ul>
          ) : (
            <p>持ち物はまだありません。</p>
          )}
          <button type="button" className="primary" onClick={() => setPanel(null)}>
            町に戻る
          </button>
        </div>
      )}
      {panel === 'nearby' && (
        <div className="panel" role="dialog" aria-labelledby="near-h">
          <h2 id="near-h">近くのこと</h2>
          {nb.length === 0 ? (
            <p>今は、町の様子をゆっくり眺められます。</p>
          ) : (
            <ul className="list">
              {nb.map((n) => (
                <li key={n.id}>
                  <button type="button" className="choice" onClick={() => goTo(n.spotId, false)}>
                    {n.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <h3>この通りの人と物</h3>
          <ul className="list compact">
            {spots
              .filter((s) => s.kind !== 'ambient')
              .map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => goTo(s.id, true)}>
                    {s.kind === 'character' ? `${characterById.get(s.targetId)!.displayName}（${ROLES[s.targetId]}）` : '青葉屋の店先の紙'}
                  </button>
                </li>
              ))}
            {spots
              .filter((s) => s.kind === 'ambient')
              .map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => goTo(s.id, true)}>
                    {AMBIENT_LABEL[s.targetId]}
                  </button>
                </li>
              ))}
          </ul>
          <button type="button" className="primary" onClick={() => setPanel(null)}>
            町に戻る
          </button>
        </div>
      )}
      {panel === 'settings' && (
        <Settings
          save={save}
          onChange={setSave}
          onReplace={(s) => {
            writable.current = true;
            setSave(s);
          }}
          onClose={() => setPanel(null)}
          onToast={setToast}
        />
      )}

      <nav className="bottom" aria-label="絵巻の道具">
        <button type="button" onClick={() => setPanel('journal')} disabled={!entered} aria-pressed={panel === 'journal'}>
          絵巻帳
          {save.journal.pages.length > 0 && <small>{save.journal.pages.length}</small>}
        </button>
        <button type="button" onClick={() => setPanel('items')} disabled={!entered} aria-pressed={panel === 'items'}>
          持ち物
        </button>
        <button type="button" onClick={() => setPanel('nearby')} disabled={!entered} aria-pressed={panel === 'nearby'}>
          近くのこと
        </button>
      </nav>
    </div>
  );
}

/** The lines a node shows; in 回想 the ones about being paid are left out. */
function linesOf(n: (typeof NODES)[string], inRecall: boolean) {
  return inRecall ? n.lines.filter((l) => !l.reward) : n.lines;
}

const AMBIENT_LABEL: Record<string, string> = {
  'noren-aoba': '青葉屋の暖簾',
  'noren-kure': 'くれ竹の暖簾',
  lantern: '辻行灯',
  brooms: '荒物屋の竹箒',
  steam: '茶店の湯気',
  barrel: '路地の天水桶',
  giboshi: '橋の擬宝珠',
  willow: '川端の柳',
  boat: '川の荷舟',
  ladder: '屋根の梯子',
  timber: '材木置き場',
  sake: '酒屋の杉玉',
  umbrellas: '傘屋の番傘',
  tower: '火の見櫓',
  well: '路地の井戸',
  cooper: '桶屋の箍',
  medicine: '薬種屋の薬袋',
  prints: '絵草紙屋の錦絵',
  kido: '町木戸',
  ootana: '大店の暖簾',
  kura: '土蔵',
  inari: '路地奥の鳥居',
  ceramics: '瀬戸物屋の棚',
};
