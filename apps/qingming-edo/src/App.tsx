import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Effect, HotspotDef, SaveData } from './contract';
import { NODES, ON_CLOSE, RECALL_START } from './content/script';
import { AMBIENT_LABEL, ambientText, spotLabel, frameOf, GUIDE_STOPS, HOTSPOTS, UGOKI_PEOPLE, INKYO_BENCH, INKYO_STOPS, INKYO_WALK, ROLES, characterById, kazeComposition, sketchOfSpot, sketchPageId, type Subject } from './content/world';
import { load, persist, type LoadResult } from './engine/save';
import { addPage, addRecallPage, apply, hasFlag, questState } from './engine/state';
import { entryFor, nearbyAll, visibleSpots } from './engine/story';
import { openChapters } from './engine/chapters';
import { rainOpen, raining, reachedTimes, TIMES, timeOf } from './engine/time';
import { levelsOf, sound } from './engine/sound';
import { hasPlayableProgress, observeProgress, study } from './engine/study';
import { SESSION_MODE } from './engine/session';
import { useSystemReducedMotion } from './ui/useSystemReducedMotion';
import { Street, type StreetApi } from './scene/Street';
import { Journal, SCENE_ID } from './ui/Journal';
import { Settings } from './ui/Settings';
import { Sketch } from './ui/Sketch';
import { Wrap } from './ui/Wrap';
import { Tea } from './ui/Tea';
import { Tenugui } from './ui/Tenugui';
import { Trace } from './ui/Trace';
import { TownMap } from './ui/TownMap';
import { Face } from './ui/Face';
import { LOST } from './content/lost';
import { Talk } from './ui/Talk';
import { Glossed } from './ui/Glossed';
import { useModalFocus } from './ui/modalFocus';
import { TALK_STORIES } from './content/talkStories';
import { posesFor } from './scene/painted';

/** A link naming a scene this work does not have opens the start screen with a note (spec §16). */
function unknownScene(): boolean {
  try {
    const scene = new URLSearchParams(location.search).get('scene');
    return scene !== null && scene !== SCENE_ID;
  } catch {
    return false;
  }
}

/** Shown whenever the time bell is rung, so the event is there without sound too. */
const BELL_LINE = '石町のほうから、時の鐘が遠く聞こえてくる。';

