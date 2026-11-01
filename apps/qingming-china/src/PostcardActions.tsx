import { useEffect, useState } from 'react';
import type { PageId } from './content';
import type { GameState } from './game';
import { createPostcard, downloadFile } from './export';
import { publicJournalLink } from './links';
import { study } from './study';

export function PostcardActions({ game, id, art, back }: { game: GameState; id: PageId; art: () => SVGSVGElement | null; back: () => void }) {
  const [image, setImage] = useState<Awaited<ReturnType<typeof createPostcard>> | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const [manualLink, setManualLink] = useState(false);
  const [sharing, setSharing] = useState(false);
  const url = publicJournalLink(id);
  useEffect(() => {
    let active = true;
    setImage(null); setError('');
    void createPostcard(game, id, art()).then(value => { if (active) setImage(value); }, () => {
      if (active) setError('画页暂未生成。原记录仍在画册中，可以重试或先复制作品链接。');
    });
    return () => { active = false; };
    // Each mounted page owns one prepared image; a retry never changes the save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, retry]);

  const save = () => {
    study.emit('journal_export_attempted', { page_id: id, export_type: 'png' });
    if (!image) return;
    try {
      downloadFile(image.blob, image.name);
      study.emit('journal_export_completed', { page_id: id, export_type: 'png', stage: 'download_requested' });
      setMessage('图片已生成并请求下载；请在浏览器下载中查看。未保存时可再试一次。');
    } catch { setMessage('未能请求下载，画页记录仍保留。请重试或复制作品链接。'); }
  };
  const copy = async () => {
    study.emit('share_attempted', { page_id: id, method: 'link' });
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      study.emit('share_result', { method: 'link', result: 'copied' });
      setMessage('作品链接已复制。对方无需注册，可直接走进这段画卷。');
    } catch {
      setManualLink(true);
      study.emit('share_result', { method: 'link', result: 'unavailable' });
      setMessage('浏览器未允许复制。可长按下方链接手动复制，或保存图片。');
    }
  };
  const share = async () => {
    if (!image || sharing) return;
    study.emit('share_attempted', { page_id: id, method: 'system' });
    const file = new File([image.blob], image.name, { type: 'image/png' });
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      study.emit('share_result', { method: 'system', result: 'unavailable' });
      setMessage('系统图片分享不可用。可以保存清晰图片，或复制作品链接。');
      return;
    }
    setSharing(true);
    try {
      // The image is ready before the gesture, preserving mobile user activation.
      await navigator.share({ files: [file], title: '汴河拾光 · 画中相遇', url });
      study.emit('share_result', { method: 'system', result: 'invoked' });
      setMessage('已交由系统处理分享。');
    } catch (e) {
      const cancelled = e instanceof DOMException && e.name === 'AbortError';
      study.emit('share_result', { method: 'system', result: cancelled ? 'cancelled' : 'failed' });
      setMessage(cancelled ? '已取消分享，画页仍在。' : '分享未完成。可以保存图片或复制作品链接。');
    } finally { setSharing(false); }
  };
  return <div className="postcard-delivery">
    {!image && !error && <p role="status">正在装裱画页……</p>}
    {error && <><p role="status">{error}</p><button className="primary-button" onClick={() => setRetry(n => n + 1)}>重新生成画页</button></>}
    <div className="button-row">
      <button className="primary-button" disabled={!image} onClick={save}>保存清晰留念图</button>
      <button className="secondary-button" disabled={!image || sharing} onClick={() => void share()}>分享画页</button>
      <button className="secondary-button" onClick={() => void copy()}>复制作品链接</button>
      <button className="secondary-button" onClick={back}>回到画册</button>
    </div>
    {message && <p role="status">{message}</p>}
    {manualLink && <label className="manual-link">作品链接<input readOnly value={url} onFocus={e => e.currentTarget.select()} /></label>}
  </div>;
}
