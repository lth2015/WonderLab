import { useState } from 'react';
import { Icon, JournalArt } from './Art';
import type { Action, GameState } from './game';

const LINES = [
  '阿姊约我在城门里的绸缎铺相见。我头一回来，见驼队往前走，就差点跟了去。你能陪我读读路条吗？',
  '路条上写着：「穿过城门，向城内走，绸缎铺前相见。」该认准哪一样，才不会越走越远？',
  '对，认铺子，不跟着赶路的人走。后面还有一句：「人多莫急，就在铺前檐下等我。」若一时没见着阿姊，我该怎么办？',
  '那我就认准绸缎铺，在檐下等她。回头再望望城门，回去的路也有了准头。原来不必追着人群走呀。',
  '路条我收好了：认准约好的地方，不急着随人群走。你替我记下的这一页，也像一张不会丢的路条。',
];

export function GatePanel({ game, act, onPage, close }: {
  game: GameState; act: (action: Action) => void; onPage: () => void; close: () => void;
}) {
  const [hint, setHint] = useState('');
  const step = game.progress.quests.gate.step;
  const choose = (action: Action, correct: boolean, message: string) => {
    setHint(correct ? '' : message);
    if (correct) act(action);
  };
  return <>
    <p className="section-note">城门 · 阿芦{step < 4 ? ` · 第 ${step + 1} / 4 步` : ' · 已留下画页'}</p>
    <div className="harbor-conversation">
      <img src={`${import.meta.env.BASE_URL}art/china/a-lu-v1.webp`} alt="拿着路条与布包、初次入城的阿芦"/>
      <blockquote>{LINES[step]}</blockquote>
    </div>
    {step > 0 && step < 3 && <aside className="gate-note" aria-label="阿姊留下的路条"><b>阿芦，见字安心</b><p>穿过城门，向城内走，绸缎铺前相见。人多莫急，就在铺前檐下等我。</p><small>阿姊留</small></aside>}
    <div className="harbor-actions">
      {step === 0 && <button className="primary-button" onClick={() => act({ type: 'GATE_TALK' })}>陪阿芦读一读路条<Icon name="arrow" size={18}/></button>}
      {step === 1 && <div className="harbor-choices" role="group" aria-label="认准约好的地方">
        <button onClick={() => choose({ type: 'GATE_LANDMARK', landmark: 'silk' }, true, '')}>认准城门里的绸缎铺</button>
        <button onClick={() => choose({ type: 'GATE_LANDMARK', landmark: 'camels' }, false, '驼队还要远行。阿姊约的是一处铺子，不是移动的人群。')}>跟着驼队一直走</button>
        <button onClick={() => choose({ type: 'GATE_LANDMARK', landmark: 'ferry' }, false, '路条写的是城门里的绸缎铺，并没有约在郊外渡口。')}>去郊外渡口找找</button>
      </div>}
      {step === 2 && <div className="harbor-choices" role="group" aria-label="暂时没见到阿姊怎么办">
        <button onClick={() => choose({ type: 'GATE_WAIT', place: 'eaves' }, true, '')}>在绸缎铺前檐下等候</button>
        <button onClick={() => choose({ type: 'GATE_WAIT', place: 'caravan' }, false, '跟着驼队离开约好的地方，阿姊来了反倒找不到她。')}>先追上驼队再说</button>
        <button onClick={() => choose({ type: 'GATE_WAIT', place: 'wander' }, false, '阿姊已经写下等候的地方。留在约定处，两个人才不会彼此错过。')}>不停换地方找人</button>
      </div>}
      {hint && <p className="harbor-hint" role="status">{hint}</p>}
      {step === 3 && <><JournalArt kind="gate"/><button className="primary-button" onClick={() => act({ type: 'GATE_SKETCH' })}>把这张路条记入画册<Icon name="brush" size={18}/></button></>}
      {step === 4 && <><JournalArt kind="gate"/><button className="primary-button" onClick={onPage}>翻开《认得归路》<Icon name="book" size={18}/></button><button className="secondary-button" onClick={() => { setHint(''); act({ type: 'REPLAY', quest: 'gate' }); }}>重逢 · 再读一回路条</button></>}
      <button className="secondary-button" onClick={close}>先沿河走走</button>
    </div>
    <p className="fine-print">原创虚构小事 · 不增减文钱。中途离开，也能回来接着读。</p>
  </>;
}
