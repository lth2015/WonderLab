import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CHARACTERS, ENVIRONMENT, PAGES, type CharacterId, type PageId } from './content';
import { initialState, parseSave, readSave, reduceGame, summaryEvents, SAVE_KEY, type Action, type GameState, type QuestId } from './game';
import { Icon, JournalArt } from './Art';
import { ScrollView } from './ScrollView';
import { PaintedPerson } from './PaintedArt';
import { CHAPTERS, SCENE_CENTER, personPosition, personPose, sceneAt, type SceneId } from './layout';
import { RiverAudio } from './audio';
import { downloadFile, exportPostcard } from './export';
import type { SceneTarget } from './hit-targets';

type Modal = { kind: 'character'; id: CharacterId } | { kind: 'page'; id: PageId } | { kind: 'targets'; targets: SceneTarget[] } | { kind: 'album' | 'bag' | 'nearby' | 'settings' | 'rope' | 'tea' | 'summary' | 'about' | 'reset' } | null;
const QUEST_NAMES: Record<QuestId,string>={paper:'一纸春风',boat:'这一船日常',purse:'谁的香囊'};

function Sheet({ title, eyebrow, children, close, wide=false, notification, dismiss }: { title: string; eyebrow?: string; children: ReactNode; close: ()=>void; wide?: boolean; notification?:string; dismiss?:()=>void }) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();return ()=>{dialog.close();};},[]);
  return <dialog ref={ref} className={`sheet ${wide?'wide':''}`} aria-labelledby="sheet-title" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}}>
    <div className="sheet-head"><div><span className="eyebrow">{eyebrow??'汴河拾光'}</span><h2 id="sheet-title">{title}</h2></div><button className="round-button" onClick={close} aria-label="返回街上"><Icon name="close"/></button></div>
    {notification&&<div className="dialog-notice" role="status"><Icon name="leaf" size={18}/><span>{notification}</span><button onClick={dismiss} aria-label="收起消息"><Icon name="close" size={16}/></button></div>}
    <div className="sheet-content">{children}</div>
  </dialog>;
}
function ActionButton({ children, onClick, secondary=false, disabled=false }: { children: ReactNode; onClick: ()=>void; secondary?: boolean; disabled?: boolean }) {
  return <button className={secondary?'secondary-button':'primary-button'} onClick={onClick} disabled={disabled}>{children}{!secondary&&<Icon name="arrow" size={18}/>}</button>;
}

