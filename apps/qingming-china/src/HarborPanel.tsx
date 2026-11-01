import { useState } from 'react';
import { Icon, JournalArt } from './Art';
import type { Action, GameState } from './game';

const LINES = [
  '这一肩粮刚上岸，后面的人又到了。劳烦你帮我看看，在哪儿落担，才不挡别人的路？',
  '窄木板是下船的路，仓门也要进出。别着急，看看檐下有没有一处能歇肩的空地。',
  '就是那儿。只是还有只空箩横在路边。我们先挪什么，能给后来的人留出路？',
  '空箩靠了墙，半步路就让出来了。你看，后来的人也能把担子稳稳放下。',
  '留的是半步路，也是一处歇肩的地方。下回再来，檐下总能给你让个坐处。',
];

export function HarborPanel({ game, act, onPage, close }: {
  game: GameState; act: (action: Action) => void; onPage: () => void; close: () => void;
}) {
  const [hint, setHint] = useState('');
  const step = game.progress.quests.harbor.step;
  const choose = (action: Action, correct: boolean, message: string) => {
    if (!correct) { setHint(message); return; }
    setHint(''); act(action);
  };
  return <>
    <p className="section-note">货港 · 杜叔{step < 4 ? ` · 第 ${step + 1} / 4 步` : ' · 已留下画页'}</p>
    <div className="harbor-conversation">
      <img src={`${import.meta.env.BASE_URL}art/china/du-shu-v1.webp`} alt="抱着空箩的货港脚夫杜叔"/>
      <blockquote>{LINES[step]}</blockquote>
    </div>
    {step > 0 && step < 3 && <figure className="harbor-look"><img src={`${import.meta.env.BASE_URL}art/china/scroll/scroll-13.webp`} alt="粮仓檐下、门前通道与下船的窄木板"/><figcaption>看一看：下船与进仓的路，都要留出来。</figcaption></figure>}
    <div className="harbor-actions">
      {step === 0 && <button className="primary-button" onClick={() => act({ type: 'HARBOR_TALK' })}>听杜叔说说<Icon name="arrow" size={18}/></button>}
      {step === 1 && <div className="harbor-choices" role="group" aria-label="找一处落担的地方">
        <button onClick={() => choose({ type: 'HARBOR_PLACE', place: 'eaves' }, true, '')}>仓檐下的空地</button>
        <button onClick={() => choose({ type: 'HARBOR_PLACE', place: 'gangplank' }, false, '木板还要让船上的人走，先留着这条路。')}>下船的窄木板</button>
        <button onClick={() => choose({ type: 'HARBOR_PLACE', place: 'door' }, false, '仓门正中还要进货，放在这里会挡住别人。')}>仓门正中</button>
      </div>}
      {step === 2 && <div className="harbor-choices" role="group" aria-label="给后来的人留一条路">
        <button onClick={() => choose({ type: 'HARBOR_CLEAR', move: 'basket' }, true, '')}>把空箩收在墙边</button>
        <button onClick={() => choose({ type: 'HARBOR_CLEAR', move: 'sacks' }, false, '岸沿临水，粮袋容易受潮，也不宜在那里落担。')}>把粮袋移到岸沿</button>
        <button onClick={() => choose({ type: 'HARBOR_CLEAR', move: 'wait' }, false, '挪开一只轻空箩，就能让大家都歇歇肩。')}>让后来的人等一等</button>
      </div>}
      {hint && <p className="harbor-hint" role="status">{hint}</p>}
      {step === 3 && <><JournalArt kind="harbor"/><button className="primary-button" onClick={() => act({ type: 'HARBOR_SKETCH' })}>把这次相让记入画册<Icon name="brush" size={18}/></button></>}
      {step === 4 && <><JournalArt kind="harbor"/><button className="primary-button" onClick={onPage}>翻开《半步相让》<Icon name="book" size={18}/></button><button className="secondary-button" onClick={() => { setHint(''); act({ type: 'REPLAY', quest: 'harbor' }); }}>重逢 · 再留半步路</button></>}
      <button className="secondary-button" onClick={close}>先沿河走走</button>
    </div>
    <p className="fine-print">原创虚构小事 · 不增减文钱。中途离开，也能回来接着帮忙。</p>
  </>;
}
