import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Engine } from '../engine/engine';
import { sound } from '../sound';
import { logEvent } from '../telemetry';
import { canRecord, Compositor, isWeChat, RECORD_SECONDS, Recording, saveTake, type Take } from './recorder';

// Recording UI (docs/02 §6.2; docs/03 §5.1, §5.4, §11): a dot button next to
// 更多, a 3-2-1 countdown, a cinnabar progress ring and a 「● 录制中 12s」
// badge that stay out of the video, then a preview sheet.

type FrameSink = MutableRefObject<((c: HTMLCanvasElement) => void) | null>;
type Phase =
  | { kind: 'idle' }
  | { kind: 'countdown'; n: number }
  | { kind: 'recording'; since: number }
  | { kind: 'preview'; take: Take; confirm: boolean };

export interface RecorderApi {
  phase: Phase;
  supported: boolean;
  press: () => void;
  save: () => void;
  retake: () => void;
  discard: () => void;
  askDiscard: (ask: boolean) => void;
}

export function useRecorder(engineRef: MutableRefObject<Engine | null>, sink: FrameSink, note: (text: string) => void): RecorderApi {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const recording = useRef<Recording | null>(null);
  const timers = useRef<number[]>([]);
  const supported = useRef(canRecord()).current;

  const clearTimers = () => {
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
  };

  const finish = useCallback(async () => {
    const rec = recording.current;
    if (!rec) return;
    recording.current = null;
    sink.current = null;
    clearTimers();
    engineRef.current?.holdTier(false);
    const take = await rec.stop();
    logEvent('record_complete', { seconds: Math.round(take.seconds * 10) / 10, format: take.ext });
    setPhase({ kind: 'preview', take, confirm: false });
  }, [engineRef, sink]);

  const begin = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.world');
    if (!canvas) return;
    engineRef.current?.holdTier(true);
    const rec = new Recording(canvas, sound.stream());
    recording.current = rec;
    sink.current = (c) => rec.frame(c);
    logEvent('record_start', {});
    setPhase({ kind: 'recording', since: performance.now() });
    timers.current.push(window.setTimeout(finish, RECORD_SECONDS * 1000));
  }, [engineRef, sink, finish]);

  const countdown = useCallback(() => {
    setPhase({ kind: 'countdown', n: 3 });
    timers.current.push(
      window.setTimeout(() => setPhase({ kind: 'countdown', n: 2 }), 1000),
      window.setTimeout(() => setPhase({ kind: 'countdown', n: 1 }), 2000),
      window.setTimeout(begin, 3000),
    );
  }, [begin]);

  /** No MediaRecorder: save the current frame as a PNG instead. */
  const saveFrame = useCallback(() => {
    sink.current = (c) => {
      sink.current = null;
      const comp = new Compositor(c);
      comp.draw(c);
      void comp.snapshot().then(async (blob) => {
        const take: Take = { blob, url: URL.createObjectURL(blob), ext: 'png', seconds: 0 };
        const how = await saveTake(take);
        URL.revokeObjectURL(take.url);
        logEvent('save', { how, format: 'png' });
        if (how !== 'cancelled') note('这一帧已保存');
      });
    };
  }, [sink, note]);

  const press = useCallback(() => {
    if (isWeChat()) {
      note('在浏览器中打开，才能保存作品');
      return;
    }
    if (!supported) {
      saveFrame();
      return;
    }
    if (phase.kind === 'idle') countdown();
    else if (phase.kind === 'countdown') {
      clearTimers();
      setPhase({ kind: 'idle' });
    } else if (phase.kind === 'recording') void finish();
  }, [phase.kind, supported, countdown, finish, saveFrame, note]);

  // Going to the background or rotating ends the take and keeps what was recorded.
  useEffect(() => {
    if (phase.kind !== 'recording') return;
    const end = () => void finish();
    const onVis = () => document.hidden && end();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', end);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', end);
    };
  }, [phase.kind, finish]);

  useEffect(
    () => () => {
      clearTimers();
      sink.current = null;
    },
    [sink],
  );

  const close = useCallback(() => {
    if (phase.kind === 'preview') URL.revokeObjectURL(phase.take.url);
    setPhase({ kind: 'idle' });
  }, [phase]);

  const save = useCallback(async () => {
    if (phase.kind !== 'preview') return;
    const how = await saveTake(phase.take);
    logEvent('save', { how, format: phase.take.ext });
    if (how === 'cancelled') return;
    close();
    note('作品已保存');
  }, [phase, close, note]);

  const retake = useCallback(() => {
    close();
    countdown();
  }, [close, countdown]);

  const askDiscard = useCallback((confirm: boolean) => {
    setPhase((p) => (p.kind === 'preview' ? { ...p, confirm } : p));
  }, []);

  return { phase, supported, press, save, retake, discard: close, askDiscard };
}

