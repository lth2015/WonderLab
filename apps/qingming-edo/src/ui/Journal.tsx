import { useEffect, useRef, useState } from 'react';
import type { JournalEntry, SaveData } from '../contract';
import { PAGE_SLOTS, PAGE_TITLES, parseKaze, parseSketch, questOfPage, validJournalEntry } from '../content/world';
import { TIMES } from '../engine/time';
import { study } from '../engine/study';
import { replayable } from '../engine/story';
import { PageArt, pageToPng } from '../scene/PageArt';
import { PaintedPageScene } from '../scene/painted';

import { ScrollExport } from './ScrollExport';
import { COMMENT, COMMENT_BY_COMPOSITION, PLACE, RECALL_NOTE } from '../content/pageText';
import { GIFT_KINDS, type GiftKind } from '../content/gift';
// 絵巻帳 (spec §6, §10, §18): only what actually happened. A page, once made,
// stays even if the save dialog is closed. Saving the clear image is free.

function comment(entry: JournalEntry): string | null {
  const k = parseKaze(entry.compositionId);
  const sk = parseSketch(entry.compositionId);
  return k ? COMMENT[k.subject] : sk ? sk.sketch.comment : (COMMENT_BY_COMPOSITION[entry.compositionId] ?? null);
}
const CREDIT = '清明上河図：江戸編';
/** The one scene a link may name (spec §16): the work's address plus ?scene=nihonbashi, nothing else. */
export const SCENE_ID = 'nihonbashi';
function workLink(): string {
  const url = new URL(import.meta.env.BASE_URL, location.origin);
  url.searchParams.set('scene', SCENE_ID);
  return url.toString();
}

function Page({ entry, idPrefix, note }: { entry: JournalEntry; idPrefix: string; note?: string }) {
  const k = parseKaze(entry.compositionId);
  const common = { titleStyle: entry.titleStyle, title: PAGE_TITLES[entry.pageId], credit: CREDIT, idPrefix, note };
  if (k) return <PageArt scene={<PaintedPageScene composition={entry.compositionId} />} place={PLACE[entry.pageId]} {...common} />;
  const sk = parseSketch(entry.compositionId);
  const place = sk ? `日本橋・${TIMES.find((t) => t.id === sk.tod)!.label}　${sk.sketch.place}` : PLACE[entry.compositionId];
  return <PageArt scene={<PaintedPageScene composition={entry.compositionId} />} place={place} {...common} />;
}

