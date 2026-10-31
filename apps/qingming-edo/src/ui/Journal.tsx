import { useRef, useState } from 'react';
import type { JournalEntry, SaveData } from '../contract';
import { PAGE_SLOTS, PAGE_TITLES, parseKaze } from '../content/world';
import { PageArt, pageToPng } from '../scene/PageArt';

// 絵巻帳 (spec §6, §10, §18): only what actually happened. A page, once made,
// stays even if the save dialog is closed. Saving the clear image is free.

const COMMENT: Record<string, string> = {
  hands: '手は嘘をつかん。紙を揃える指に、あの男の朝が出ている。',
  shopfront: '店先は町の顔だ。紙が静まった今の店を、よく留めた。',
  street: '人は止まらん。その流れの中で、紙は一枚も飛ばなかった。それでいい。',
};
const PLACE: Record<string, string> = { 'p01-kaze': '日本橋北詰・朝　青葉屋の店先' };
const CREDIT = '清明上河図：江戸編';

function Page({ entry, idPrefix }: { entry: JournalEntry; idPrefix: string }) {
  const k = parseKaze(entry.compositionId);
  if (!k) return null;
  return <PageArt subject={k.subject} framing={k.framing} titleStyle={entry.titleStyle} title={PAGE_TITLES[entry.pageId]} place={PLACE[entry.pageId]} credit={CREDIT} idPrefix={idPrefix} />;
}

export function Journal({ save, onClose, onToast }: { save: SaveData; onClose(): void; onToast(t: string): void }) {
  const [open, setOpen] = useState<JournalEntry | null>(null);
  const big = useRef<HTMLDivElement>(null);
  const pages = save.journal.pages;

  const download = async () => {
    const svg = big.current?.querySelector('svg');
    if (!svg) return;
    try {
      const blob = await pageToPng(svg);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nihonbashi-hitopage-${open!.pageId}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      onToast('画像を保存しました。');
    } catch {
      onToast('画像を作れませんでした。もう一度お試しください。頁は絵巻帳に残っています。');
    }
  };

  const copyLink = async () => {
    // Only the work's own address: no balance, reward or save in the link (spec §18).
    const url = new URL(import.meta.env.BASE_URL, location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      onToast('作品へのリンクをコピーしました。');
    } catch {
      onToast(url);
    }
  };

  if (open) {
    const k = parseKaze(open.compositionId);
    return (
      <div className="panel" role="dialog" aria-labelledby="page-h">
        <h2 id="page-h">{PAGE_TITLES[open.pageId]}</h2>
        <div className="page-big" ref={big}>
          <Page entry={open} idPrefix="big" />
        </div>
        {k && (
          <p className="comment">
            <span className="who">宗吉</span>「{COMMENT[k.subject]}」
          </p>
        )}
        <div className="row">
          <button type="button" className="primary" onClick={download}>
            画像を保存
          </button>
          <button type="button" onClick={copyLink}>
            作品のリンクをコピー
          </button>
        </div>
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
        {pages.length} / {PAGE_SLOTS} 頁
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