export function RecordButton({ api }: { api: RecorderApi }) {
  const { phase, supported } = api;
  const active = phase.kind === 'recording';
  const label = !supported
    ? '保存这一帧'
    : active
      ? '结束录制'
      : phase.kind === 'countdown'
        ? '取消录制'
        : `录制 ${RECORD_SECONDS} 秒`;
  return (
    <button type="button" className={`icon-btn record${active ? ' on' : ''}`} aria-label={label} title={label} onClick={api.press}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        {supported ? (
          <circle cx="12" cy="12" r={active ? 4 : 5} fill="currentColor" stroke="none" />
        ) : (
          <>
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.5" />
          </>
        )}
        {active && <circle className="ring" cx="12" cy="12" r="10" style={{ animationDuration: `${RECORD_SECONDS}s` }} />}
      </svg>
    </button>
  );
}

/** Countdown, badge and preview: outside the dimmed chrome, never in the video. */
export function RecordOverlays({ api }: { api: RecorderApi }) {
  const { phase } = api;
  const [secs, setSecs] = useState(0);
  const saveBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (phase.kind !== 'recording') return;
    const since = phase.since;
    setSecs(0);
    const id = window.setInterval(() => setSecs(Math.floor((performance.now() - since) / 1000)), 250);
    return () => clearInterval(id);
  }, [phase]);

  const previewing = phase.kind === 'preview';
  useEffect(() => {
    if (!previewing) return;
    opener.current = document.activeElement;
    saveBtn.current?.focus();
    return () => {
      (document.querySelector('.icon-btn.record') as HTMLElement | null)?.focus();
    };
  }, [previewing]);

  useEffect(() => {
    if (phase.kind !== 'preview') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') api.askDiscard(!phase.confirm);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, api]);

  if (phase.kind === 'countdown') {
    return (
      <div className="countdown" aria-live="assertive" key={phase.n}>
        {phase.n}
      </div>
    );
  }
  if (phase.kind === 'recording') {
    return (
      <div className="rec-badge" role="status">
        <span className="rec-dot" aria-hidden="true" />
        录制中 {secs}s
      </div>
    );
  }
  if (phase.kind !== 'preview') return null;

  return (
    <>
      <div className="scrim" onClick={() => api.askDiscard(true)} />
      <div className="sheet preview" role="dialog" aria-modal="true" aria-label="作品预览">
        <video src={phase.take.url} autoPlay loop muted playsInline />
        {phase.confirm ? (
          <div className="preview-actions">
            <span className="confirm-q">放弃这段作品？</span>
            <button type="button" className="text-btn" onClick={api.discard}>
              放弃
            </button>
            <button type="button" className="text-btn primary" onClick={() => api.askDiscard(false)}>
              留着
            </button>
          </div>
        ) : (
          <div className="preview-actions">
            <button ref={saveBtn} type="button" className="text-btn primary" onClick={api.save}>
              保存
            </button>
            <button type="button" className="text-btn" onClick={api.retake}>
              重录
            </button>
            <button type="button" className="text-btn" onClick={() => api.askDiscard(true)}>
              放弃
            </button>
          </div>
        )}
      </div>
    </>
  );
}