export function Journal({ save, onClose, onToast, onRecall }: { save: SaveData; onClose(): void; onToast(t: string): void; onRecall(quest: string): void }) {
  const [open, setOpen] = useState<JournalEntry | null>(null);
  const [scroll, setScroll] = useState(false);
  // 贈る画: the word chosen for a friend, or none (the page as it is)
  const [gift, setGift] = useState<string | null>(null);
  const [giftKind, setGiftKind] = useState<GiftKind['id']>(GIFT_KINDS[0].id);
  const [giftOpen, setGiftOpen] = useState(false);
  useEffect(() => {
    setGift(null);
    setGiftOpen(false);
  }, [open]);
  const big = useRef<HTMLDivElement>(null);
  // a page this version cannot draw is left out rather than breaking the book (review F01)
  const pages = save.journal.pages.filter((p) => validJournalEntry(p.pageId, p.compositionId));

  // The page image is made as soon as a page is opened, so the share sheet can be
  // opened straight from the tap (iOS drops the gesture during a slow await).
  const [png, setPng] = useState<{ pageId: string; gift: string | null; blob: Blob } | null>(null);
  const [pngFailed, setPngFailed] = useState(false);
  useEffect(() => {
    setPng(null);
    setPngFailed(false);
    if (!open) return;
    let alive = true;
    const t = setTimeout(async () => {
      const svg = big.current?.querySelector('svg');
      if (!svg) return;
      try {
        const blob = await pageToPng(svg);
        if (alive) setPng({ pageId: open.pageId, gift, blob });
      } catch {
        if (alive) setPngFailed(true);
      }
    }, 50);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, gift]);
  const ready = png && open && png.pageId === open.pageId && png.gift === gift ? png.blob : null;
  const fileName = open ? `nihonbashi-${gift ? 'okurie' : 'hitopage'}-${open.pageId}.png` : '';

  const download = async () => {
    const svg = big.current?.querySelector('svg');
    if (!svg || !open) return;
    study.emit('journal_export_attempted', { page_id: open.pageId, export_type: 'png' });
    try {
      const blob = ready ?? (await pageToPng(svg));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      study.emit('journal_export_completed', { page_id: open.pageId, export_type: 'png', stage: 'download_requested' });
      onToast('画像を保存しました。');
    } catch {
      study.emit('error', { code: 'postcard_export_failed' });
      onToast('画像を作れませんでした。もう一度お試しください。頁は絵巻帳に残っています。');
    }
  };

  const copyLink = async () => {
    // Only the work's own address and its scene: no balance, reward or save in the link (spec §18).
    const url = workLink();
    if (open) study.emit('share_attempted', { page_id: open.pageId, method: 'link' });
    try {
      await navigator.clipboard.writeText(url);
      study.emit('share_result', { method: 'link', result: 'copied' });
      onToast('作品へのリンクをコピーしました。');
    } catch {
      study.emit('share_result', { method: 'link', result: 'unavailable' });
      onToast(url);
    }
  };

  // 共有 (spec §18): the device's own share sheet, with the page image where it can carry files.
  // Where there is none, the save and copy buttons stay. Cancelling is not an error.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const share = async () => {
    if (!open) return;
    const data: ShareData = { title: '日本橋、ひと頁', text: gift ? `${gift} — ${CREDIT}` : `「${PAGE_TITLES[open.pageId]}」 — ${CREDIT}`, url: workLink() };
    if (ready) {
      // a probe that throws means "no files here": share the link instead (review F04)
      try {
        const file = new File([ready], fileName, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) data.files = [file];
      } catch {
        /* link only */
      }
    }
    const method = data.files ? 'system' : 'system_link';
    study.emit('share_attempted', { page_id: open.pageId, method });
    try {
      await navigator.share(data);
      study.emit('share_result', { method, result: 'invoked' }); // the sheet was used: not proof it reached anyone
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') {
        study.emit('share_result', { method, result: 'cancelled' });
        return; // the player closed the sheet
      }
      study.emit('share_result', { method, result: 'failed' });
      onToast('共有できませんでした。画像を保存するか、リンクをコピーしてください。');
    }
  };

  if (open) {
    const said = comment(open);
    return (
      <div className={`panel page-view${giftOpen ? ' gifting' : ''}`} role="dialog" aria-labelledby="page-h">
        <h2 id="page-h">{PAGE_TITLES[open.pageId]}</h2>
        <div className="page-big" ref={big}>
          <Page entry={open} idPrefix="big" note={gift ?? undefined} />
        </div>
        {pngFailed && <p className="small">共有用の画像を作れませんでした。リンクの共有と、画像の保存（もう一度作ります）はできます。</p>}
        {said && (
          <p className="comment">
            <span className="who">宗吉</span>「{said}」
          </p>
        )}
        <div className="row">
          {canShare && (
            <button type="button" className="primary" onClick={share}>
              共有する
            </button>
          )}
          <button type="button" className={canShare ? undefined : 'primary'} onClick={download}>
            画像を保存
          </button>
          <button type="button" onClick={copyLink}>
            作品のリンクをコピー
          </button>
        </div>
        <details className="gift" open={giftOpen || undefined} onToggle={(e) => setGiftOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>贈る画にする</summary>
          <p className="small">一言を添えると、上の画がそのまま贈る画になります（進み具合や所持金は入りません）。</p>
          <div className="seg" role="group" aria-label="言葉の種類">
            {GIFT_KINDS.map((k) => (
              <button type="button" key={k.id} aria-pressed={giftKind === k.id} onClick={() => setGiftKind(k.id)}>
                {k.label}
              </button>
            ))}
          </div>
          <div className="gift-lines" role="radiogroup" aria-label="添える言葉">
            {GIFT_KINDS.find((k) => k.id === giftKind)!.lines.map((line) => (
              <label key={line} className="check">
                <input type="radio" name="gift-line" checked={gift === line} onChange={() => setGift(line)} />
                <span>{line}</span>
              </label>
            ))}
            <label className="check">
              <input type="radio" name="gift-line" checked={gift === null} onChange={() => setGift(null)} />
              <span>言葉を添えない（元の頁）</span>
            </label>
          </div>
        </details>
        {(() => {
          const q = questOfPage(open.pageId);
          if (!q || !replayable(q, save)) return null;
          return (
            <div className="recall-box">
              <button type="button" onClick={() => onRecall(q)}>
                この場面を回想する
              </button>
              <p className="small">{RECALL_NOTE[q]}回想では文は増えず、町の様子も変わりません。</p>
            </div>
          );
        })()}
        <button type="button" className="ghost panel-foot" onClick={() => setOpen(null)}>
          絵巻帳に戻る
        </button>
      </div>
    );
  }

  if (scroll) {
    return (
      <div className="panel" role="dialog" aria-labelledby="journal-h">
        <h2 id="journal-h">絵巻帳</h2>
        <ScrollExport save={save} onBack={() => setScroll(false)} onToast={onToast} />
      </div>
    );
  }

  return (
    <div className="panel" role="dialog" aria-labelledby="journal-h">
      <h2 id="journal-h">絵巻帳</h2>
      <p className="small">
        {pages.length} / {PAGE_SLOTS} 頁{pages.length >= PAGE_SLOTS && '　一冊になりました'}
      </p>
      <ul className="slots">
        {Array.from({ length: PAGE_SLOTS }, (_, i) => {
          const e = pages[i];
          return (
            <li key={i}>
              {e ? (
                <button type="button" className="slot filled" onClick={() => setOpen(e)} aria-label={`${PAGE_TITLES[e.pageId]}を開く`}>
                  <Page entry={e} idPrefix={`th${i}`} />
                </button>
              ) : (
                <span className="slot empty" aria-label="まだ白い頁">
                  {i + 1}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {pages.length === 0 && <p>まだ白い頁ばかりです。町で誰かと出会うと、ここに一頁が残ります。</p>}
      <button type="button" onClick={() => setScroll(true)}>
        長巻を画にする
      </button>
      <button type="button" className="primary panel-foot" onClick={onClose}>
        町に戻る
      </button>
    </div>
  );
}
