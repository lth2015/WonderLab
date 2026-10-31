import { useRef, useState } from 'react';
import type { SaveData, Settings as S } from '../contract';
import { exportText, importText } from '../engine/save';
import { newSave } from '../engine/state';

// 設定 (spec §7, §16): motion, text size, keeping one's own save file, and a
// quiet way back to the other worlds.
const HUB_URL = (import.meta.env.VITE_EDO_HUB_URL as string | undefined) ?? 'https://want.world/';

export function Settings({
  save,
  onChange,
  onReplace,
  onClose,
  onToast,
}: {
  save: SaveData;
  onChange(s: SaveData): void;
  onReplace(s: SaveData): void;
  onClose(): void;
  onToast(t: string): void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (patch: Partial<S>) => onChange({ ...save, settings: { ...save.settings, ...patch }, updatedAt: new Date().toISOString() });

  const exportSave = () => {
    const url = URL.createObjectURL(new Blob([exportText(save)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qingming-edo-kiroku.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const importSave = async (f: File) => {
    const r = importText(await f.text());
    if (r.ok) {
      onReplace(r.save);
      onToast('記録を読み込みました。');
    } else {
      // The current record is kept as it was (spec §16).
      onToast(r.reason === 'newer' ? '新しい版の記録なので読み込めません。今の記録はそのままです。' : 'この作品の記録として読めませんでした。今の記録はそのままです。');
    }
  };

  return (
    <div className="panel" role="dialog" aria-labelledby="settings-h">
      <h2 id="settings-h">設定</h2>
      <label className="check">
        <input type="checkbox" checked={save.settings.reduceMotion} onChange={(e) => set({ reduceMotion: e.target.checked })} />
        動きを減らす
      </label>
      <fieldset>
        <legend>文字の大きさ</legend>
        <div className="seg">
          {([1, 1.25, 1.5] as const).map((v) => (
            <button type="button" key={v} aria-pressed={save.settings.textScale === v} onClick={() => set({ textScale: v })}>
              {v === 1 ? '標準' : v === 1.25 ? '大きく' : 'もっと大きく'}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="small">音はまだありません。音がなくても、すべて遊べます。</p>

      <h3>記録</h3>
      <p className="small">記録はこの端末のブラウザーにだけ保存されます。別の端末や別のアドレスへは自動では移りません。</p>
      <div className="row">
        <button type="button" onClick={exportSave}>
          記録を書き出す
        </button>
        <button type="button" onClick={() => file.current?.click()}>
          記録を読み込む
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importSave(f);
          e.target.value = '';
        }}
      />
      {confirmReset ? (
        <div className="row">
          <button
            type="button"
            className="danger"
            onClick={() => {
              onReplace(newSave());
              setConfirmReset(false);
              onToast('最初からになりました。');
            }}
          >
            本当に最初から
          </button>
          <button type="button" onClick={() => setConfirmReset(false)}>
            やめる
          </button>
        </div>
      ) : (
        <button type="button" className="ghost" onClick={() => setConfirmReset(true)}>
          最初からやり直す
        </button>
      )}

      <h3>この作品について</h3>
      <p className="small">
        『熈代勝覧』（文化二年・1805年頃の日本橋の通りを描いた絵巻）に着想を得た創作です。原画の町並みを再現した地図ではありません。人物・店・出来事はすべて創作です。絵は制作途中の仮のものです。
      </p>
      <a className="ghost link" href={HUB_URL}>
        ほかの世界へ
      </a>
      <button type="button" className="primary" onClick={onClose}>
        町に戻る
      </button>
    </div>
  );
}