export function App() {
  const [loaded]=useState(readSave);
  const [game,setGame]=useState<GameState>(()=>({...loaded.state,settings:{...loaded.state.settings,sound:false}}));
  const [saveBlocked,setSaveBlocked]=useState(!!loaded.damaged);
  const [modal,setModal]=useState<Modal>(null);
  const [center,setCenter]=useState(SCENE_CENTER.paper);
  const [toast,setToast]=useState(loaded.error??'');
  const [feedback,setFeedback]=useState('');
  const [hint,setHint]=useState(false);
  const [hidden,setHidden]=useState(document.hidden);
  const [systemReduced,setSystemReduced]=useState(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [sketch,setSketch]=useState<'hands'|'boats'|'bridge'>('hands');
  const [closeView,setCloseView]=useState(false);
  const [decoration,setDecoration]=useState('春日小记');
  const [exporting,setExporting]=useState(false);
  const audio=useRef<RiverAudio>();
  const importRef=useRef<HTMLInputElement>(null);
  const pageArt=useRef<HTMLDivElement>(null);
  const lastFocus=useRef<HTMLElement|null>(null);
  useEffect(()=>{audio.current=new RiverAudio();return()=>audio.current?.dispose();},[]);
  useEffect(()=>{
    const query=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setSystemReduced(query.matches);query.addEventListener('change',change);
    const vis=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',vis);
    return()=>{query.removeEventListener('change',change);document.removeEventListener('visibilitychange',vis);};
  },[]);
  useEffect(()=>{
    if(saveBlocked)return;
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(game));}catch{setToast('浏览器未能保存进度。可在设置中导出存档，留待下次继续。');}
  },[game,saveBlocked]);
  useEffect(()=>{document.documentElement.classList.toggle('large-text',game.settings.largeText);},[game.settings.largeText]);
  useEffect(()=>{if(hidden)audio.current?.pause();else void audio.current?.configure(game.settings.sound,game.settings.ambience,game.settings.effects).catch(()=>setToast('声音暂时未能开启，可以静音继续游玩。'));},[hidden,game.settings.sound,game.settings.ambience,game.settings.effects]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),5500);return()=>clearTimeout(t);},[toast]);
  useEffect(()=>{if(!feedback)return;const t=setTimeout(()=>setFeedback(''),3500);return()=>clearTimeout(t);},[feedback]);
  useEffect(()=>{
    if(!game.started||!game.settings.hints||modal||hidden||game.progress.visited.length)return;
    const t=setTimeout(()=>setHint(true),8000);return()=>clearTimeout(t);
  },[game.started,game.settings.hints,game.progress.visited.length,modal,hidden]);
  useEffect(()=>{const requested=new URLSearchParams(location.search).get('scene');if(requested){if(Object.hasOwn(SCENE_CENTER,requested))setCenter(SCENE_CENTER[requested as SceneId]);else setToast('这段画卷尚未收录，已回到虹桥两岸。');}},[]);
  const act=(action:Action)=>setGame(prev=>reduceGame(prev,action));
  const open=(m:Modal)=>{if(!modal)lastFocus.current=document.activeElement as HTMLElement;setModal(m);setHint(false);};
  const close=()=>{setModal(null);requestAnimationFrame(()=>lastFocus.current?.focus({preventScroll:true}));};
  const person=(id:CharacterId)=>{act({type:'VISIT',id});open({kind:'character',id});};
  const focusPerson=(id:CharacterId)=>{setCenter(personPosition(id,game).x);person(id);};
  const notice=(text:string)=>{setToast(text);audio.current?.ring();};
  const environment=(id:string)=>{const env=ENVIRONMENT.find(e=>e.id===id)!;setFeedback(id);act({type:'OBSERVE',id,...('page'in env?{page:env.page}:{})});notice(env.text);};
  const replay=(quest:QuestId)=>{act({type:'REPLAY',quest});notice('可以重新体验，补记另一个视角。已领过的文钱不会重复发放。');};
  const claim=(action:Action,text:string)=>{act(action);notice(text);};
  const time=game.claimed.length>=3?'暮':game.claimed.length>=1?'昼':'晨';
  const scene=sceneAt(center);
  const damaged=saveBlocked&&loaded.damaged;
  const subtitle=modal?.kind==='character'?CHARACTERS[modal.id].role:modal?.kind==='page'?PAGES.find(p=>p.id===modal.id)?.subtitle:undefined;
  const titles:Record<string,string>={album:'我的拾光画册',bag:'随身行囊',nearby:'这一带的相遇',settings:'随心入画',rope:'把绳索理一理',tea:'为客人配一席茶',summary:'今日，记下了什么',about:'关于这卷人间',targets:'\u60f3\u770b\u770b\u54ea\u4e00\u5904',reset:'重新走进画中'};
  const title=modal?.kind==='character'?CHARACTERS[modal.id].name:modal?.kind==='page'?PAGES.find(p=>p.id===modal.id)?.title??'画页':modal?titles[modal.kind]:'';

  function characterPanel(id:CharacterId) {
    const c=CHARACTERS[id],q=game.progress.quests;
    let line:string=c.line;
    if(id==='liu')line=q.paper.step===1?'好了，纸角服帖了！这页纸借你。想留下手边的忙碌，还是河上的风景？':q.paper.step===2?'你瞧，画纸上也有了今日的春风。以后再来看我，咱们再选一个角度。':c.line;
    if(id==='zhou')line=q.boat.step===1?'绳索妥当了。再瞧瞧货签，何娘要的是哪一担？':q.boat.step===2?'正是这担新茶。阿成来接了，你要随他去，还是在这里看船靠稳？':q.boat.step===3?'船稳了，货也上岸了。多亏这一双双手，才有这条河上的日常。':c.line;
    if(id==='cheng')line=q.boat.step===3?(game.progress.route==='deliver'?'送到了！你看，何娘已把新茶摆在炉边。辛苦这一趟，来歇歇。':'周伯稳船，我接货，你认货签。一船小事，谁也少不得。') :q.boat.step===2?'货签认准了，我这就起担。你愿意陪我沿河走到何娘的茶摊吗？':c.line;
    if(id==='he')line=game.progress.tea?'两位都喝上合口的茶了。待客呀，记着人家的一点偏好就够。':game.progress.route==='deliver'?'你和阿成送来的新茶，已经煮上啦。来，帮我照应这两位客人？':c.line;
    if(id==='chen')line=q.purse.step===4?'香囊找回来了。阿姊说，走得再远，也有个盼我平安的人。这回可要收好了。':q.purse.step>=1?'是浅色的香囊。阿姊绣了两枝并生的柳，内里还有一个「安」字。你若见着，还请告诉我。':c.line;
    if(id==='shen'&&game.progress.favorite)line=`你选的《${PAGES.find(p=>p.id===game.progress.favorite)?.title}》，我看过了。你肯停下来，记住一个人，这一页便没有白画。`;
    return <>
      <div className="conversation"><div className="portrait" style={{'--portrait-color':c.color} as React.CSSProperties}><svg viewBox="-65 -156 130 168" aria-hidden="true"><PaintedPerson id={id} height={140} pose={personPose(id,game)} shadow={false}/></svg><span>{c.role}</span></div><blockquote>{line}</blockquote></div>
      <div className="dialogue-actions">
        {id==='liu'&&<>
          {q.paper.step===0&&<ActionButton onClick={()=>claim({type:'PRESS_PAPER'},'纸角压住了，小柳腾出手铺平了素纸。')}>替他压住画纸</ActionButton>}
          {q.paper.step===1&&<><p className="section-note">选一个你想记住的细节</p><div className="sketch-options">{([['hands','小贩的手'],['boats','河上的船'],['bridge','桥上的人']] as const).map(([v,label])=><button key={v} className={`sketch-option ${sketch===v?'selected':''}`} aria-pressed={sketch===v} onClick={()=>setSketch(v)}><JournalArt kind={v==='boats'?'boat':v}/><span>{label}</span></button>)}</div><div className="sketch-settings"><button className="text-button" onClick={()=>setCloseView(!closeView)}>{closeView?'近景':'全景'} · 切换构图</button><label>题签<select value={decoration} onChange={e=>setDecoration(e.target.value)}><option>春日小记</option><option>河上清风</option><option>人间烟火</option></select></label></div><div className={`sketch-preview ${closeView?'close-view':''}`}><JournalArt kind={sketch==='boats'?'boat':sketch}/><span>{decoration}</span></div><ActionButton onClick={()=>{claim({type:'SKETCH',view:sketch,close:closeView,decoration},game.claimed.includes('paper')?'新的构图已记入画册。':'一纸春风 · 留下一页画，获赠 12 文。');}}>落笔，记下此景</ActionButton></>}
          {q.paper.step===2&&<><ActionButton onClick={()=>open({kind:'page',id:(game.journal.filter(p=>p.startsWith('paper-')).at(-1)??'paper-hands') as PageId})}>看看刚留下的画</ActionButton><ActionButton secondary onClick={()=>replay('paper')}>再换一个视角</ActionButton></>}
        </>}
        {id==='zhou'&&<>
          {q.boat.step<2&&<ActionButton onClick={()=>open({kind:'rope'})}>{q.boat.step===0?'帮周伯理好绳索':'辨认茶叶货签'}</ActionButton>}
          {q.boat.step===2&&<BoatRoutes game={game} act={action=>{act(action);notice('这一船日常 · 记下一次协作。'+(game.claimed.includes('boat')?'':'获赠 24 文。'));if(action.type==='BOAT_END'&&action.route==='deliver')setCenter(SCENE_CENTER.tea);}}/>}
          {q.boat.step===3&&<><ActionButton onClick={()=>{close();setCenter(game.progress.route==='deliver'?SCENE_CENTER.tea:SCENE_CENTER.bridge);}}>去看看靠岸后的街景</ActionButton><ActionButton secondary onClick={()=>replay('boat')}>重逢 · 记下另一条路</ActionButton></>}
        </>}
        {id==='cheng'&&<>
          {q.boat.step===2?<BoatRoutes game={game} act={a=>{act(a);notice('新茶有人接了，故事已记入画册。');if(a.type==='BOAT_END'&&a.route==='deliver')setCenter(SCENE_CENTER.tea);}}/>:<ActionButton onClick={()=>focusPerson(q.boat.step===3?'he':'zhou')}>{q.boat.step===3?'去茶摊看看':'去岸边找周伯'}</ActionButton>}
          {q.purse.step>=2&&q.purse.step<4&&<ActionButton secondary onClick={()=>claim({type:'ASK',who:'cheng'},'阿成：那位陈生方才问我，有没有见过绣着并枝柳的香囊。他说内衬缝着「安」。')}>{game.progress.clues.includes('cheng')?'再听阿成说说线索':'问问香囊的线索'}</ActionButton>}
          {q.purse.step===3&&<ActionButton onClick={()=>focusPerson('chen')}>线索相合了，去找陈生</ActionButton>}
        </>}
        {id==='he'&&<>
          <ActionButton onClick={()=>open({kind:'tea'})}>{game.progress.tea?'再为两位客人配一席茶':'帮忙照应两位客人'}</ActionButton>
          {q.purse.step===0&&<ActionButton secondary onClick={()=>claim({type:'FIND_PURSE'},'凳边有一只香囊，何娘替你收到了桌上。')}>看看凳边的香囊</ActionButton>}
          {q.purse.step===1&&<PurseExamine act={act}/>}
          {q.purse.step>=2&&q.purse.step<4&&<><ActionButton secondary onClick={()=>claim({type:'ASK',who:'he'},'何娘：刚才那位青灰衣的远客，起身时一直找东西。他说是姐姐的一针一线。')}>{game.progress.clues.includes('he')?'再听何娘说说线索':'问问何娘，谁坐过这里'}</ActionButton><ActionButton secondary onClick={()=>focusPerson('cheng')}>再向阿成问一问</ActionButton></>}
          {q.purse.step===3&&<ActionButton onClick={()=>focusPerson('chen')}>拿着香囊，去认一认失主</ActionButton>}
          <div className="shop-row"><span>坐下喝茶 <small>6 文</small></span><button className="text-button" disabled={game.wallet<6} onClick={()=>claim({type:'BUY',item:'tea'},'一碗温茶，慢慢喝。已付 6 文。')}>付文钱 · 歇一歇</button></div><p className="fine-print">文钱是游戏数值，不对应历史物价。</p>
        </>}
        {id==='chen'&&<>
          {q.purse.step===0&&<ActionButton onClick={()=>{act({type:'FIND_PURSE'});focusPerson('he');}}>回茶摊找一找</ActionButton>}
          {q.purse.step===1&&<PurseExamine act={act}/>}
          {q.purse.step===2&&<><p className="section-note">先向何娘和阿成打听，听过两条线索再归还。</p><ActionButton onClick={()=>focusPerson(game.progress.clues.includes('he')?'cheng':'he')}>去问{game.progress.clues.includes('he')?'阿成':'何娘'}</ActionButton></>}
          {q.purse.step===3&&<><JournalArt kind="purse" color="#9c6256"/><p className="section-note">两枝柳，一个「安」字。该把它交给谁？</p><div className="return-choices">{(['chen','cheng','liu'] as const).map(who=><ActionButton key={who} secondary onClick={()=>{if(who==='chen')claim({type:'RETURN_PURSE',who},game.claimed.includes('purse')?'这一段牵挂，已重新记下。':'香囊回到陈生手中。获赠 18 文，留下一页人物小画。');else notice('他摇摇头：不是我的。听说那位远客的姐姐，在香囊里绣了个「安」字。');}}>交给{CHARACTERS[who].name}</ActionButton>)}</div></>}
          {q.purse.step===4&&<><ActionButton onClick={()=>open({kind:'page',id:'purse'})}>留下这段牵挂</ActionButton><ActionButton secondary onClick={()=>replay('purse')}>重温这次相遇</ActionButton></>}
        </>}
        {id==='shen'&&<>
          {game.journal.length===0?<ActionButton onClick={()=>focusPerson('liu')}>先到纸铺，记下一次相遇</ActionButton>:<><p className="section-note">从自己的画册里，挑一页给师父看。</p><div className="favorite-list">{game.journal.filter(id=>id!=='master'&&id!=='departure').map(page=><button key={page} onClick={()=>claim({type:'FAVORITE',page},'师父看过这一页，微微点头。谈画的片刻，也已记入画册。')} className={game.progress.favorite===page?'selected':''}>{PAGES.find(p=>p.id===page)?.title}{game.progress.favorite===page&&<Icon name="check" size={16}/>}</button>)}</div><ActionButton onClick={()=>{act({type:'DEPART'});open({kind:'summary'});}}>说说今日的见闻</ActionButton></>}
        </>}
      </div>
      <button className="decline-button" onClick={()=>{close();setToast(c.refuse);}}>先告辞，沿河走走</button>
    </>;
  }

  const exportPage=async(id:PageId)=>{setExporting(true);try{await exportPostcard(game,id,pageArt.current?.querySelector('svg')??null);notice('留念图片已生成，请在浏览器下载中查看。');}catch(e){setToast(e instanceof Error?e.message:'保存未完成，请重试。');}finally{setExporting(false);}};
  const finished=game.claimed.length;
  return <main className={`game-shell ${game.settings.reduced||systemReduced?'reduced':''} ${hidden?'paused':''} ${!game.started?'welcome':''}`} data-time={time}>
    <header className="topbar"><button className="brand" onClick={()=>open({kind:'about'})} aria-label="关于汴河拾光"><span className="brand-seal">拾光</span><span><b>清明上河图</b><small>汴河拾光</small></span></button><div className="location-heading"><span className="ink-rule"/><span>卷一 · 虹桥两岸</span><span className="ink-rule"/></div><div className="top-actions"><div className="time-label"><Icon name="sun" size={18}/><span>春日 · {time==='晨'?'晨光':time==='昼'?'日和':'暮色'}</span></div><button className="round-button" aria-label={game.settings.sound?'关闭声音':'开启声音'} aria-pressed={game.settings.sound} onClick={()=>act({type:'SETTINGS',settings:{sound:!game.settings.sound}})}><Icon name={game.settings.sound?'sound':'mute'} size={20}/></button><button className="round-button" aria-label="设置" onClick={()=>open({kind:'settings'})}><Icon name="settings" size={20}/></button></div></header>
    <section className="painting-frame" aria-label="汴河春日画卷">
      <ScrollView game={game} center={center} setCenter={setCenter} onPerson={person} onEnvironment={environment} onTargets={targets=>open({kind:'targets',targets})} feedback={feedback} locked={!!modal}/>
      {!game.started&&<div className="welcome-copy"><div className="welcome-kicker"><span/> 一卷千年，今日入画</div><h1>汴河<span>拾光</span></h1><p className="welcome-poem">过一座桥，遇几位故人。<br/>在一河烟火里，留下你的春日。</p><button className="enter-button" onClick={()=>{act({type:'START'});setCenter(SCENE_CENTER.paper);}}><span>入画</span><Icon name="arrow" size={24}/></button><p className="welcome-footnote">自由漫游 · 轻故事 · 无需登录</p><div className="vertical-inscription">一河烟火，众人相成。<span>清明上河图 · 春日卷</span></div></div>}
      {game.started&&hint&&<div className="idle-hint"><span>纸铺的少年正扶着被风翻起的画纸。</span><button onClick={()=>focusPerson('liu')}>去帮帮他</button><button aria-label="关闭提示" onClick={()=>{setHint(false);act({type:'SETTINGS',settings:{hints:false}});}}><Icon name="close" size={16}/></button></div>}
      {saveBlocked&&<button className="storage-warning" onClick={()=>open({kind:'settings'})}>原存档需要处理 · 点此备份</button>}
    </section>
    <footer className="bottom-bar"><div className="bottom-motto"><span className="tiny-flower">✳</span><div><p>繁华深处，皆是日常。</p><small>{game.started?`已记下 ${game.journal.length} 页春日`:'把一座城，慢慢看进心里'}</small></div></div><nav className="main-nav" aria-label="画中工具"><button onClick={()=>open({kind:'album'})}><Icon name="book"/><span>画册</span>{game.journal.length>0&&<small>{String(game.journal.length).padStart(2,'0')}</small>}</button><span className="nav-divider"/><button onClick={()=>open({kind:'bag'})}><Icon name="bag"/><span>行囊</span></button><span className="nav-divider"/><button onClick={()=>{if(!game.started)act({type:'START'});open({kind:'nearby'});}}><Icon name="compass"/><span>附近</span></button></nav><div className="chapter-nav" aria-label="画卷位置">{CHAPTERS.map(({id,name,x})=><button key={id} className={scene===id?'active':''} aria-label={`前往${name}`} aria-current={scene===id?'location':undefined} onClick={()=>{if(!game.started)act({type:'START'});setCenter(x);}}><i/>{name}</button>)}</div></footer>
    {toast&&!modal&&<div className="toast" role="status"><Icon name="leaf" size={18}/><span>{toast}</span><button aria-label="收起消息" onClick={()=>setToast('')}><Icon name="close" size={16}/></button></div>}
    {modal&&<Sheet key={modal.kind==='character'?'character':modal.kind} title={title} eyebrow={subtitle} close={close} wide={modal.kind==='album'} notification={toast} dismiss={()=>setToast('')}>
      {modal.kind==='character'&&characterPanel(modal.id)}
      {modal.kind==='targets'&&<><p className="section-note">人和小物靠得很近，选一件此刻想做的事。</p><div className="target-options">{modal.targets.map(target=><ActionButton key={`${target.kind}-${target.id}`} onClick={()=>{if(target.kind==='person')person(target.id);else{close();environment(target.id);}}}>{target.label}</ActionButton>)}</div></>}
      {modal.kind==='rope'&&<RopeGame game={game} act={act} notice={notice} done={()=>open({kind:'character',id:'zhou'})}/>}
      {modal.kind==='tea'&&<TeaGame act={act} notice={notice} done={()=>open({kind:'character',id:'he'})}/>}
      {modal.kind==='nearby'&&<><p className="section-note">不用赶路，挑一件此刻想参与的小事。</p><div className="nearby-list">{([{id:'liu',quest:'paper',text:'春风翻起一角画纸，少年正腾不开手。'},{id:'zhou',quest:'boat',text:'船缓缓靠岸，一担新茶等着有人接手。'},{id:'he',quest:'purse',text:'茶汤正温。一只香囊，落在了空凳旁。'}] as const).map(item=><button key={item.id} onClick={()=>focusPerson(item.id)}><span className="nearby-number">{item.id==='liu'?'壹':item.id==='zhou'?'贰':'叁'}</span><div><small>{CHARACTERS[item.id].role} · {game.claimed.includes(item.quest)?'已相熟，可重逢':'可参与'}</small><h3>{QUEST_NAMES[item.quest]}</h3><p>{item.text}</p></div><Icon name="arrow"/></button>)}</div><details className="text-route"><summary>以文字探索街巷</summary><p>所有画中人物与环境，也可在这里点选。</p><div className="text-route-buttons">{(Object.keys(CHARACTERS) as CharacterId[]).map(id=><button key={id} onClick={()=>focusPerson(id)}>{CHARACTERS[id].name} · {CHARACTERS[id].role}</button>)}{ENVIRONMENT.map(e=><button key={e.id} onClick={()=>{setCenter(e.x);close();environment(e.id);}}>{e.label}</button>)}</div></details></>}
      {modal.kind==='album'&&<><div className="album-intro"><p>记得一个人，便留下一页。</p><span>{String(game.journal.length).padStart(2,'0')} / 12 页</span></div><div className="album-grid">{PAGES.map((page,i)=>{const unlocked=game.journal.includes(page.id);return <button className={`album-card ${unlocked?'unlocked':'locked'}`} key={page.id} onClick={()=>{if(unlocked)open({kind:'page',id:page.id});else notice(`《${page.title}》还未落笔。${page.subtitle.startsWith('一纸')?'在纸铺换一个写生视角，便能补记。':page.id.startsWith('river')?'与周伯重逢，选择另一条故事路线。':`沿河走走，留意「${page.subtitle}」。`}`);}} aria-label={`${page.title}，${unlocked?'查看画页':'尚未记录，查看提示'}`}><div className="album-art">{unlocked?<JournalArt kind={page.art} color={page.color}/>:<span className="blank-page">待落笔</span>}</div><span className="page-number">{String(i+1).padStart(2,'0')}</span><h3>{page.title}</h3><small>{page.subtitle}</small></button>;})}</div>{game.journal.length>0&&<div className="panel-bottom"><ActionButton onClick={()=>{act({type:'DEPART'});open({kind:'summary'});}}>整理今日的小记</ActionButton></div>}</>}
      {modal.kind==='page'&&(()=>{const page=PAGES.find(p=>p.id===modal.id)!;return <><div className={`postcard ${game.progress.designs?.[page.id]?.close?'close-view':''}`} ref={pageArt}><div className="postcard-art"><JournalArt kind={page.art} color={page.color}/></div><span className="postcard-seal">{game.progress.designs?.[page.id]?.decoration??'春日'}</span><h3>{page.title}</h3><p>{page.caption}</p><small>原创虚构故事 · 画中相遇</small></div><div className="button-row"><ActionButton onClick={()=>void exportPage(page.id)} disabled={exporting}><Icon name="download" size={18}/>{exporting?'正在装裱……':'保存清晰留念图'}</ActionButton><ActionButton secondary onClick={()=>open({kind:'album'})}>回到画册</ActionButton></div></>;})()}
      {modal.kind==='bag'&&<><div className="wallet"><span className="coin"><i/></span><div><small>随身文钱</small><h3>{game.wallet}<span> 文</span></h3></div><p>够一碗茶，也够慢慢逛。</p></div><p className="fine-print">仅用于画中日常，不可充值。价格与奖励均为游戏设计数值。</p><div className="inventory-list"><div><Icon name="brush" size={30}/><span><b>画笔与素纸</b><small>师父给的，随时都能用</small></span><span>常备</span></div><div><Icon name="book" size={30}/><span><b>春日画册</b><small>已记下 {game.journal.length} 页相遇</small></span><button className="text-button" onClick={()=>open({kind:'album'})}>翻一翻</button></div>{game.progress.quests.purse.step>0&&game.progress.quests.purse.step<4&&<div><JournalArt kind="purse"/><span><b>拾来的香囊</b><small>等一位惦记它的人</small></span><button className="text-button" onClick={()=>focusPerson('chen')}>去寻人</button></div>}</div><div className="shop-row"><span>纸铺纪念纸签 <small>12 文</small></span><button className="text-button" disabled={game.wallet<12} onClick={()=>claim({type:'BUY',item:'bookmark'},'小柳写下「春日平安」，夹进你的画册。已付 12 文。')}>买一枚</button></div>{game.progress.purchases.includes('bookmark')&&<p className="bookmark">春日平安 <small>· 纸签 × {game.progress.purchases.filter(x=>x==='bookmark').length}</small></p>}</>}
      {modal.kind==='settings'&&<><div className="settings-list">{([{key:'reduced',title:'减少动态',text:'船、柳枝和街面行人安静下来'},{key:'largeText',title:'大字阅读',text:'对话与正文放大到 150%'},{key:'hints',title:'闲时提示',text:'停留片刻后，轻轻提醒一处相遇'},{key:'sound',title:'河畔声音',text:'原创合成水声与轻铃，默认静音'}] as const).map(s=><label key={s.key}><span><b>{s.title}</b><small>{s.text}</small></span><input type="checkbox" checked={game.settings[s.key]} onChange={e=>act({type:'SETTINGS',settings:{[s.key]:e.target.checked}})}/></label>)}{game.settings.sound&&<><label><span>水声</span><input aria-label="水声音量" type="range" min="0" max="1" step=".05" value={game.settings.ambience} onChange={e=>act({type:'SETTINGS',settings:{ambience:Number(e.target.value)}})}/></label><label><span>互动轻铃</span><input aria-label="互动音量" type="range" min="0" max="1" step=".05" value={game.settings.effects} onChange={e=>act({type:'SETTINGS',settings:{effects:Number(e.target.value)}})}/></label></>}</div><div className="save-box"><h3>把这段春日带走</h3><p>进度仅保存在当前浏览器。导出存档，可以在另一台设备接着逛。</p><div className="button-row"><ActionButton secondary onClick={()=>downloadFile(new Blob([JSON.stringify(game,null,2)],{type:'application/json'}),'汴河拾光-存档.json')}>导出存档</ActionButton><ActionButton secondary onClick={()=>importRef.current?.click()}>导入存档</ActionButton></div><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1000000)throw new Error('存档文件过大，请选择本作导出的 JSON 文件。');const next=parseSave(await file.text());if(damaged)downloadFile(new Blob([damaged],{type:'application/json'}),'汴河拾光-原档备份.json');setSaveBlocked(false);setGame({...next,settings:{...next.settings,sound:false}});notice('存档已接续，欢迎回到汴河。');}catch(err){setToast(err instanceof Error?err.message:'导入失败，原进度已保留。');}e.target.value='';}}/>{damaged&&<div className="damaged-note"><p>原来的存档未能读取，仍保留在浏览器中。备份后可保存新的旅程。</p><ActionButton secondary onClick={()=>{downloadFile(new Blob([damaged],{type:'application/json'}),'汴河拾光-损坏存档备份.json');setSaveBlocked(false);notice('原档已下载备份，现在可以保存这次旅程。');}}>备份原档，开始保存</ActionButton></div>}</div><div className="settings-bottom"><button className="text-button" onClick={()=>open({kind:'about'})}>内容与素材说明</button><button className="text-button" onClick={()=>open({kind:'reset'})}>重新入画</button></div></>}
      {modal.kind==='summary'&&<><div className="summary-intro"><Icon name="leaf" size={30}/><h3>一河烟火，与你有了关系。</h3><p>今日，你记下 {game.journal.length} 页，走过 {finished} 段小故事。</p></div><div className="summary-events">{summaryEvents(game).map(event=><p key={event}>{event}</p>)}</div><p className="summary-sign">师父说：「肯停下来的人，才能看见画里的人。」</p><div className="button-row"><ActionButton onClick={()=>open({kind:'page',id:'departure'})}>留一张今日小记</ActionButton><ActionButton secondary onClick={close}>沿河再走走</ActionButton></div></>}
      {modal.kind==='about'&&<div className="about-prose"><p className="about-title">让人走进画卷，<br/>看见一座城，也看见城里的人。</p><p>「汴河拾光」是清明上河图系列的中国篇。本地体验包含虹桥两岸三段街景、六位人物、三段小故事与十二页可收集画册。</p><p>画面以张择端《清明上河图》中的河岸生活为灵感，场景与角色采用 AI 辅助创作的原创精绘，画册保留为简笔小画。不是原画复刻，也不使用馆藏高清图片。</p><p>人物、对白、故事为原创虚构；游戏文钱与物价为平衡数值。图鉴与故事不宣称已经完成历史复原。</p><p>无账号、无上传、无 AI 即兴对话与真实支付。体验在本地浏览器运行；字体使用设备已有的宋体或衬线字体，声音为原创合成。</p><a href="https://www.dpm.org.cn/collection/paint/228226.html" target="_blank" rel="noreferrer">原作资料 · 故宫博物院 <Icon name="arrow" size={16}/></a><div className="about-credit">WonderLab / Wonderful World<br/>一河烟火，众人相成。</div></div>}
      {modal.kind==='reset'&&<><p>重新入画会清除本作在当前浏览器中的故事进度、画册与文钱。可以先导出一份存档，把这段春日留住。</p><div className="button-row"><ActionButton secondary onClick={()=>downloadFile(new Blob([JSON.stringify(game,null,2)],{type:'application/json'}),'汴河拾光-存档.json')}>先导出存档</ActionButton><ActionButton onClick={()=>{if(damaged)downloadFile(new Blob([damaged]),'汴河拾光-原档备份.json');setGame(initialState());setSaveBlocked(false);setCenter(SCENE_CENTER.paper);close();notice('画卷重新展开了。');}}>确认重新入画</ActionButton></div></>}
    </Sheet>}
  </main>;
}

