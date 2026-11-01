import { useState } from 'react';
import { Icon, JournalArt } from './Art';
import type { Action, GameState } from './game';

const LINES = [
  '田边那位老邻居正收锄，今儿也要搭这一程。隔着水，我怕他听不清。劳你帮我招呼一声，叫他不用急。',
  '他抬头望过来了。我们怎么应他，才让他知道这程船还在等？',
  '他也抬手应了，正往渡口来。等他到岸边，我们先做哪件事？',
  '船靠稳了，人也坐定了。前年我伤了脚，是他替我照看菜畦。轮到我撑船，多等片刻，算不得什么。',
  '河每天都要过，邻里也每天都要照应。这一程不催，明日还在这里碰面。',
];
export function CountrysidePanel({ game, act, onPage, close }: {
  game: GameState; act: (action: Action) => void; onPage: () => void; close: () => void;
}) {
  const [hint, setHint] = useState('');
  const step = game.progress.quests.countryside.step;
  const choose = (action: Action, correct: boolean, message: string) => {
    setHint(correct ? '' : message);
    if (correct) act(action);
  };
  return <>
    <p className="section-note">乡野渡口 · 田伯{step < 4 ? ` · 第 ${step + 1} / 4 步` : ' · 已留下画页'}</p>
    <div className="harbor-conversation countryside-conversation">
      <img src={`${import.meta.env.BASE_URL}art/china/tian-bo-v1.webp`} alt="戴草帽、持木桨招呼邻居的渡船人田伯"/>
      <blockquote>{LINES[step]}</blockquote>
    </div>
    {step > 0 && step < 3 && <figure className="harbor-look"><img src={`${import.meta.env.BASE_URL}art/china/scroll/scroll-18.webp`} alt="田边劳作的农人与河上的渡船"/><figcaption>隔着一段水，也可以先打一声招呼。</figcaption></figure>}
    <div className="harbor-actions">
      {step === 0 && <button className="primary-button" onClick={() => act({ type: 'COUNTRYSIDE_TALK' })}>听田伯说说这一程<Icon name="arrow" size={18}/></button>}
      {step === 1 && <div className="harbor-choices" role="group" aria-label="回应田边的邻居">
        <button onClick={() => choose({ type: 'COUNTRYSIDE_SIGNAL', signal: 'wave' }, true, '')}>挥手回应，示意慢慢来</button>
        <button onClick={() => choose({ type: 'COUNTRYSIDE_SIGNAL', signal: 'rush' }, false, '他还要把锄头收妥。一声回应就够了，不必催他跑来。')}>催他放下锄头就跑</button>
        <button onClick={() => choose({ type: 'COUNTRYSIDE_SIGNAL', signal: 'leave' }, false, '先应一声，他才知道这程船还在等，不会白赶到渡口。')}>没应声就先把船划走</button>
      </div>}
      {step === 2 && <div className="harbor-choices" role="group" aria-label="迎邻居上船">
        <button onClick={() => choose({ type: 'COUNTRYSIDE_BOARD', plan: 'steady' }, true, '')}>稳好船，再迎他上船</button>
        <button onClick={() => choose({ type: 'COUNTRYSIDE_BOARD', plan: 'jump' }, false, '不急着跨这一步。田伯先把船稳好，人才能从容坐下。')}>船还晃着就招他跨过来</button>
        <button onClick={() => choose({ type: 'COUNTRYSIDE_BOARD', plan: 'midriver' }, false, '他正往渡口来，船也该靠稳在渡口，相互照应着才好上船。')}>先把船划到河心等</button>
      </div>}
      {hint && <p className="harbor-hint" role="status">{hint}</p>}
      {step === 3 && <><JournalArt kind="ferry"/><button className="primary-button" onClick={() => act({ type: 'COUNTRYSIDE_SKETCH' })}>把这一程记入画册<Icon name="brush" size={18}/></button></>}
      {step === 4 && <><JournalArt kind="ferry"/><button className="primary-button" onClick={onPage}>翻开《这一程，不催》<Icon name="book" size={18}/></button><button className="secondary-button" onClick={() => { setHint(''); act({ type: 'REPLAY', quest: 'countryside' }); }}>重逢 · 再向邻居应一声</button></>}
      <button className="secondary-button" onClick={close}>先沿河走走</button>
    </div>
    <p className="fine-print">原创虚构小事 · 不增减文钱。中途离开，也能回来接着相遇。</p>
  </>;
}
