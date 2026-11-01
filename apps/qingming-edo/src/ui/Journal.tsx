import { useEffect, useRef, useState } from 'react';
import type { JournalEntry, SaveData } from '../contract';
import { PAGE_SLOTS, PAGE_TITLES, parseKaze, parseSketch, questOfPage, validJournalEntry } from '../content/world';
import { TIMES } from '../engine/time';
import { study } from '../engine/study';
import { replayable } from '../engine/story';
import { PageArt, pageToPng } from '../scene/PageArt';
import { PaintedPageScene } from '../scene/painted';

// 絵巻帳 (spec §6, §10, §18): only what actually happened. A page, once made,
// stays even if the save dialog is closed. Saving the clear image is free.

const COMMENT: Record<string, string> = {
  hands: '手は嘘をつかん。紙を揃える指に、あの男の朝が出ている。',
  shopfront: '店先は町の顔だ。紙が静まった今の店を、よく留めた。',
  street: '人は止まらん。その流れの中で、紙は一枚も飛ばなかった。それでいい。',
};
const PLACE: Record<string, string> = {
  'p01-kaze': '日本橋北詰・朝　青葉屋の店先',
  'p01-kaze-b': '日本橋北詰・朝　青葉屋の店先',
  'dougu-deliver': '日本橋・朝　米屋の前',
  'dougu-entrust': '日本橋・朝　くれ竹の店先',
  'tenugui-return': '日本橋・朝　茶店「喜の字」の前',
};
/** 宗吉's word on a page, by its composition (or, for 一頁目, its subject). */
const COMMENT_BY_COMPOSITION: Record<string, string> = {
  'dougu-deliver': '渡した手と、受け取った手。その間にあるものが描けている。',
  'dougu-entrust': '届けた者は描かれていない。だが、託した人の思いは残っている。',
  'tenugui-return': '探していたのは布ではなかったな。布にしみた、人の朝だ。',
};

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

function Page({ entry, idPrefix }: { entry: JournalEntry; idPrefix: string }) {
  const k = parseKaze(entry.compositionId);
  const common = { titleStyle: entry.titleStyle, title: PAGE_TITLES[entry.pageId], credit: CREDIT, idPrefix };
  if (k) return <PageArt scene={<PaintedPageScene composition={entry.compositionId} />} place={PLACE[entry.pageId]} {...common} />;
  const sk = parseSketch(entry.compositionId);
  const place = sk ? `日本橋・${TIMES.find((t) => t.id === sk.tod)!.label}　${sk.sketch.place}` : PLACE[entry.compositionId];
  return <PageArt scene={<PaintedPageScene composition={entry.compositionId} />} place={place} {...common} />;
}

const RECALL_NOTE: Record<string, string> = {
  kaze: '別のものを描けば、もう一枚の頁が残ります。',
  dougu: 'もう一つの届け方を選べば、別の朝の頁が残ります。',
  tenugui: 'あの朝のことを、もう一度たどります。',
};

export function Journal({ save, onClose, onToast, onRecall }: { save: SaveData; onClose(): void; onToast(t: string): void; onRecall(quest: string): void }) {
  const [open, setOpen] = useState<JournalEntry | null>(null);
  const big = useRef<HTMLDivElement>(null);
  // a page this version cannot draw is left out rather than breaking the book (review F01)
  const pages = save.journal.pages.filter((p) => validJournalEntry(p.pageId, p.compositionId));

  // The page image is made as soon as a page is opened, so the share sheet can be
  // opened straight from the tap (iOS drops the gesture during a slow await).
  const [png, setPng] = useState<{ pageId: string; blob: Blob } | null>(null);
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
        if (alive) setPng({ pageId: open.pageId, blob });
      } catch {
        if (alive) setPngFailed(true);
      }
    }, 50);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open]);
  const ready = png && open && png.pageId === open.pageId ? png.blob : null;
  const fileName = open ? `nihonbashi-hitopage-${open.pageId}.png` : '';

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
    const data: ShareData = { title: '日本橋、ひと頁', text: `「${PAGE_TITLES[open.pageId]}」 — ${CREDIT}`, url: workLink() };
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
      <div className="panel" role="dialog" aria-labelledby="page-h">
        <h2 id="page-h">{PAGE_TITLES[open.pageId]}</h2>
        <div className="page-big" ref={big}>
          <Page entry={open} idPrefix="big" />
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
        <button type="button" className="ghost" onClick={() => setOpen(null)}>
          絵巻帳に戻る
        </button>
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
      <button type="button" className="primary" onClick={onClose}>
        町に戻る
      </button>
    </div>
  );
}