function PurseExamine({ act }: { act:(a:Action)=>void }) {
  return <div className="purse-inspect"><JournalArt kind="purse" color="#9c6256"/><p>浅色布面，绣着两枝并生的柳。翻开内衬，针脚缝出一个「安」字。</p><ActionButton onClick={()=>act({type:'EXAMINE_PURSE'})}>记住绣纹，打听失主</ActionButton></div>;
}
function BoatRoutes({game,act}:{game:GameState;act:(a:Action)=>void}) {
  return <><ActionButton onClick={()=>act({type:'BOAT_END',route:'deliver'})}>随阿成，把新茶送到茶摊</ActionButton><ActionButton secondary onClick={()=>act({type:'BOAT_END',route:'observe'})}>留在岸边，看大家配合靠岸</ActionButton><p className="fine-print">两条路都能记下故事{game.claimed.includes('boat')?'；重逢不再领取文钱。':'，同样获赠 24 文。以后重逢可补记另一页。'}</p></>;
}
const ROPE_NAMES=['圆环绳结','双股绳结','交叉绳结'];
function Knot({type}:{type:number}) {return <svg viewBox="0 0 100 75" className="knot-art" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden="true">{type===0?<><path d="M15 65q2-22 26-22c39 0 28-47 4-34-19 12-5 46 27 29L85 9"/><path d="M16 69q2-22 26-22c39 0 28-47 4-34-19 12-5 46 27 29L88 12" strokeWidth="1.2"/></>:type===1?<><path d="M20 67 70 9M32 69 82 11"/><path d="m22 53 17 2m-8-13 17 2m-7-12 16 2m-7-13 17 2" strokeWidth="2"/></>:<><path d="m15 12 72 52M14 64 87 12"/><path d="M18 7 90 59M11 59 84 7" strokeWidth="1.2"/><path d="m42 25 20 28m-21-1 22-26" strokeWidth="2"/></>}</svg>;}
function RopeGame({game,act,notice,done}:{game:GameState;act:(a:Action)=>void;notice:(s:string)=>void;done:()=>void}) {
  const [selected,setSelected]=useState<number|null>(null),[mistakes,setMistakes]=useState(0),[guide,setGuide]=useState(false);
  const q=game.progress.quests.boat;
  const match=(target:number,rope=selected)=>{if(rope===null){notice('先点一根绳索，再点相同模样的系缆点。');return;}if(rope===target){act({type:'ROPE',rope,target});setSelected(null);notice('这一根系好了，船身稳了一些。');}else{setMistakes(n=>n+1);setSelected(null);notice('绳结模样还不相同。再看一眼，慢慢来。');}};
  return <>
    <p className="section-note">{q.step===0?'不急着用力，先认清模样。点选绳索，再点相同的系缆点；也可以拖过去。':q.step===1?'三根绳索都稳妥了，再替阿成认一认货签。':'新茶已认出，可以请阿成接担了。'}</p>
    {q.step===0&&<><div className="rope-progress">已理好 {game.progress.ropes.length} / 3 根<span>没有倒计时</span></div><div className="rope-board"><div className="rope-row">{[0,1,2].map(i=><button key={i} className={`rope-card ${selected===i?'selected':''} ${game.progress.ropes.includes(i)?'tied':''}`} draggable={!game.progress.ropes.includes(i)} onDragStart={e=>{e.dataTransfer.setData('text/plain',String(i));setSelected(i);}} onClick={()=>setSelected(i)} disabled={game.progress.ropes.includes(i)} aria-label={`选择${ROPE_NAMES[i]}`} aria-pressed={selected===i}><Knot type={i}/><span>{ROPE_NAMES[i]}</span>{game.progress.ropes.includes(i)&&<Icon name="check" size={18}/>}</button>)}</div><div className="rope-dashes" aria-hidden="true">﹏﹏﹏</div><div className="rope-row">{[2,0,1].map(i=><button key={i} className={`mooring-card ${game.progress.ropes.includes(i)?'tied':''} ${guide&&selected===i?'guided':''}`} onClick={()=>match(i)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const raw=e.dataTransfer.getData('text/plain');if(raw!==''&&['0','1','2'].includes(raw))match(i,Number(raw));}} disabled={game.progress.ropes.includes(i)} aria-label={`系在${ROPE_NAMES[i]}的系缆点`}><Knot type={i}/><span>{game.progress.ropes.includes(i)?'已系好':ROPE_NAMES[i]}</span></button>)}</div></div>{mistakes>=2&&<button className="text-button" onClick={()=>setGuide(!guide)}>{guide?'收起引导':'显示可选引导'}</button>}</>}
    {q.step===1&&<><JournalArt kind="cargo"/><p className="section-note">何娘说：「我要那担新茶，竹篓上有一个『茶』字。」</p><div className="cargo-options">{[{id:'silk',label:'绢',desc:'布匹木箱'},{id:'tea',label:'茶',desc:'新茶竹篓'},{id:'rice',label:'米',desc:'粮食布袋'}].map(tag=><button key={tag.id} onClick={()=>{if(tag.id==='tea'){act({type:'TAG',tag:tag.id});notice('认准了新茶竹篓，请阿成来接这一担。');}else notice('这是另一家的货。何娘要的是有「茶」字的竹篓。');}}><b>{tag.label}</b><span>{tag.desc}</span></button>)}</div></>}
    {q.step>=2&&<div className="puzzle-complete"><Icon name="check" size={40}/><h3>绳稳，货明。</h3><p>岸上的阿成可以接过这担新茶了。</p><ActionButton onClick={done}>回到周伯身边</ActionButton></div>}
    <button className="decline-button" onClick={done}>返回街上 · 已理好的绳索会保留</button>
  </>;
}
function TeaGame({act,notice,done}:{act:(a:Action)=>void;notice:(s:string)=>void;done:()=>void}) {
  const [choices,setChoices]=useState([-1,-1]),[complete,setComplete]=useState(false);
  const options=[{title:'清茶 · 炊饼',desc:'清淡，无甜味',kind:'tea'},{title:'浓茶 · 酥点',desc:'茶味厚，点心微甜',kind:'market'},{title:'淡茶 · 甜糕',desc:'茶清淡，米糕偏甜',kind:'tea'}];
  return <>{!complete?<><p className="section-note">记着每个人的一点偏好，就是何娘的待客之道。选择后仍可更换。</p>{[{name:'赶路的脚夫',pref:'爱清淡，不吃甜，想要一份炊饼。'},{name:'歇脚的客人',pref:'喝淡茶，喜欢软软的甜糕。'}].map((guest,i)=><div className="tea-guest" key={guest.name}><div className="guest-heading"><svg viewBox="-38 -156 76 168" width="40" height="70" aria-hidden="true"><PaintedPerson id={i===0?'cheng':'chen'} height={140} shadow={false}/></svg><div><h3>{guest.name}</h3><p>{guest.pref}</p></div></div><div className="tea-options">{options.map((option,index)=><button key={option.title} className={choices[i]===index?'selected':''} aria-pressed={choices[i]===index} onClick={()=>setChoices(prev=>prev.map((value,n)=>n===i?index:value))}><JournalArt kind={option.kind}/><b>{option.title}</b><small>{option.desc}</small></button>)}</div></div>)}<ActionButton disabled={choices.includes(-1)} onClick={()=>{if(choices[0]===0&&choices[1]===2){act({type:'TEA',selections:choices});setComplete(true);notice('客人们坐下了，「一席知味」已记入画册。');}else notice(choices[0]!==0?'脚夫笑说：我吃不了甜，清茶配炊饼就好。再换换吧。':'客人笑说：茶淡些，再来块甜糕就好。可以再换一份。');}}>茶点配好了，请慢用</ActionButton></>:<div className="puzzle-complete"><JournalArt kind="tea"/><h3>一席茶，恰合心意。</h3><p>「这炊饼真香。」<br/>「茶淡淡的，配甜糕正好。」</p><p className="fine-print">客人已入座，可回到街景看看。</p><ActionButton onClick={done}>听听何娘怎么说</ActionButton></div>}<button className="decline-button" onClick={done}>返回街上</button></>;
}
