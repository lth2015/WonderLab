import { useEffect, useState } from 'react';
import { splitGlossed, type GlossEntry } from '../content/glossary';

/** A line of text whose hard words can be pressed for a short note (spec §8). */
export function Glossed({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState<GlossEntry | null>(null);
  useEffect(() => setOpen(null), [text]); // a new line closes the note
  const parts = splitGlossed(text);
  return (
    <>
      <p className={className}>
        {parts.map((p, i) =>
          typeof p === 'string' ? (
            p
          ) : (
            <button
              type="button"
              key={i}
              className="term"
              aria-expanded={open?.term === p.term}
              aria-label={`${p.term}（${p.reading}）の説明`}
              onClick={(e) => {
                e.stopPropagation();
                setOpen((o) => (o?.term === p.term ? null : p));
              }}
            >
              {p.term}
            </button>
          ),
        )}
      </p>
      {open && (
        <p className="term-note" role="note">
          <b>
            {open.term}
            <small>（{open.reading}）</small>
          </b>
          {open.note}
        </p>
      )}
    </>
  );
}
