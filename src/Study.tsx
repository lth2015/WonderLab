import { useEffect, useRef, useState } from 'react';
import { BUILD } from './build';
import { deleteStudyRecords, handOverStudy, studySummary } from './lib/study-export';

// The tester's own view of what this device kept for the study
// (docs/验证路线图.md §4), opened from the link in the written test
// instructions (?study). Nothing leaves the device unless the tester picks
// where it goes; they can also delete it all.

export function StudySheet({ onClose }: { onClose: () => void }) {
  const [summary, setSummary] = useState(studySummary);
  const [participant, setParticipant] = useState('');
  const [status, setStatus] = useState('');
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const doExport = async () => {
    const how = await handOverStudy(participant);
    setStatus(how === 'cancelled' ? '没有导出' : '已导出。请按测试说明把文件发给研究人员。');
  };
  const doDelete = () => {
    if (!window.confirm('删除这台设备上的测试记录？你的世界不受影响。')) return;
    deleteStudyRecords();
    setSummary(studySummary());
    setStatus('测试记录已删除');
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet study" role="dialog" aria-modal="true" aria-labelledby="study-title">
        <h2 id="study-title">你的测试记录</h2>
        <p className="note">
          这台设备记录了你使用 Wonderful World 的时间和次数：什么时候打开、停留多久、做了几次创造、收下了几条鱼。
          <strong>没有你画的内容，没有你写的字，没有你的名字，也没有任何链接。</strong>
          记录只在这台设备上，你选择导出之前，不会发给任何人。
        </p>
        <p className="note" role="status">
          打开 {summary.visits} 次 · 创造 {summary.creations} 次 · 收下的鱼 {summary.giftsTaken} 条 · 事件 {summary.events} 条
        </p>
        {summary.builds > 1 && <p className="note">这些记录来自 {summary.builds} 个版本（测试期间网站更新过），导出时每条记录都会标明来自哪个版本。</p>}
        <label>
          参与者编号（测试说明里给你的，例如 P01；可不填）
          <input value={participant} maxLength={12} autoComplete="off" onChange={(e) => setParticipant(e.target.value)} />
        </label>
        <div className="stack">
          <button ref={first} type="button" className="text-btn primary" onClick={() => void doExport()}>
            导出并发给研究人员
          </button>
          <button type="button" className="text-btn" onClick={doDelete}>
            删除这些记录
          </button>
          <button type="button" className="link-btn" onClick={onClose}>
            不导出，关闭
          </button>
        </div>
        {status && (
          <p className="note" role="status">
            {status}
          </p>
        )}
        <p className="note study-build">
          当前版本 {BUILD.experiment} · {BUILD.sha}
        </p>
      </div>
    </>
  );
}