type Panel = 'journal' | 'items' | 'nearby' | 'settings' | 'map' | null;
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
  const saveRef = useRef(save);
  // A save from a newer version is left untouched (engine/save.ts), and so is an
  // unreadable one whose backup could not be written, until the player chooses.
  const writable = useRef(boot.kind !== 'newer' && boot.kind !== 'unbacked');
  const [unreadable, setUnreadable] = useState<string | null>(boot.kind === 'unbacked' ? boot.original : null);
  // storage that refuses writes: say so once, and point to the export (spec §16, review V04)
  const saveFailedSaid = useRef(false);
  const toastRef = useRef<(t: string) => void>(() => {});
  const setSave = useCallback((next: SaveData, observe = true) => {
    // 試遊の記録: the player's own steps only; an imported or reset save is not "played"
    if (observe) observeProgress(saveRef.current, next);
    // the ref moves at once: two writes in one tick (a "met" flag, then the
    // dialogue's own effects) must build on each other, not on the last render
    saveRef.current = next;
    setSaveRaw(next);
    // Recorded as soon as progress is decided (spec §19 保存).
    // no storage at all (blocked, private mode) counts as a failed save too (review V04)
    const store = storage();
    if (writable.current && (!store || !persist(store, next)) && !saveFailedSaid.current) {
      saveFailedSaid.current = true;
      study.emit('error', { code: 'save_write_failed' }, 'error-save-write');
      toastRef.current('この端末に記録を保存できませんでした。続けて遊べますが、閉じると消えます。設定の「記録を書き出す」で残せます。');
    }
  }, []);

  const commit = useCallback((effects: Effect[]) => setSave(apply(saveRef.current, effects)), [setSave]);

  const [entered, setEntered] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [dialogue, setDialogue] = useState<{ node: string; line: number } | null>(null);
  const [candidates, setCandidates] = useState<HotspotDef[] | null>(null);
  const [sketch, setSketch] = useState<Subject | null>(null);
  const [talk, setTalk] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [timeMenu, setTimeMenu] = useState(false);
  const [game, setGame] = useState<{ id: 'wrap' | 'tea' | 'tenugui' | 'trace'; then: string | null; trace?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(
    boot.kind === 'corrupt'
      ? '記録が読めなかったため、元の記録を退避して最初から始めます。'
      : boot.kind === 'unbacked'
        ? '記録が読めず、退避もできませんでした。元の記録はそのまま残し、この画面では保存しません。設定で書き出せます。'
      : boot.kind === 'newer'
        ? '新しい版の記録が見つかりました。その記録は書き換えず、この画面では保存しません。'
        : unknownScene()
          ? 'リンクの場面は見つかりませんでした。日本橋北詰の通りから始めます。'
          : null,
  );
  toastRef.current = setToast;
  const [reacting, setReacting] = useState<Set<string>>(new Set());
  const [hint, setHint] = useState<string | null>(null);
  // 様子を見る: the ring under the person stays a moment, then goes (spec §7)
  const [cue, setCue] = useState<{ spotId: string; key: number } | null>(null);
  useEffect(() => {
    if (!cue) return;
    const t = setTimeout(() => setCue(null), 2600);
    return () => clearTimeout(t);
  }, [cue]);
  const dismissedHint = useRef<string | null>(null);
  const street = useRef<StreetApi>(null);
  const inkyoFrom = useRef<number | null>(null);
  /** 動く人を描く: who was caught and where (`parasol-10642`), for the page made next. */
  const ugokiCatch = useRef<string | null>(null);
  /** 動く人を描く without tapping in time (keyboard, switch, or a slow hand): wait for this passer-by to enter the frame. */
  const [waitCatch, setWaitCatch] = useState<{ walker: string; key: string; until: number } | null>(null);
  const lastActivity = useRef(performance.now());

  const systemReduced = useSystemReducedMotion();
  const reduceMotion = save.settings.reduceMotion || systemReduced;
  const busy = !!(dialogue || candidates || sketch || game || panel || talk);
  // panels hold the keyboard while open; Escape closes the menu panels (journal,
  // items, nearby, settings). Games and the sketch close with their own buttons.
  useModalFocus(panel ?? (sketch ? `sketch-${sketch}` : game ? `game-${game.id}` : null), panel ? () => setPanel(null) : null);

  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(save.settings.textScale));
    document.documentElement.classList.toggle('rm', reduceMotion);
  }, [save.settings.textScale, reduceMotion]);

  // 試遊の記録: arrival, a return with progress, and a save that could not be read
  useEffect(() => {
    const viaLink = (() => {
      try {
        return new URLSearchParams(location.search).has('scene');
      } catch {
        return false;
      }
    })();
    study.emit('world_entered', { source: viaLink ? 'journal' : 'direct' }, 'world-entered');
    // 試遊会: a reload is the facilitator's, not a return visit
    if (!SESSION_MODE && boot.kind === 'loaded' && hasPlayableProgress(boot.save)) study.emit('revisit', { has_progress: true }, 'revisit');
    if (boot.kind === 'corrupt' || boot.kind === 'unbacked') study.emit('error', { code: 'save_read_failed' }, 'error-save-read');
    const unexpected = () => study.emit('error', { code: 'unexpected_error' }, 'error-unexpected');
    window.addEventListener('error', unexpected);
    window.addEventListener('unhandledrejection', unexpected);
    return () => {
      window.removeEventListener('error', unexpected);
      window.removeEventListener('unhandledrejection', unexpected);
    };
  }, []);

  // 音: nothing until the first touch or key; levels and time of day follow the save
  useEffect(() => {
    const go = () => sound.unlock();
    // WebKit counts the end of a touch (pointerup / touchend) as the user gesture
    const events = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;
    for (const e of events) window.addEventListener(e, go, true);
    return () => {
      for (const e of events) window.removeEventListener(e, go, true);
    };
  }, []);
  const soundOn = save.settings.soundOn === true;
  useEffect(() => sound.setEnabled(soundOn), [soundOn]);
  const toggleSound = () => {
    const on = !soundOn;
    setSave({ ...saveRef.current, settings: { ...saveRef.current.settings, soundOn: on }, updatedAt: new Date().toISOString() }, false);
    sound.setEnabled(on);
    if (on) sound.unlock(); // this press is the gesture
  };
  const levels = levelsOf(save.settings);
  useEffect(() => sound.setLevels(levels), [levels.ambient, levels.ui, levels.music]);
  // a page made and coins received each have their sound, beside what the screen shows
  const pageCount = save.journal.pages.length;
  const balance = save.wallet.balanceMinor;
  const lastCounts = useRef({ pageCount, balance });
  useEffect(() => {
    const was = lastCounts.current;
    if (pageCount > was.pageCount) sound.cue('page');
    if (balance > was.balance) setTimeout(() => sound.cue('coin'), pageCount > was.pageCount ? 700 : 0);
    lastCounts.current = { pageCount, balance };
  }, [pageCount, balance]);
  useEffect(() => {
    if (panel === 'journal') study.emit('journal_opened', { page_count: saveRef.current.journal.pages.length });
    if (panel === 'nearby') study.emit('play_detail', { what: 'nearby', outcome: 'opened' });
    if (panel === 'map') study.emit('play_detail', { what: 'map', outcome: 'opened' });
  }, [panel]);
  const sheetOpen = !!(panel || sketch || game);
  const lastSheet = useRef(sheetOpen);
  useEffect(() => {
    if (sheetOpen !== lastSheet.current) sound.cue(sheetOpen ? 'open' : 'close');
    lastSheet.current = sheetOpen;
  }, [sheetOpen]);

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
      // 探し物 in the play log: heard of, found, given back
      const lostStep = /^lost\.[a-z]+\.(hint|find|back)$/.exec(id)?.[1];
      if (lostStep && !inRecall) study.emit('play_detail', { what: 'lost', outcome: lostStep === 'hint' ? 'hinted' : lostStep === 'find' ? 'found' : 'returned' });
      // a passing moment (the cat leaping away): a note over the street, so the street stays in view
      if (n.brief && !inRecall) {
        if (next !== saveRef.current) setSave(next);
        setToast(n.lines[0].text);
        return setDialogue(null);
      }
      // a node may leave a journal page: made once, kept even if the dialogue is closed early
      if (n.page && !inRecall) next = addPage(next, { pageId: n.page.pageId, compositionId: n.page.compositionId.replace('{tod}', timeOf(next)).replace('{catch}', ugokiCatch.current ?? defaultCatch()), titleStyle: 'plain', madeAt: new Date().toISOString() });
      if (inRecall) {
        // a memory is not where the player stands: bring the speaker into view
        const who = linesOf(n, true).find((l) => l.by !== 'narration')?.by;
        const spot = who && HOTSPOTS.find((h) => h.id === `h-${who}`);
        if (spot) street.current?.focus(spot.anchor.x);
      }
      if (n.page && inRecall) {
        const before = next;
        next = addRecallPage(next, n.page.pageId, n.page.compositionId.replace('{catch}', defaultCatch()));
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
      setWaitCatch(null); // touching something else ends the waiting
      // ご隠居の散歩: he sets off from where he was walking when asked (the tap's live place)
      if (spot.id === 'h-inkyo') inkyoFrom.current = spot.anchor.x;
      // 動く人を描く: a passer-by tapped while the lesson is on — inside their frame, the page
      if (spot.walker && hasFlag(saveRef.current, 'ugoki_look') && questState(saveRef.current, 'ugoki') !== 'complete') {
        const key = Object.keys(UGOKI_PEOPLE).find((k) => UGOKI_PEOPLE[k].walker === spot.walker);
        const f = key ? frameOf(spot.walker) : null;
        if (key && f) {
          sound.cue('tap');
          if (spot.anchor.x >= f.lo && spot.anchor.x <= f.hi) {
            ugokiCatch.current = `${key}-${Math.round(spot.anchor.x)}`;
            study.emit('play_detail', { what: 'ugoki', outcome: 'caught' });
            return openNode('ugoki.caught');
          }
          study.emit('play_detail', { what: 'ugoki', outcome: 'miss' });
          return setToast('枠の外だ。その人が枠に入ったところで、もう一度。');
        }
      }
      if (spot.kind === 'ambient') {
        sound.cue('react');
        study.emit('first_interaction_completed', { interaction_id: 'observation', elapsed_ms: study.elapsed() }, 'first-interaction');
        const id = spot.targetId;
        setReacting((r) => new Set(r).add(id));
        // a passer-by spoken to stands still while the word is read
        setTimeout(() => setReacting((r) => ((r = new Set(r)), r.delete(id), r)), spot.walker ? 3200 : 1400);
        if (spot.walker) study.emit('play_detail', { what: 'passer', outcome: 'tapped' });
        // 町の写生: after the first page, some places can be drawn (once each)
        const k = sketchOfSpot(id);
        const cur = saveRef.current;
        if (k && questState(cur, 'kaze') === 'complete' && !cur.journal.pages.some((p) => p.pageId === sketchPageId(k.id))) return openNode(`sk.${k.id}`);
        setToast(ambientText(id, timeOf(cur)) ?? null);
        return;
      }
      sound.cue('tap');
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
    if (dialogue && ON_CLOSE[baseNode(dialogue.node)]) commit(ON_CLOSE[baseNode(dialogue.node)]);
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
    sound.cue('turn');
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
      if (ON_CLOSE[baseNode(dialogue!.node)]) commit(ON_CLOSE[baseNode(dialogue!.node)]);
      setDialogue(null);
      setTalk(n.lines.find((l) => l.by !== 'narration')?.by ?? null);
      return;
    }
    if (c.sketch) {
      setDialogue(null);
      setSketch(c.sketch);
    } else if (c.game) {
      setDialogue(null);
      setGame({ id: c.game, then: c.next ?? null, trace: c.trace });
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
  // 「近くのこと」 near where the player is: read the camera when the list is (re)made
  /** The part of the street in view now (scene units), for the map. */
  const streetView = () => {
    const el = document.querySelector<HTMLElement>('.street');
    const cam = Number(el?.dataset.cam);
    const scale = Number(el?.dataset.scale) || 1;
    return Number.isFinite(cam) && el ? { x0: cam, w: el.getBoundingClientRect().width / scale } : null;
  };
  const camMid = () => {
    const el = document.querySelector<HTMLElement>('.street');
    const cam = Number(el?.dataset.cam);
    const scale = Number(el?.dataset.scale) || 1;
    return Number.isFinite(cam) && el ? cam + el.getBoundingClientRect().width / scale / 2 : undefined;
  };
  const nbAll = useMemo(() => nearbyAll(save, camMid()), [save, panel]); // eslint-disable-line react-hooks/exhaustive-deps
  const nb = nbAll.slice(0, 3);
  const nbMore = nbAll.slice(3);
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

  const canSketch = (targetId: string) => {
    const k = sketchOfSpot(targetId);
    return !!k && k.spots[0] === targetId && questState(save, 'kaze') === 'complete' && !save.journal.pages.some((p) => p.pageId === sketchPageId(k.id));
  };

  // 通りの案内: close the panel, bring the stop to the middle, and hand the keyboard to the street
  const visitStop = (id: string, x: number) => {
    study.emit('guide_stop_selected', { stop_id: id });
    setPanel(null);
    setHint(null);
    street.current?.focus(x);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.street')?.focus({ preventScroll: true }));
  };
  const nearestStop = () => {
    const cam = Number(document.querySelector<HTMLElement>('.street')?.dataset.cam);
    const w = document.querySelector<HTMLElement>('.street')?.getBoundingClientRect().width ?? 0;
    const scale = Number(document.querySelector<HTMLElement>('.street')?.dataset.scale) || 1;
    if (!Number.isFinite(cam)) return null;
    const mid = cam + w / scale / 2;
    return GUIDE_STOPS.reduce((a, b) => (Math.abs(b.x - mid) < Math.abs(a.x - mid) ? b : a)).id;
  };

  const goTo = (spotId: string, open: boolean) => {
    const spot = HOTSPOTS.find((h) => h.id === spotId);
    if (!spot) return;
    setPanel(null);
    setHint(null);
    street.current?.focus(spot.anchor.x);
    if (open) openTarget(spot);
  };

  const spots = useMemo(() => visibleSpots(save), [save]);
  // 動く人を描く, the waiting way: watch the chosen passer-by and draw them once inside the frame
  const ugokiOn = hasFlag(save, 'ugoki_look') && questState(save, 'ugoki') !== 'complete' && !raining(save);
  const waitToCatch = (spot: HotspotDef) => {
    const key = Object.keys(UGOKI_PEOPLE).find((k) => UGOKI_PEOPLE[k].walker === spot.walker);
    const f = key && spot.walker ? frameOf(spot.walker) : null;
    if (!key || !f || !spot.walker) return;
    setPanel(null);
    setHint(null);
    street.current?.focus((f.lo + f.hi) / 2);
    setWaitCatch({ walker: spot.walker, key, until: Date.now() + 60_000 });
    setToast(`${UGOKI_PEOPLE[key].who}が枠に入るのを、筆を構えて待っている……`);
  };
  useEffect(() => {
    if (!waitCatch || busy) return;
    const f = frameOf(waitCatch.walker)!;
    const t = setInterval(() => {
      const x = street.current?.walkerX(waitCatch.walker) ?? null;
      if (x !== null && x >= f.lo + 4 && x <= f.hi - 4) {
        clearInterval(t);
        setWaitCatch(null);
        ugokiCatch.current = `${waitCatch.key}-${Math.round(x)}`;
        study.emit('play_detail', { what: 'ugoki', outcome: 'caught' });
        openNode('ugoki.caught');
      } else if (Date.now() > waitCatch.until) {
        clearInterval(t);
        setWaitCatch(null);
        setToast('その人は、しばらく通りそうにない。ほかの人を待ってみよう。');
      }
    }, 120);
    return () => clearInterval(t);
  }, [waitCatch, busy, openNode]);
  // ご隠居の散歩: he walks with the player once asked, until he reaches the bench
  const walking = hasFlag(save, 'inkyo_walk') && !hasFlag(save, 'inkyo_arrived') && questState(save, 'inkyo') !== 'complete';
  const companion = useMemo(() => (walking ? { from: inkyoFrom.current ?? INKYO_WALK.from, to: INKYO_BENCH.x, stops: INKYO_STOPS } : null), [walking]);
  const onCompanion = useCallback(
    (e: { say: string } | { arrived: true } | { behind: true }) => {
      if ('say' in e) return setToast(e.say);
      if ('behind' in e) return void study.emit('play_detail', { what: 'companion', outcome: 'behind' });
      study.emit('play_detail', { what: 'companion', outcome: 'arrived' });
      commit([{ type: 'setFlag', flag: 'inkyo_arrived' }]);
      openNode('inkyo.arrive');
    },
    [commit, openNode],
  );
  // 章: when a story's end opens the next batch, say so once the dialogue is closed (never on load)
  const chapters = openChapters(save);
  const shownChapters = useRef(chapters);
  useEffect(() => {
    if (busy || chapters <= shownChapters.current) return;
    shownChapters.current = chapters;
    study.emit('play_detail', { what: 'chapter', outcome: 'opened' });
    setTimeout(() => setToast('町に、新しい頼みごとが増えたようだ。「近くのこと」をのぞいてみよう。'), 400);
  }, [chapters, busy]);
  const tod = timeOf(save);
  useEffect(() => sound.setTime(tod), [tod]);
  const reached = reachedTimes(save);
  // when a story's end moves the day on, say so once
  const lastTime = useRef(tod);
  const bellRung = useRef(new Set<string>());
  useEffect(() => {
    if (lastTime.current === tod) return;
    const lines: string[] = [];
    if (save.settings.timeChoice === 'auto' && reached.indexOf(tod) > reached.indexOf(lastTime.current)) {
      const line = TIMES.find((t) => t.id === tod)!.arrive;
      if (line) lines.push(line);
    }
    // 石町の時の鐘 marks the arrival of 朝 and 夕, from far off (shown as words too).
    // At most once per time of day in a visit: looking back and forth between
    // times does not ring it again (Codex review of #136). Loading never rings.
    if ((tod === 'morning' || tod === 'evening') && !bellRung.current.has(tod)) {
      bellRung.current.add(tod);
      sound.timeBell();
      lines.push(BELL_LINE);
    }
    if (lines.length) setTimeout(() => setToast(lines.join('　')), 600);
    lastTime.current = tod;
  }, [tod]);
  const node = dialogue ? NODES[dialogue.node] : null;
  const shown = node ? linesOf(node, !!recall) : [];
  const line = shown[dialogue?.line ?? 0];
  const atLast = node && dialogue!.line === shown.length - 1;
  const hasProgress = save.progress.flags.length > 0;

  return (
    <div className="app">
      <header className="top">
        <button type="button" className="place map-open" onClick={() => setPanel('map')} disabled={!entered} aria-label="町の絵図を開く（日本橋北詰）">
          <span className="map-open-name">日本橋北詰</span>
          <span className="map-open-mark" aria-hidden="true">図</span>
        </button>
        {SESSION_MODE && <span className="session-badge">試遊会</span>}
        {reached.length > 1 ? (
          <button type="button" className="time ghost" aria-expanded={timeMenu} onClick={() => setTimeMenu((m) => !m)}>
            {TIMES.find((t) => t.id === tod)!.label}
          </button>
        ) : (
          <span className="time">{TIMES.find((t) => t.id === tod)!.label}</span>
        )}
        {timeMenu && (
          <div className="time-menu" role="menu" aria-label="時間帯">
            {TIMES.filter((t) => reached.includes(t.id)).map((t) => (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={tod === t.id}
                key={t.id}
                onClick={() => {
                  // the latest reached time means "follow the story" again
                  const choice = t.id === reached[reached.length - 1] ? 'auto' : t.id;
                  setSave({ ...save, settings: { ...save.settings, timeChoice: choice }, updatedAt: new Date().toISOString() });
                  setTimeMenu(false);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {rainOpen(save) && (
          <button
            type="button"
            className="time ghost weather"
            aria-pressed={raining(save)}
            aria-label={raining(save) ? '雨（押すと晴れに）' : '晴れ（押すと雨に）'}
            onClick={() => {
              study.emit('play_detail', { what: 'weather', outcome: raining(save) ? 'clear' : 'rain' });
              setSave({ ...save, settings: { ...save.settings, rain: !raining(save) }, updatedAt: new Date().toISOString() });
            }}
          >
            {raining(save) ? '雨' : '晴'}
          </button>
        )}
        <button type="button" className="ghost sound-toggle" aria-pressed={soundOn} onClick={toggleSound} aria-label={soundOn ? '音を止める' : '音を出す'} title={soundOn ? '音を止める' : '音を出す'}>
          <span aria-hidden="true">♪</span>
        </button>
        <button type="button" className="ghost" onClick={() => setPanel('settings')}>
          設定
        </button>
      </header>

      <main className={`stage tod-${tod}${raining(save) ? ' rain' : ''}`}>
        {raining(save) && <div className="rain-layer" aria-hidden="true" />}
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
          cue={cue}
          dragHint={!hasPlayableProgress(save)}
          onActivity={activity}
          onCamera={(x) => sound.place(x)}
          companion={companion}
          onCompanion={onCompanion}
        />

        {!entered && (
          <section className="title" aria-labelledby="title-h">
            <h1 id="title-h">
              <span className="series">清明上河図：江戸編</span>
              日本橋、ひと頁
            </h1>
            <p>絵師の見習いとして、春の日本橋をしばらく歩きます。</p>
            <p className="small">音ははじめは出ません。右上の「♪」で出せます。</p>
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
            <button
              type="button"
              onClick={() => {
                const spotId = nb.find((n) => n.id === hint)!.spotId;
                goTo(spotId, false);
                setCue({ spotId, key: performance.now() });
              }}
            >
              様子を見る
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
              {spotLabel(c)}
            </button>
          ))}
          <button type="button" className="ghost" onClick={() => setCandidates(null)}>
            町に戻る
          </button>
        </div>
      )}

      {node && line && (
        <div
          className={`sheet dialogue${recall ? ' recall' : ''}`}
          role="dialog"
          aria-live="polite"
          aria-label={recall ? '回想' : '会話'}
          onClick={(e) => {
            // a tap anywhere on the sheet turns the line (1A); closing, choices, 難語 and their notes keep their own buttons
            if (atLast && (node.choices || !node.next)) return;
            if ((e.target as HTMLElement).closest('button, a, [role="note"], input')) return;
            if (window.getSelection()?.toString()) return;
            advance();
          }}
        >
          {recall && <p className="recall-tag">回想　— 文は増えません</p>}
          <div className="line-body">
            {line.by !== 'narration' && <Face who={line.by} />}
            {line.by !== 'narration' && (
              <p className="speaker">
                {characterById.get(line.by)?.displayName}
                <small>{ROLES[line.by]}</small>
              </p>
            )}
            <Glossed className={line.by === 'narration' ? 'narration' : 'said'} text={line.text} />
          </div>
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
        <Talk who={talk} done={TALK_STORIES.filter((q) => questState(save, q) === 'complete')} complete={Object.keys(save.progress.quests).filter((q) => questState(save, q) === 'complete')} onClose={() => setTalk(null)} />
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
        if (game.id === 'trace') return <Trace sketchId={game.trace!} tod={timeOf(save)} onDone={done} onCancel={cancel} />;
        return <Tenugui onDone={done} onCancel={cancel} />;
      })()}
      {sketch && <Sketch subject={sketch} onDone={finishSketch} onCancel={() => { setSketch(null); if (recallRef.current) endRecall(); }} reduceMotion={reduceMotion} />}

      {panel === 'journal' && <Journal save={save} onClose={() => setPanel(null)} onToast={setToast} onRecall={startRecall} />}
      {panel === 'map' && (
        <TownMap
          save={save}
          view={streetView()}
          onGo={(x) => {
            setPanel(null);
            setHint(null);
            street.current?.focus(x);
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'items' && (
        <div className="panel" role="dialog" aria-labelledby="items-h">
          <h2 id="items-h">持ち物</h2>
          <p className="purse">
            所持金 <strong>{save.wallet.balanceMinor}</strong> 文
          </p>
          <p className="small">文はこの町の中だけで使うお金です。金額は遊びのための調整値で、1805年の物価ではありません。</p>
          {(() => {
            const carried = [
              ...(hasFlag(save, 'dougu_carry') && questState(save, 'dougu') !== 'complete' ? ['お紺から預かった包み（金次さんの弁当箱・箸箱・砥石）'] : []),
              // 探し物: found, not yet given back
              ...LOST.filter((t) => hasFlag(save, `lost_found_${t.id}`) && !hasFlag(save, `lost_back_${t.id}`)).map((t) => `拾った${t.name}（${t.place}で）`),
            ];
            return carried.length ? (
              <ul className="list">
                {carried.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : (
              <p>持ち物はまだありません。</p>
            );
          })()}
          {LOST.some((t) => hasFlag(save, `lost_back_${t.id}`)) && (
            <p className="small">持ち主に返した落とし物：{LOST.filter((t) => hasFlag(save, `lost_back_${t.id}`)).map((t) => t.name).join('、')}</p>
          )}
          <button type="button" className="primary panel-foot" onClick={() => setPanel(null)}>
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
          {nbMore.length > 0 && (
            <details className="fold more" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && study.emit('play_detail', { what: 'nearby_more', outcome: 'opened' })}>
              <summary>ほかの頼みごと（{nbMore.length}）</summary>
              <ul className="list compact">
                {nbMore.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => goTo(n.spotId, false)}>
                      {n.text}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <details className="guide">
            <summary>通りの案内</summary>
            <p className="small">橋のたもとから町はずれの川端まで。行きたいところを選ぶと、その場所へ通りが動きます。</p>
            <nav aria-label="通りの案内" className="guide-stops">
              {(() => {
                const here = nearestStop();
                return GUIDE_STOPS.map((g) => (
                  <button type="button" key={g.id} aria-current={here === g.id ? 'location' : undefined} onClick={() => visitStop(g.id, g.x)}>
                    <span>{g.name}</span>
                    <small>{g.note}</small>
                  </button>
                ));
              })()}
            </nav>
          </details>
          <details className="fold">
            <summary>この通りの人と物（文字で選ぶ）</summary>
          <ul className="list compact">
            {spots
              // a lost thing is in the list once its owner has spoken of it (before that, only a sharp eye finds it)
              .filter((s) => s.kind !== 'ambient' && !(s.targetId.startsWith('lost_') && !hasFlag(save, `lost_hint_${s.targetId.slice(5)}`)))
              .map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => goTo(s.id, true)}>
                    {spotLabel(s)}
                  </button>
                </li>
              ))}
            {ugokiOn &&
              spots
                .filter((s) => s.kind === 'ambient' && s.walker && Object.values(UGOKI_PEOPLE).some((u) => u.walker === s.walker))
                .map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => waitToCatch(s)}>
                      {AMBIENT_LABEL[s.targetId]}
                      <span className="small">（枠を通るのを待って描く）</span>
                    </button>
                  </li>
                ))}
            {spots
              .filter((s) => s.kind === 'ambient' && !s.walker)
              .map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => goTo(s.id, true)}>
                    {AMBIENT_LABEL[s.targetId]}
                    {canSketch(s.targetId) && <span className="small">（写生できる）</span>}
                  </button>
                </li>
              ))}
          </ul>
          </details>
          <button type="button" className="primary panel-foot" onClick={() => setPanel(null)}>
            町に戻る
          </button>
        </div>
      )}
      {panel === 'settings' && (
        <Settings
          save={save}
          onChange={setSave}
          unreadable={unreadable}
          onAllowOverwrite={() => {
            writable.current = true;
            setUnreadable(null);
            setSave(saveRef.current, false);
            setToast('この端末で、新しい記録の保存を始めました。');
          }}
          onReplace={(s) => {
            setUnreadable(null);
            writable.current = true;
            setSave(s, false);
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

/** `okon.again@evening` → `okon.again`: a time-of-day word closes like its base node. */
const baseNode = (id: string) => id.split('@')[0];

/** The lines a node shows; in 回想 the ones about being paid are left out. */
function linesOf(n: (typeof NODES)[string], inRecall: boolean) {
  return inRecall ? n.lines.filter((l) => !l.reward) : n.lines;
}

/** 動く人を描く in 回想 (nobody is caught there): the parasol girl in the middle of her frame. */
function defaultCatch(): string {
  const f = frameOf(UGOKI_PEOPLE.parasol.walker)!;
  return `parasol-${Math.round((f.lo + f.hi) / 2)}`;
}
