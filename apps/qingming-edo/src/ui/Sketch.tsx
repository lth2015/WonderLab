import { useState } from 'react';
import { FRAMINGS, SUBJECTS, TITLE_STYLES, type Framing, type Subject } from '../content/world';
import { PageArt } from '../scene/PageArt';

// 写生 (spec §10): not a drawing test. Pick framing and title slip; the page
// is composed for you. Every choice is equal: no better or worse reward.

export function Sketch({
  subject,
  onDone,
  onCancel,
}: {
  subject: Subject;
  onDone(subject: Subject, framing: Framing, titleStyle: string): void;
  onCancel(): void;
  reduceMotion: boolean;
}) {
  const [framing, setFraming] = useState<Framing>('near');
  const [titleStyle, setTitleStyle] = useState<string>('plain');
  const label = SUBJECTS.find((s) => s.id === subject)!.label;
  return (
    <div className="panel sketch" role="dialog" aria-labelledby="sketch-h">
      <h2 id="sketch-h">写生　{label}</h2>
      <div className="page-preview">
        <PageArt subject={subject} framing={framing} titleStyle={titleStyle} title="風のいたずら" place="日本橋北詰・朝　青葉屋の店先" idPrefix="pv" />
      </div>
      <fieldset>
        <legend>どこまで描くか</legend>
        <div className="seg">
          {FRAMINGS.map((f) => (
            <button type="button" key={f.id} aria-pressed={framing === f.id} onClick={() => setFraming(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>題箋</legend>
        <div className="seg">
          {TITLE_STYLES.map((t) => (
            <button type="button" key={t.id} aria-pressed={titleStyle === t.id} onClick={() => setTitleStyle(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>
      <button type="button" className="primary" onClick={() => onDone(subject, framing, titleStyle)}>
        この頁にする
      </button>
      <button type="button" className="ghost" onClick={onCancel}>
        町に戻る（あとで描く）
      </button>
    </div>
  );
}
