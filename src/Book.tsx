import { useEffect, useRef, useState } from 'react';
import { SCENES, SEASONS, sceneUrl, type Scene } from './scenes';

// 四时册页: every scene in the world, by the seasons, each a page with its
// line. Touch a page to walk into it; 链接 copies its address (want.world/柳)
// to send to someone. The small pictures are washes of the scene's hour
// until Codex's paintings come (collab docs/handoff/codex-entrance.md).

export function Book({ onClose, onEnter }: { onClose: () => void; onEnter: (scene: Scene) => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = (scene: Scene) => {
    const url = sceneUrl(scene, location.origin);
    void navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(scene.id);
        window.setTimeout(() => setCopied((c) => (c === scene.id ? null : c)), 2000);
      },
      () => {},
    );
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet book" role="dialog" aria-modal="true" aria-labelledby="book-title">
        <h2 id="book-title">四时</h2>
        <p className="motto">这个世界里的每一处景</p>
        <div className="book-pages">
          {SEASONS.map((season) => (
            <section key={season} aria-label={season}>
              <h3>{season}</h3>
              <ul>
                {SCENES.filter((s) => s.season === season).map((scene) => (
                  <li key={scene.id}>
                    <button type="button" className={`page ${scene.time ?? 'any'}`} onClick={() => onEnter(scene)} aria-label={`${scene.name}：${scene.line}`}>
                      <span className="name">{scene.name}</span>
                      <span className="line">{scene.line}</span>
                    </button>
                    <button type="button" className="link" onClick={() => copy(scene)} aria-label={`复制「${scene.name}」的链接`}>
                      {copied === scene.id ? '已复制' : '链接'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <button ref={closeBtn} type="button" className="text-btn" onClick={onClose}>
          回到湖边
        </button>
      </div>
    </>
  );
}
