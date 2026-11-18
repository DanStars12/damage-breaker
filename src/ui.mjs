import {burstVisual,reelTiming} from './presentation.mjs';
import {paintEvent,eventCanvasSize} from './event-art.mjs';
import {events} from './events.mjs';
import {supportValue,supportKinds} from './cards.mjs';
import {numberUnits} from './math.mjs';
import {boardRelicStates} from './presentation.mjs';
import {relicIcon} from './relic-art.mjs';
import {relicRanks} from './relics.mjs';
import {attackPatterns,attackHits} from './enemies.mjs';
import {createSound} from './sound.mjs';
const app=document.querySelector('#app');
const dialog=document.querySelector('#dialog');
const effect=document.querySelector('#effect');
const book=load();
let suspended=readCheckpoint(book.checkpoint);
let run=null, selected=null, storageWarning=false, notice='';
let sequence=null, lastPage=null, craftResult=null, lastDeal=null, lastBattle=null;
let deckFilter='all', deckPage=0, shopTab='cards', baseGlow=null;
const motionMode=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'off':book.prefs.motion||'full';
const sound=createSound(globalThis.AudioContext,()=>book.prefs);
const cue=(id,options={})=>sound.play(id,{fast:motionMode()==='fast',signal:sequence?.signal,...options});
const cardCue=c=>({guard:'ward',ward:'ward',clean:'clean',mul:'multiply',pct:'multiply',pow:'mystic',exp:'mystic'}[c.kind]||'place');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const fmt=(n,cap=true)=>format(n,book.prefs.scientific,cap);
const exactRat=([n,d])=>d===1n?String(n):n+' / '+d;
const rat=([n,d])=>d===1n?fmt(n,false):fmt(n,false)+' / '+fmt(d,false);
const compact=(n,cap=true)=>{
  if(cap&&n>CAP) return '∞';
  const abs=n<0n?-n:n;
  if(book.prefs.scientific||abs<10000n||abs>CAP) return fmt(n,cap);
  const unit=10n**BigInt((Math.ceil(abs.toString().length/4)-1)*4);
  const leading=abs/unit;
  const fractional=String((abs%unit)*100n/unit).padStart(2,'0').replace(/0+$/,'');
  return ((abs%unit)*100n%unit?'≈':'')+(n<0n?'−':'')+String(leading)+(fractional?'.'+fractional:'')+format(unit,false,false).slice(1);
};
const visibleNumber=([n,d])=>d===1n?compact(n,false):compact(n,false)+' / '+compact(d,false);
const btn=(title,act,cls='',disabled=false)=>`<button type="button" data-action="${act}" class="${cls}" ${disabled?'disabled':''}>${title}</button>`;
const types={add:'加算',mul:'乗算',pct:'割合',exp:'指数',pow:'累乗',clean:'浄化',ward:'結界',guard:'防御'};
const glyph={add:'✦',mul:'✧',pct:'◈',pow:'❖',exp:'✷',clean:'✤',ward:'◇',guard:'⬟'};
const cardEffect=c=>{
  if(c.kind==='clean') return '盤の妨害を先頭から'+supportValue(c)+'枚解除';
  if(c.kind==='ward') return '妨害 '+supportValue(c)+'回を無効化';
  if(c.kind==='guard') return '次の攻撃を '+supportValue(c)+' 軽減';
  return types[c.kind];
};
const cardFace=c=>{
  const value=label(c);
  const valueWidth=Array.from(value).reduce((width,character)=>width+(/^[\x20-\x7E×²³⁰-⁹]$/u.test(character)?.67:1),0);
  return `<span class="card-head"><span class="card-rank" aria-label="${rarity[c.tier]}"><span class="rank-full">${rarity[c.tier]}</span><span class="rank-short" aria-hidden="true">${rarity[c.tier][0]}</span></span>
    ${c.upgraded?'<span class="card-upgrade" title="強化済み" aria-label="強化済み">✧</span>':''}
    <span class="mana" title="消費エネルギー">${c.cost}</span></span>
    <span class="card-display"><span class="sigil" aria-hidden="true">${glyph[c.kind]||'◇'}</span>
      <strong class="card-number" style="--value-width:${Math.max(2,valueWidth).toFixed(2)}">${value}</strong></span>
    <span class="card-type">${cardEffect(c)||'妨害'}</span>`;
};
const cardButton=(c,act,i=-1,disabled=false)=>`<button type="button" class="card t${c.tier}" data-action="${act}"
  ${i<0?'':`draggable="${!disabled}" data-hand="${i}"`} title="${cardEffect(c)}・消費 ${c.cost}" ${disabled?'disabled':''}>
  ${cardFace(c)}</button>`;
function persist(){storageWarning=!save(book);}
function saveProgress() {
  const finished=run.phase==='loss'||run.phase==='win';
  if(finished||run.phase==='clear') rememberRun();
  suspended=finished?null:{run,notice,craftResult};
  book.checkpoint=suspended?writeCheckpoint(suspended):null;
  persist();
}
function modal(title,content) {
  dialog.className='';
  dialog.innerHTML=`<h2>${title}</h2>${content}<form method="dialog"><button>閉じる</button></form>`;
  if(!dialog.open) dialog.showModal();
}
function routeName(act=run.act){return act===4?'EXTRA':'ACT '+['','I','II','III'][act];}
const rankMark=id=>`<span class="relic-rank r${relics[id].rank}">${relicRanks[relics[id].rank].name}</span>`;
function intentText(a=run.next) {
  if(a.kind==='attack') return `HPに ${a.value} ダメージ`;
  const pattern=attackPatterns[a.kind];
  if(pattern) {
    const hits=attackHits(a);
    const hit=hits>1?`${a.value} × ${hits} ダメージ`:hits?`${a.value} ダメージ`:'';
    const penalty={jam:'次のドロー −1',tax:'次のエナジー −1',fracture:'指定位置の次の演算を1枚封印',scorch:`演算盤に −${20*run.act}`}[pattern.penalty];
    return pattern.name+' · '+[hit,penalty].filter(Boolean).join(' ＋ ');
  }
  if(a.kind==='wither') return `吸命 · 戦闘中の最大HP −${a.value}（下限35）`;
  if(a.kind==='drain') return `弱体 · 戦闘中の基礎値 −${a.value}%`;
  if(a.kind==='lock') return `封印 · 次のBURSTまで${operationNames[a.target]}を無効化`;
  return `${a.at}枠目の後に ${label(a)} を挿入${run.ward?'（結界で防御可能）':''}`;
}
function pager(page,pages,attribute) {
  if(pages<=1) return '';
  return `<div class="pager"><button type="button" ${attribute}="${page-1}" aria-label="前のページ" ${page===0?'disabled':''}>‹</button>
    <small>${page+1} / ${pages}</small><button type="button" ${attribute}="${page+1}" aria-label="次のページ" ${page===pages-1?'disabled':''}>›</button></div>`;
}
function baseBanner(gain=baseGlow) {
  if(!gain) return '';
  return `<p class="base-banner" role="status"><span class="base-spark" aria-hidden="true">✦</span>
    <span>基礎値上昇 <del>${gain.from}</del> → <strong>${gain.to}</strong></span><b>+${gain.to-gain.from}</b></p>`;
}
function markBaseGain(from) {
  const to=run.baseAt();
  if(to>from) {baseGlow={from,to};cue('ascend');}
}
function relicBadge(id,status,style='',inBoard=false) {
  const relic=relics[id];
  const description=esc(`${relic.name}（${status}） · ${relic.desc}`);
  return `<button type="button" class="relic-badge ${style}" data-action="relic:${id}" data-relic="${id}"
    ${inBoard?'data-board-relic':''} aria-label="${description}">
    ${relicIcon(id)}<i aria-hidden="true"></i><span class="relic-tip" aria-hidden="true">
      <b>${esc(relic.name)}</b> ${rankMark(id)}<small>${status} · ${esc(relic.desc)}</small></span></button>`;
}
function relicStrip(p,firing=false) {
  const entries=boardRelicStates(run.owned,p,firing?null:run.lastBurst);
  return entries.map(({id,fixed,ready,fired})=>relicBadge(id,
    fixed?'常時・開幕効果':ready&&fired?'発動予定・直前に発動':ready?'発動予定':'直前に発動',
    fixed?'relic-fixed':fired?'relic-lit':'relic-ready-icon',true)).join('');
}
function sidebar(p) {
  const active=relicActivations(p);
  return `<aside>
    <section class="frame"><h2>術師の記録</h2><div class="data">
    <span>HP <b>${run.hp}/${run.maxHp}</b></span><span>金貨 <b>${run.gold}</b></span>
    <span>基礎 <b>${run.base}</b></span><span>装甲 <b>÷${run.enemy.armor}</b></span></div>
    <small>歴代最高</small><div class="record">${fmt(BigInt(book.best.max))}</div>
    <div class="actions" style="margin-top:9px">${btn('デッキ '+run.deck.length,'deck')}${btn('履歴','history')}</div></section>
    <section class="frame relic-pane"><div class="heading"><h2>所持レリック ${run.owned.length}</h2>
    ${run.owned.length?btn('詳細','relics'):''}</div>
    ${run.owned.length?`<div class="relic-collection">${run.owned.map(id=>
      relicBadge(id,active.has(id)?'発動予定':'所持',active.has(id)?'relic-ready-icon':'')).join('')}</div>`:'<p class="muted">所持なし</p>'}</section></aside>`;
}
function openRelicCollection() {
  modal('所持レリック '+run.owned.length,`<div class="relic-options">${run.owned.map(id=>
    `<article class="relic-option"><h3>${relicIcon(id)} ${esc(relics[id].name)} ${rankMark(id)}</h3><p>${esc(relics[id].desc)}</p></article>`).join('')}</div>`);
}
function damageReceipt() {
  const p=run.lastBurst;
  if(!p) return '';
  const kind=p.impact.kind, status=kind==='barrier'?'バリアで無効':kind==='gate'?'耐久段階を突破':kind==='miss'?'ダメージなし':'';
  const fired=[...relicActivations(p)].map(id=>relics[id].name);
  return `<section class="damage-receipt" aria-label="直前の攻撃結果">
    <div><small>確定BURST</small><strong title="${p.final}">${compact(p.final)}</strong></div>
    <div><small>敵HPの減少</small><strong title="${p.impact.dealt}">${compact(p.impact.dealt,false)}</strong>${status?`<small>${status}</small>`:''}</div>
    ${fired.length?`<p class="relic-receipt">✦ 発動レリック　${fired.join(' ／ ')}</p>`:''}</section>`;
}
function tacticalReadout(p) {
  const outcome=run.enemyOutcome();
  const held=run.holdPreview(outcome);
  const lethal=!outcome.hp;
  const victory=p.impact.dealt===run.enemy.hp;
  const holdText=run.holds>=2?'HOLD上限':lethal?'反撃で敗北':
    outcome.hp<run.hp?'HP −'+(run.hp-outcome.hp):outcome.maxHp<run.maxHp?'最大HP −'+(run.maxHp-outcome.maxHp):
    outcome.drain!==run.drain?'基礎 '+run.base+' → '+run.baseAt(outcome.drain):
    outcome.drawPenalty?'次のドロー −1':outcome.energyPenalty?'次のエナジー −1':outcome.deb!==run.deb?'妨害が盤に入る':outcome.blocked||outcome.absorbed?'HP変化なし':'追加の変化なし';
  const burstText=victory?'このBURSTで撃破':p.impact.kind==='gate'?'耐久段階を突破':
    p.impact.kind==='barrier'?'バリアを1枚破る':p.impact.kind==='miss'?'攻撃が通らない':'敵HP −'+compact(p.impact.dealt,false);
  return `<div class="tactics" aria-label="HOLDとBURSTの比較">
    <div class="${lethal&&run.holds<2?'tactics-danger':''}"><b>HOLD</b><span>${holdText}${outcome.blocked&&run.holds<2&&!lethal?' · 結界で妨害を防ぐ':''}${outcome.absorbed&&run.holds<2?' · 防御 '+outcome.absorbed:''}${held!==null&&held!==p.final?` <small title="${held}"> · 引く前の予測 ${compact(held)}</small>`:''}</span></div>
    <div class="${victory?'tactics-win':lethal?'tactics-danger':''}"><b>BURST</b><span>${burstText}${lethal&&!victory?' · 反撃で敗北':''}</span></div></div>`;
}
const enemyNameHTML=name=>name.split(/(?<=・)/u).map(part=>`<span class="enemy-name-part">${esc(part)}</span>`).join('<wbr>');
function battle() {
  const p=run.preview(), e=run.enemy;
  const gate=e.gates[0];
  const interceptBlock=run.interceptReason(p);
  const interceptBenefit=interceptBlock?'':run.enemyOutcome(run.next,true).hp-run.enemyOutcome().hp;
  const slots=Array.from({length:run.slots},(_,i)=>{
    const c=run.board[i];
    const status=c?p.steps.find(s=>s.card===c):null;
    const at=Math.min(i,run.board.length);
    const deb=i<=run.board.length?run.deb.filter(d=>Math.min(d.at,run.board.length)===i).map(d=>
      `<span class="slot debuff" data-calc="${p.steps.findIndex(s=>s.card===d)}" title="敵の妨害 · ${d.at}枠目の後">${label(d)}</span>`).join(''):'';
    return deb+(c?`<button type="button" class="slot board-card t${c.tier} ${status?.op===null?'is-sealed':''} ${i===selected?'selected':''}" style="border-color:var(--tone)"
      data-calc="${p.steps.indexOf(status)}" data-action="slot:${i}" data-at="${i}" data-board="${i}" draggable="true" aria-pressed="${i===selected}" title="${run.canReturn(i)?'選択して移動・取り消し':'選択して移動'}"><strong>${label(c)}</strong><small>${types[c.kind]}</small>${run.canReturn(i)?'<small class="returnable-label">仮置き</small>':''}${status?.op===null?'<small>封印</small>':''}</button>`:
      `<button type="button" class="slot empty" data-at="${at}" data-action="slot:${at}" aria-label="空き枠 ${i+1}">${i+1}</button>`);
  }).join('');
  const tail=run.board.length===run.slots?run.deb.filter(d=>d.at>=run.slots).map(d=>`<span class="slot debuff" data-calc="${p.steps.findIndex(s=>s.card===d)}">${label(d)}</span>`).join(''):'';
  return `<main class="battle"><div class="column">
    <section class="frame enemy" data-act="${run.act}" data-rank="${e.kind}" data-form="${e.art.form}">
      <div class="enemy-identity"><div class="eyebrow">${routeName()} · 第${run.stage}地点</div>
        <h1>${enemyNameHTML(e.name)}</h1><div class="enemy-title">${e.title}${e.elite?' · ELITE':''}</div></div>
      <div class="duel">
        <figure class="combatant hero"><div class="idle-sprite"><canvas data-sprite="10" width="48" height="44" aria-hidden="true"></canvas></div>
        <figcaption>術師</figcaption><div class="hpBar hero-hp" aria-hidden="true"><span style="width:${100*run.hp/run.maxHp}%"></span></div><small id="heroHp">HP ${run.hp} / ${run.maxHp}</small></figure>
        <span class="arena-seal" aria-hidden="true">✧</span>
        <figure class="combatant foe"><div class="idle-sprite"><canvas data-enemy-art width="88" height="64" aria-hidden="true"></canvas></div>
        <figcaption>敵</figcaption><div class="hpBar foe-hp" aria-hidden="true"><span style="width:${Number(e.hp*1000n/e.max)/10}%"></span></div><small id="foeHp" title="${e.hp} / ${e.max}">HP ${compact(e.hp)} / ${compact(e.max)}</small></figure>
        <span class="burst-scene" aria-hidden="true"><i class="burst-seal"></i><i class="burst-bolt"></i>
          <i class="burst-ring"></i><i class="burst-ring echo"></i><i class="burst-wake"></i><i class="burst-nova"></i><i class="burst-crown"></i></span>
        ${e.kind==='boss'?`<div class="boss-entry" aria-hidden="true"><i></i><span>ACT BOSS</span><strong>${enemyNameHTML(e.name)}</strong></div>`:''}
        <span class="boss-attack" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="intercept-arc" aria-hidden="true"></span><span class="slash" aria-hidden="true"></span><span class="enemy-cast" aria-hidden="true"></span><span id="incoming" aria-hidden="true"></span><span id="outgoing" aria-hidden="true"></span>
      </div>
      <div class="enemy-info">
      ${e.detail?`<p class="enemy-rule">${e.detail}</p>`:''}
      ${e.barrier||gate!==undefined?`<p class="enemy-rule defense-status">${e.barrier?'バリア残り '+e.barrier+'回':`耐久段階あと ${e.gates.length} · 次の突破に <b title="${e.hp-gate}">${compact(e.hp-gate,false)}</b> ダメージ`}</p>`:''}
      <div class="intent" data-move="${run.next.kind}"><small>敵の次の行動</small><strong>${intentText()}</strong></div></div></section>
    <section class="frame board-frame"><div class="heading"><h2>演算盤</h2><small>${run.board.length} / ${run.slots} 枠 · コンボ ${run.board.length}${run.wardCharges?' · 結界 '+run.wardCharges:''}${run.guardPoints?' · 防御 '+run.guardPoints:''}</small></div>
      <div class="board-relics" aria-label="演算盤のレリック">${relicStrip(p)}</div>
      <div class="board"><span class="slot base${baseGlow?' base-awaken':''}"><small>基礎</small>${run.base}</span>${slots}${tail}</div>
      ${selected!==null?`<div class="actions" style="margin-top:8px">${btn('← 左へ','shift:-1','',selected===0)}${btn('右へ →','shift:1','',selected===run.board.length-1)}${run.canReturn(selected)?btn('手札に戻す','unplay'):''}</div>`:''}
      <div class="preview"><div><small>通常演算</small><strong title="${exactRat(p.normal)}">${visibleNumber(p.normal)}</strong></div><div><small>レリック適用後</small><strong title="${exactRat(p.result)}">${visibleNumber(p.result)}</strong></div>
      <div><small>最終ダメージ予測</small><strong title="${p.final}">${compact(p.final)}</strong><small title="${p.impact.dealt}">敵HP −${compact(p.impact.dealt,false)}${p.impact.kind==='barrier'?' · バリアで無効':p.impact.kind==='gate'?' · 耐久段階まで':''}</small></div></div>
      <div id="reel" class="reel" hidden><div class="reel-head"><span id="stepName"></span><span id="stepCombo"></span></div>
      <div class="reel-display"><i aria-hidden="true"></i><strong id="reelNumber"></strong><small id="reelDigits"></small></div><div class="reel-foot"><div id="stepProgress"></div>${btn('演出をスキップ','skip')}</div></div>
      ${run.lastBurst?`<div class="last-strike" title="${[...relicActivations(run.lastBurst)].map(id=>relics[id].name).join(' ／ ')}">直前BURST <b title="${run.lastBurst.final}">${compact(run.lastBurst.final)}</b> · 敵HP −${compact(run.lastBurst.impact.dealt,false)}</div>`:''}
      ${notice?`<small class="battle-notice" role="status">${esc(notice)}</small>`:''}</section>
    <section class="frame"><div class="heading"><h2>手札</h2><span class="energy">エネルギー ${run.energy} / ${run.capacity} <small>· ドロー ${run.drawCount}枚</small></span></div>
      <div class="hand" data-hand-return>${run.hand.map((c,i)=>cardButton(c,'hand:'+i,i,!run.canPlay(c))).join('')}</div>
      ${tacticalReadout(p)}
      <div class="controls"><small>仮置きは選択して手札に戻せます。HOLDまたはBURSTで確定。${run.holds===2?' 次はBURST。':''}</small>
      <div class="actions">${btn('HOLD '+run.holds+'/2','hold','',run.holds>=2)}${btn('BURST','burst','primary')}
      <button type="button" class="intercept-button" data-action="intercept" aria-describedby="intercept-condition" ${interceptBlock?'disabled':''}>迎撃BURST</button><button data-action="skip" class="skip-hold" hidden>演出をスキップ</button></div>
      <small id="intercept-condition">${interceptBlock?`迎撃 · ${interceptBlock}`:`迎撃 · 消費1／この戦闘で1回 · HP損失を${interceptBenefit}軽減`}</small></div></section>
    </div>${sidebar(p)}</main>`;
}
const chapter=(tag,title,body)=>`<main><section class="frame chapter"><div class="eyebrow">${tag}</div><h1>${title}</h1>${body}</section></main>`;
const workshopThemes={
  forge:{symbol:'⚒',title:'鍛冶炉の刻印',done:'カードを強化しました'},
  shop:{symbol:'⚖',title:'旅商人の取引',done:'30金貨を支払い、カードを獲得しました'},
  fuse:{symbol:'◈',title:'錬成陣の結合',done:'素材2枚を新しいカードにしました'},
  relic:{symbol:'✧',title:'秘宝の譲渡',done:'レリックを獲得しました'},
  remove:{symbol:'♜',title:'刻印の消去',done:'デッキからカードを削除しました'}
};
const rewardCard=c=>`<div class="card result-card t${c.tier}">${cardFace(c)}</div>`;
function rewardChanges({hp,gold}) {
  const delta=(name,n)=>n?`<span>${name} <strong>${n>0?'+':'−'}${Math.abs(n)}</strong></span>`:'';
  return `<div class="reward-changes">${delta('HP',hp)}${delta('金貨',gold)}</div>`;
}
function cardReward() {
  const {status,card}=run.cardDecision;
  if(status==='none') return '';
  return `<section class="reward-block"><h2>演算パネル</h2>${
    status==='pending'?`<p>獲得するパネルを1枚選ぶか、見送れます。</p><div class="choices">${run.offers.map((c,i)=>cardButton(c,'take:'+i)).join('')}</div>
      ${btn('カードを見送る','cardSkip')}`:
      status==='taken'?`<div class="reward-result">${rewardCard(card)}<p><strong>取得済み</strong><br>デッキに ${label(card)} を追加しました。</p></div>`:
      '<p class="muted">カードは見送り済み</p>'}</section>`;
}
function goldReward() {
  const status=run.goldDecision;
  return `<section class="reward-block reward-gold"><div><h2>金貨</h2><p><strong>${run.goldReward}</strong> 枚
    ${status==='taken'?' · 取得済み':status==='skipped'?' · 見送り済み':''}</p></div>
    ${status==='pending'?`<div class="actions">${btn('金貨を受け取る','goldTake','primary')}${btn('金貨を見送る','goldSkip')}</div>`:''}</section>`;
}
function takeReport() {
  const items=[];
  if(run.cardDecision.status==='taken') items.push('カード '+label(run.cardDecision.card));
  if(run.goldDecision==='taken') items.push(run.goldReward+' 金貨');
  if(run.relicDecision==='taken') items.push(relics[run.relicDrop].name);
  const content=items.length?items.join(' ／ '):run.rewardPending?'報酬を選択中':'受け取った報酬はありません。';
  return `<p class="loot-receipt" role="status"><strong>今回の取得</strong>　${content}</p>`;
}
function relicReward() {
  if(!run.relicDrop) return '';
  const choices=[run.relicDrop,run.relicAlternative].filter(Boolean);
  const pending=run.relicDecision==='pending';
  const relicTile=(id,i)=>`<article class="relic-option">
    <h3>${relicIcon(id)} ${relics[id].name} ${rankMark(id)}</h3><p>${relics[id].desc}</p>
    ${pending?btn(relics[id].name+'を獲得','relicTake:'+i,'primary'):''}</article>`;
  return `<section class="relic-drop"><span aria-hidden="true">✧</span><div class="relic-reward-content">
    <small>${run.enemy.name}からドロップ</small><h2>レリック</h2>
    ${pending?`<p>${choices.length>1?'候補から1つ選べます。':'効果を確認してから獲得できます。'}</p>
      <div class="relic-options">${choices.map(relicTile).join('')}</div>${btn('レリックを見送る','relicSkip')}`:
      run.relicDecision==='taken'?`${relicTile(run.relicDrop,0)}<small>取得済み</small>`:'<p>レリックは見送り済み</p>'}
    </div></section>`;
}
function workshopStage(kind,body,reveal=false) {
  const theme=workshopThemes[kind];
  const motion=reveal?' data-motion="'+motionMode()+'"':'';
  return `<div class="workshop workshop-${kind}${reveal?' workshop-reveal':''}"${motion}>
    <div class="workshop-sigil" aria-hidden="true"><span>${theme.symbol}</span><i></i></div><div class="workshop-content">${body}</div></div>`;
}
function workResult() {
  const {kind,sources,result,relic,price,baseGain}=craftResult;
  if(kind==='event') {
    const id=craftResult.event??run.event;
    return eventChapter(id,`<section class="reward-block"><h2>イベントの結果</h2>
      ${result?`<div class="reward-result">${rewardCard(result)}<p>デッキに <strong>${label(result)}</strong> を追加しました。</p></div>`:''}
      ${rewardChanges(craftResult)}${!result&&!craftResult.hp&&!craftResult.gold?'<p>HPは満タンでした。</p>':''}
      <p role="status">現在のHP ${run.hp}/100 · 所持金 ${run.gold} 枚</p>
      <div class="actions">${btn('地図へ戻る','craftNext','primary')}</div></section>`,true);
  }
  const theme=workshopThemes[kind];
  if(kind==='remove'&&sources[0]) {
    const card=sources[0];
    return chapter(routeName(),theme.title,workshopStage(kind,`
      <div class="removal-scene" aria-hidden="true">
        <div class="card removed-card t${card.tier}">${cardFace(card)}</div>
        <i class="removal-ring"></i><i class="removal-cut"></i>
      </div>
      <p role="status">「${label(card)}」をデッキから削除しました。</p>
      <p class="muted">${price} 金貨を支払い · デッキ残り ${run.deck.length} 枚</p>
      <div class="actions">${btn('店へ戻る','craftNext','primary')}</div>`,true));
  }
  const previous=sources.map(c=>`<span>${label(c)}</span>`).join('')+(price?`<span>${price} 金貨</span>`:'');
  const output=result?`<div class="card result-card t${result.tier}">${cardFace(result)}</div>`:
    relic?`<div class="relic-drop"><div><h2>${relicIcon(relic)} ${relics[relic].name} ${rankMark(relic)}</h2><p>${relics[relic].desc}</p></div></div>`:'<strong>消去</strong>';
  return chapter(routeName(),theme.title,workshopStage(kind,`
    <div class="workshop-transform">${kind==='forge'?rewardCard(sources[0]):`<div class="workshop-sources">${previous}</div>`}
    <span class="workshop-arrow" aria-hidden="true">→</span><div class="workshop-output">${output}${kind==='forge'?'<i class="forge-strike" aria-hidden="true"></i><i class="forge-embers" aria-hidden="true"></i>':''}</div></div>
    ${baseBanner(baseGain??null)}
    <p role="status">${theme.done}</p><div class="actions">${btn(run.phase==='facility'?'店へ戻る':'地図へ戻る','craftNext','primary')}</div>`,true));
}
function useService(action,i=NaN,mode) {
  sound.unlock();
  const oldBase=run.baseAt();
  const transaction=run.service({action,i:action!=='remove'&&Number.isNaN(i)?Number(document.querySelector('#i')?.value):i,
    j:Number(document.querySelector('#j')?.value),mode,digit:Number(document.querySelector('#digit')?.value)});
  if(!transaction) {
    const status=action==='remove'?dialog.querySelector('#removeStatus'):app.querySelector('[role="status"]');
    if(status) status.textContent='金貨、素材、または利用回数の条件を満たしていません。';
    return;
  }
  if(action==='remove') dialog.close();
  cue(({buy:'gold',relic:'relic',fuse:'fuse',forge:'forge',remove:'remove',heal:'ward'})[action]||'page');
  markBaseGain(oldBase);
  if(transaction.kind) craftResult={...transaction,...(baseGlow?{baseGain:baseGlow}:{})};
  else notice=transaction.message;
  saveProgress();
  render();
  app.querySelector('[data-action="craftNext"]')?.focus({preventScroll:true});
}
function openRemoval() {
  const options=run.deck.map((c,i)=>`<option value="${i}">${i+1}. ${label(c)}${c.upgraded?' ✧':''} · ${rarity[c.tier]} · 消費 ${c.cost}</option>`).join('');
  modal('削除するカードを選ぶ',`<form id="removeForm" class="remove-form">
    <p>料金 ${prices.remove} 金貨 · 所持金 ${run.gold} 金貨</p>
    <label for="removeCard">削除するカード</label>
    <select id="removeCard" name="card" required><option value="" selected disabled>カードを選択</option>${options}</select>
    <div id="removePreview" aria-live="polite"></div>
    <p id="removeStatus" role="status"></p>
    <button class="primary" type="submit" disabled>選んだカードを削除</button>
  </form>`);
  dialog.querySelector('#removeCard').focus();
}
function eventChapter(id,content,resolved=false) {
  const definition=events[id];
  const [width,height]=eventCanvasSize;
  return `<main class="event-page"><section class="frame chapter event-chapter">
    <div class="event-hero">
      ${definition?`<canvas data-event-art="${id}" width="${width}" height="${height}" aria-hidden="true"></canvas>`:''}
      <div class="event-heading"><div class="eyebrow">${routeName()} · ランダムイベント</div>
        <h1>${esc(definition?.name??'旅先の出来事')}</h1></div>
    </div><div class="event-content">${!resolved&&definition?`<p class="event-story">${esc(definition.story)}</p>`:''}${content}</div>
    </section></main>`;
}
function eventPreview() {
  const choices=run.eventOffers.map((offer,i)=>`<section class="reward-block event-choice">
    <h2>${esc(offer.offer)}</h2>
    ${offer.result?rewardCard(offer.result):''}${rewardChanges(offer)}
    ${!offer.available?'<p class="muted">必要なHPまたは金貨が足りません。</p>':''}
    ${btn('この選択を受ける','eventChoice:'+i,'primary',!offer.available)}</section>`).join('');
  return eventChapter(run.event,`<div class="event-choices">${choices}</div>
    <div class="actions">${btn('見送る','service:decline')}</div>`);
}
function facility() {
  const f=run.facility;
  if(f==='event') return eventPreview();
  const options=run.deck.map((c,i)=>`<option value="${i}">${i+1}. ${label(c)}${c.upgraded?'✧':''}</option>`).join('');
  const forge=`<div class="choices"><label>強化対象 <select id="i">${options}</select></label>${btn('火力型','forge:power')}${btn('数字調整型','forge:adjust')}</div>
    <div class="choices"><label>刻印する数字 <select id="digit">${Array.from({length:10},(_,i)=>`<option>${i}</option>`).join('')}</select></label>
    ${btn('末尾刻印','forge:digit')}</div><p id="forgePreview"></p>`;
  const unable=key=>run.shopUsed[key]||run.gold<prices[key];
  const body=f==='rest'?`<p>HP ${run.hp}/100 · 回復か鍛冶を1回選択</p><div class="choices">${btn('HPを35回復','service:heal','primary')}</div>${workshopStage('forge',forge)}`:
    workshopStage('shop',shopContents(options,unable));
  return chapter(routeName(),places[f].name,body+`<p role="status">${esc(notice)}</p>`
    +(f!=='event'?`<div class="actions">${btn('地図へ戻る','leave','primary')}</div>`:''));
}
function shopContents(options,unable) {
  const tabs=[['cards','カード'],['relics','レリック'],['forge','工房']];
  let contents;
  if(shopTab==='cards') contents=`<h2>カード各 ${prices.buy} 金貨</h2><div class="choices shop-cards">${run.shop.map((c,i)=>
    c?cardButton(c,'buy:'+i,-1,unable('buy')):'<span class="sold">売約済み</span>').join('')}</div>`;
  else if(shopTab==='relics') contents=`<h2>レリック · ${run.shopUsed.relic?'購入済み':prices.relic+'金貨／1個まで'}</h2>
    <div class="choices">${run.stockRelics.map((id,i)=>btn(relicIcon(id)+' '+relics[id].name+' '+rankMark(id)+'<small>'+relics[id].desc+'</small>','relicBuy:'+i,'',unable('relic'))).join('')||'在庫なし'}</div>`;
  else contents=`<h2>工房 · デッキ下限12枚</h2><div class="choices"><label>対象 <select id="i">${options}</select></label><label>合成相手 <select id="j">${options}</select></label>
    ${btn(run.shopUsed.fuse?'合成済み':'合成 · '+prices.fuse+'金貨','fuse','',unable('fuse')||run.deck.length<=12)}</div>
    <p id="forgePreview"></p>${btn(run.shopUsed.remove?'削除済み':'削除するカードを選ぶ · '+prices.remove+'金貨','remove','',unable('remove')||run.deck.length<=12)}`;
  return `<div class="shop-head"><p>所持金 <b>${run.gold}</b></p><div class="actions" aria-label="売り場">${tabs.map(([key,name])=>
    `<button data-action="shopTab:${key}" aria-pressed="${key===shopTab}">${name}</button>`).join('')}</div></div>${contents}`;
}
function mapView() {
  const xy=n=>[17+n.col*33,100-(n.row+.5)*100/run.map.length];
  const all=run.map.flat();
  const links=all.flatMap(n=>n.next.map(id=>{
    const to=all.find(v=>v.id===id);
    const [x,y]=xy(n),[tx,ty]=xy(to);
    const live=run.node?.id===n.id;
    const visited=run.visited.includes(n.id)&&run.visited.includes(id);
    return `<line x1="${x}" y1="${y}" x2="${tx}" y2="${ty}" class="${live?'live':visited?'traveled':''}"/>`;
  })).join('');
  const nodes=all.map(n=>{
    const [x,y]=xy(n),place=places[n.kind],live=run.routes.includes(n.id);
    const status=live?'選択可能':run.visited.includes(n.id)?'訪問済み':'未到達';
    return `<button type="button" data-action="route:${n.id}" class="map-node ${n.kind} ${live?'live':''} ${status==='訪問済み'?'traveled':''}" style="--x:${x}%;--y:${y}%"
      title="第${n.row+1}層 · ${place.desc} · ${status}" aria-label="第${n.row+1}層 ${place.name} ${status}" ${live?'':'disabled'}>
      <span aria-hidden="true">${place.icon}</span><small>${place.name}</small></button>`;
  }).join('');
  return chapter(routeName(),'巡歴の地図',`<div class="map-heading"><p>下から上へ、光るマスを選ぶ。</p><p>HP ${run.hp}/100 · ${run.gold} 金貨</p></div>
    ${notice?`<p role="status">${esc(notice)}</p>`:''}
    <div class="route-map"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${links}</svg>${nodes}</div>
    <div class="map-legend">${Object.values(places).map(p=>`<span><b>${p.icon}</b> ${p.desc}</span>`).join('')}</div>`);
}
const checkpointLabels={map:'地図',battle:'戦闘中',reward:'勝利報酬',facility:'施設',clear:'EXTRA挑戦前'};
function view() {
  if(!run) return `<main><section class="frame title"><div><div class="eyebrow">演算魔術譚 · v1.1</div><div class="rule"></div>
    <h1>DAMAGE<br>BREAKER</h1><p>数式を刻み、魔導書の力で無量門を破れ。</p>
    ${suspended?`<section class="continue-run">
      ${btn('つづきから','resume','primary')}
      <small>${routeName(suspended.run.act)} · 第${suspended.run.stage}地点 · ${checkpointLabels[suspended.run.phase]}<br>シード ${esc(suspended.run.seed)}</small>
    </section>`:''}
    <form id="start"><label><small>シード（任意）</small><input name="seed" maxlength="40" placeholder="空欄でランダム"></label><button class="${suspended?'':'primary'}">${suspended?'新しい探索':'探索を始める'}</button></form>
    </div><canvas width="320" height="243" aria-hidden="true"></canvas></section></main>`;
  if(craftResult) return workResult();
  switch(run.phase) {
    case 'battle':return battle();
    case 'reward':return chapter(routeName(),'勝利報酬',`${baseBanner()}<p>HP ${run.hp}/100 ${run.victoryHeal?'（勝利時回復 +'+run.victoryHeal+'）':''} · 所持金 ${run.gold} 枚</p>
      ${damageReceipt()}
      <div class="loot-grid${run.relicDrop?' has-relic':''}"><div>${cardReward()}${goldReward()}</div>${relicReward()}</div>${takeReport()}
      ${btn('ページをめくる','advance','primary',run.rewardPending)}`);
    case 'map':return mapView();
    case 'facility':return facility();
    default: {
      const title={loss:'探索終了',clear:'無量門突破',win:'EXTRA 突破'}[run.phase];
      return chapter('DAMAGE BREAKER',title,`<p>シード ${esc(run.seed)}</p>${run.phase==='loss'?`<p>${routeName()} · 第${run.stage}地点 · ${run.enemy.name}との戦闘で敗北</p>`:''}<h2>今回の最大ダメージ</h2>
        <p class="record">${fmt(run.stats.max)}</p><p class="muted">${esc(run.stats.formula)}</p>
        <h2>コンボ ${run.stats.combo} · ∞ ${run.stats.infinity}回 · ${run.stats.turns}ターン</h2>
        <div class="actions">${run.phase==='clear'?btn('EXTRAへ挑む','extra','primary'):''}${btn('タイトルへ','title')}${btn('記録帳','records')}</div>`);
    }
  }
}
function render() {
  const mode=motionMode();
  app.dataset.motion=mode;
  app.innerHTML=`<header><div class="brand">◇ DAMAGE BREAKER</div><nav>${run&&run.phase!=='battle'?btn('デッキ '+run.deck.length,'deck'):''}${run&&suspended?btn('中断','pause'):''}${btn('遊び方','help')}${btn('数字の単位・読み方','numberUnits')}${btn('記録帳','records')}${btn('設定','settings')}</nav></header>${view()}
    ${storageWarning?'<p role="status" style="text-align:center">保存できませんでした。画面を閉じると、今回の進行や記録が失われる場合があります。</p>':''}`;
  if(baseGlow&&run?.phase==='map'&&!craftResult) app.querySelector('.map-heading')?.insertAdjacentHTML('afterend',baseBanner());
  const hero=app.querySelector('[data-sprite]');
  if(hero) paintSprite(hero,10);
  const enemy=app.querySelector('[data-enemy-art]');
  if(enemy) {
    const now=performance.now();
    hero.parentElement.style.setProperty('--idle-delay',-(now%5000)+'ms');
    enemy.parentElement.style.setProperty('--idle-delay',-((now+1700)%6400)+'ms');
    paintEnemy(enemy,run.enemy.art);
    const battleKey=run.act+':'+run.stage;
    const dealKey=battleKey+':'+run.turn;
    if(lastBattle!==battleKey&&run.turn===0&&mode!=='off') {
      app.querySelector('.enemy').classList.add('encounter-arrival');
      if(run.enemy.kind==='boss') cue('boss');
    }
    lastBattle=battleKey;
    if(lastDeal!==dealKey&&mode!=='off') {
      app.querySelector('.hand').classList.add('dealing');
      app.querySelectorAll('.hand .card').forEach((card,index)=>card.style.setProperty('--deal',index));
    }
    lastDeal=dealKey;
  }
  const eventArt=app.querySelector('[data-event-art]');
  if(eventArt) paintEvent(eventArt,eventArt.dataset.eventArt);
  const titleArt=app.querySelector('.title canvas');
  if(titleArt) paint(titleArt,2,1);
  const page=craftResult?'craft':run?.phase??'title';
  if(lastPage!==null&&lastPage!==page&&mode!=='off') {
    const chapter=app.querySelector('main');
    chapter.classList.add('turn-page');
    chapter.classList.toggle('turn-fast',mode==='fast');
    chapter.addEventListener('animationend',function finishPage(e) {
      if(e.target!==chapter||e.animationName!=='turn-page') return;
      chapter.classList.remove('turn-page','turn-fast');
      chapter.removeEventListener('animationend',finishPage);
    });
  }
  lastPage=page;
  baseGlow=null;
  updateFacility();
}
function updateFacility() {
  const el=document.querySelector('#forgePreview');
  if(!el) return;
  const i=Number(document.querySelector('#i').value), j=Number(document.querySelector('#j')?.value);
  const c=run.deck[i];
  if(run.facility==='rest') {
    const a=upgraded(c,'power'),b=upgraded(c,'adjust'),d=upgraded(c,'digit',Number(document.querySelector('#digit').value));
    const support=supportKinds.includes(c.kind);
    const titles=[support?'効果強化':'火力型',support?'消費軽減':'数字調整型','末尾刻印'];
    for(const [index,mode] of ['power','adjust','digit'].entries()) {
      const button=app.querySelector('[data-action="forge:'+mode+'"]');
      button.textContent=titles[index];
      button.disabled=![a,b,d][index];
    }
    const choices=[a,b,d].map((result,index)=>result?`${titles[index]} ${label(result)} · 消費 ${result.cost}`:'').filter(Boolean);
    el.textContent=choices.length?'変化後　'+choices.join(' ／ '):'このパネルは強化対象外です。';
  } else {
    const a=i!==j&&fused(c,run.deck[j]);
    app.querySelector('[data-action="fuse"]').disabled=!a||run.shopUsed.fuse||run.gold<prices.fuse||run.deck.length<=12;
    el.textContent=a?`合成後　${label(a)} · 消費 ${a.cost}`:'合成できる2枚を選択してください。';
  }
}
function rememberRun() {
  if(!['win','clear','loss'].includes(run.phase)) return;
  const snapshot=run.summary();
  if(run.archiveId) book.runs=book.runs.filter(r=>r.id!==run.archiveId);
  run.archiveId ||= Date.now()+'-'+run.seed;
  book.runs.unshift({...snapshot,id:run.archiveId});
  book.runs.length=Math.min(book.runs.length,20);
}
function burstFX(n,best) {
  const mode=motionMode();
  const inf=n>CAP, visual=burstVisual([n,1n],inf), tier=visual.level;
  effect.className='';
  if(mode!=='off') {
    effect.textContent=(inf?'INFINITY BREAK ∞':fmt(n))+(best?' · 新記録':'');
    void effect.offsetWidth;
    effect.dataset.tier=tier;
    effect.style.setProperty('--burst-hue',visual.hue);
    effect.className='flash'+(inf||tier>=4?' high':'')+(tier>=3&&mode==='full'?' shake':'')+(mode==='fast'?' fast':'');
  }
  cue(inf?'infinity':tier>=3?'impactNova':'hit',{level:tier});
  if(best&&!inf) cue('record');
}
effect.addEventListener('animationend',()=>{effect.className='';});
const prefsHTML=()=>`<p><label><input type="checkbox" id="scientific" ${book.prefs.scientific?'checked':''}> 指数表記</label></p>
  <p><label>演出 <select id="motion">${[['full','通常'],['fast','高速・軽量'],['off','スキップ']].map(([id,t])=>
    `<option value="${id}" ${(book.prefs.motion||'full')===id?'selected':''}>${t}</option>`).join('')}</select></label></p>
  <p><label><input type="checkbox" id="mute" ${book.prefs.mute?'checked':''}> 効果音を消す</label></p>
  <p><label>効果音の音量 <input type="range" id="volume" min="0" max="100" value="${Number(book.prefs.volume??55)}"></label> <output for="volume">${Number(book.prefs.volume??55)}%</output></p>`;
const deckKinds=['add','mul','pct','pow','exp','ward','clean','guard'];
const deckNames={...types,ward:'結界',clean:'浄化'};
function deckContents() {
  const stock=[...run.deck].sort((a,b)=>deckKinds.indexOf(a.kind)-deckKinds.indexOf(b.kind)||a.value-b.value||a.cost-b.cost);
  const shown=stock.filter(card=>deckFilter==='all'||card.kind===deckFilter);
  const pages=Math.max(1,Math.ceil(shown.length/12));
  return `<div class="deck-toolbar"><label>種類 <select id="deckFilter">
    ${['all',...deckKinds].map(kind=>`<option value="${kind}" ${kind===deckFilter?'selected':''}>${deckNames[kind]??'すべて（種類順）'}</option>`).join('')}</select></label>
    <small>${shown.length}枚</small>${pager(deckPage,pages,'data-deck-page')}</div>
    ${shown.length?`<div class="deck-cards">${shown.slice(deckPage*12,(deckPage+1)*12).map(rewardCard).join('')}</div>`:'<p>この種類のカードはありません。</p>'}`;
}
function openDeck() {
  deckFilter='all';
  deckPage=0;
  modal('デッキ '+run.deck.length+'枚',`<div id="deckContents">${deckContents()}</div>`);
  dialog.classList.add('deck-dialog');
}
function refreshDeck(focus) {
  dialog.querySelector('#deckContents').innerHTML=deckContents();
  (dialog.querySelector(focus)||dialog.querySelector('#deckFilter')).focus({preventScroll:true});
}
function openRecords() {
  modal('記録帳',`<h3>歴代最高 ${fmt(BigInt(book.best.max))}</h3><p>${esc(book.best.formula||'記録なし')}</p>
    <h3>探索履歴</h3>${book.runs.map(r=>`<details><summary>${esc(r.seed)} · ${{loss:'敗北',clear:'通常クリア',win:'EXTRAクリア'}[r.outcome]} · 第${r.stage}戦 · ${fmt(BigInt(r.max))}</summary>
      <p>コンボ ${r.combo} · 最大乗算 ×${r.mul} · 最大累乗 ${r.pow} · 最大指数 ${r.exp} · ∞ ${r.infinity}回</p>
      <p>${esc(r.formula)}</p><p>デッキ　${r.deck.map(label).join(' / ')}</p><p>レリック　${r.relics.map(id=>relics[id].name).join(' / ')}</p></details>`).join('')||'<p>探索履歴なし</p>'}`);
}
function action(command) {
  const [name,arg]=command.split(':');
  if(sequence) {if(name==='skip') sequence.abort();return;}
  sound.unlock();
  const i=Number(arg);
  if(name==='help') return modal('遊び方',`<p>手札の演算を盤に置き、基礎攻撃力から左順に計算します。地図は下から上へ、光っているマスを選びます。たとえば 20 → +10 → ×3 は90です。</p>
    <p>HOLDは盤を維持して新しい手札を引きます。敵はHOLD後、またはBURSTで生き残った後に予告どおり行動します。</p>
    <p>差し引きで負になった値や分数も計算中は保持します。装甲適用後、負のダメージは0、小数は切り捨てです。</p>
    <p>迎撃BURSTは各戦闘で1回。有効な演算が2枚以上あり、敵HPを削れるとき、エネルギー1で直後の攻撃を1ヒット分防ぎます。</p>
    <p>次の盤に入る妨害は、指定枠が空なら一時的に末尾で処理します。種別封印は、次のBURSTまで指定の演算をすべて無効化します。HOLDの予測には新しく引くカードを含めません。</p>`);
  if(name==='settings') return modal('設定',prefsHTML());
  if(name==='records') return openRecords();
  if(name==='numberUnits') {
    modal('数字の単位・読み方',`<dl class="number-units">${numberUnits.map(({name,reading,exponent})=>
      `<div><dt>${name}</dt><dd>${reading}</dd><dd>10<sup>${exponent}</sup></dd></div>`).join('')}</dl>
      <p>例　1億2345万は 123,450,000。指数表記では 1.2345e+8。</p>
      <p>9999無量大数（9999 × 10<sup>68</sup>）を超えた最終ダメージは ∞ と表示します。</p>`);
    dialog.classList.add('units-dialog');
    return;
  }
  if(name==='deck') return openDeck();
  if(name==='relics') return openRelicCollection();
  if(name==='shopTab') {
    shopTab=arg;render();app.querySelector('[data-action="shopTab:'+arg+'"]').focus();return;
  }
  if(name==='relic') return modal(relics[arg].name,`<p class="relic-detail">${relicIcon(arg)} ${rankMark(arg)} ${relics[arg].desc}</p>`);
  if(name==='history') return modal('計算履歴',run.history.map(p=>`<details><summary>${fmt(p.final)} · ${esc(p.formula)}</summary>
    <ol>${p.steps.map(s=>`<li>${label(s.card)}${s.op?.kind!==s.card.kind?' → '+(s.op?label(s.op):'無効'):''} → ${rat(s.result)}</li>`).join('')}
    ${p.triggers.map(t=>`<li>${relics[t.id].name} → ${rat(t.result)}</li>`).join('')}</ol></details>`).join('')||'<p>まだBURSTしていません。</p>');
  if(name==='resume'&&suspended) {
    cue('page');
    ({run,notice,craftResult}=suspended);
    selected=null;
    lastDeal=null;
    render();
    return;
  }
  if(name==='pause'||name==='title') {
    if(name==='pause') saveProgress();
    run=null;
    craftResult=null;
    render();
    return;
  }
  const keepNotice=name==='craftNext'||name==='slot'||name==='shift'||name==='hand'||name==='unplay';
  if(!keepNotice) notice='';
  const oldBase=run.baseAt();
  let feedback=null;
  switch(name) {
    case 'hand': feedback=playCard(i);break;
    case 'slot':
      if(selected!==null&&selected!==i) {feedback=moveCard(selected,Math.min(i,run.board.length-1));selected=null;}
      else selected=i===selected||!run.board[i]?null:i;
      break;
    case 'unplay':
      feedback=undoCard(selected);
      if(feedback) selected=null;
      break;
    case 'shift': {
      const to=selected+i;
      feedback=moveCard(selected,to);
      if(feedback) selected=to;
      break;
    }
    case 'hold': void showHold();return;
    case 'burst': void showBurst();return;
    case 'intercept': void showBurst(true);return;
    case 'take':if(run.takeCard(i)) cue('mystic');break;
    case 'cardSkip':run.skipCard();break;
    case 'goldTake':if(run.chooseGold(true)) cue('gold');break;
    case 'goldSkip':run.chooseGold(false);break;
    case 'relicTake':if(run.chooseRelic(true,i)) cue('relic');break;
    case 'relicSkip':run.chooseRelic(false);break;
    case 'advance':run.advance();cue('page');break;
    case 'route':
      if(run.route(arg)) {shopTab='cards';cue(run.phase==='battle'?'draw':'page');}
      break;
    case 'leave':run.leaveNode();break;
    case 'extra':run.extra();cue('draw');break;
    case 'craftNext':craftResult=null;break;
    case 'buy':useService('buy',i);return;
    case 'relicBuy':useService('relic',i);return;
    case 'service':useService(arg);return;
    case 'eventChoice':useService('event',i);return;
    case 'forge':useService('forge',NaN,arg);return;
    case 'remove':openRemoval();return;
    case 'fuse':useService(name);return;
  }
  markBaseGain(oldBase);
  saveProgress();
  render();
  animateCard(feedback);
}
function playCard(index,at=run.board.length) {
  const card=run.hand[index];
  if(!run.play(index,at)) return null;
  cue(cardCue(card));
  if(supportKinds.includes(card.kind)) {
    notice=cardEffect(card);
    return {selector:'.board-frame',className:'support-applied'};
  }
  return {selector:'.board-card[data-at="'+at+'"]',className:'card-placed'};
}
function undoCard(index) {
  if(!run.returnToHand(index)) return null;
  cue('undo');
  return {selector:'.hand [data-hand="'+(run.hand.length-1)+'"]',className:'card-returned'};
}
function moveCard(from,to) {
  if(from===to||!run.move(from,to)) return null;
  cue('move');
  return {selector:'.board-card[data-at="'+to+'"]',className:'card-placed'};
}
function animateCard(feedback) {
  if(feedback&&motionMode()!=='off') app.querySelector(feedback.selector)?.classList.add(feedback.className);
}
app.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');
  if(b&&!b.disabled) action(b.dataset.action);

});
app.addEventListener('submit',e=>{
  if(e.target.id!=='start') return;
  e.preventDefault();
  if(suspended&&!window.confirm('保存中の探索を終了して、新しい探索を始めますか？')) return;
  const seed=new FormData(e.target).get('seed').trim()||crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  sound.unlock();
  cue('page');
  run=new Run(seed);
  lastDeal=null;
  lastBattle=null;
  selected=null;
  craftResult=null;
  notice='';
  saveProgress();
  render();
});
let dragging=null;
app.addEventListener('dragstart',e=>{
  if(sequence) {e.preventDefault();return;}
  sound.unlock();
  const el=e.target.closest('[draggable="true"]');
  if(!el) return;
  dragging=el.dataset.hand!==undefined?{hand:Number(el.dataset.hand)}:{board:Number(el.dataset.board)};
  e.dataTransfer.setData('text/plain','damage-breaker');
  e.dataTransfer.effectAllowed='move';
});
app.addEventListener('dragover',e=>{
  if(!dragging||sequence) return;
  if(e.target.closest('[data-at]')||
    (e.target.closest('[data-hand-return]')&&run.canReturn(dragging.board))) e.preventDefault();
});
app.addEventListener('drop',e=>{
  if(!dragging||sequence) return;
  const el=e.target.closest('[data-at]');
  let feedback;
  if(e.target.closest('[data-hand-return]')&&run.canReturn(dragging.board)) {
    e.preventDefault();
    feedback=undoCard(dragging.board);
  } else if(el) {
    e.preventDefault();
    const at=Number(el.dataset.at);
    if(dragging.hand!==undefined) feedback=playCard(dragging.hand,at);
    else feedback=moveCard(dragging.board,Math.min(at,run.board.length-1));
  } else return;
  dragging=null;selected=null;saveProgress();render();animateCard(feedback);
});
app.addEventListener('dragend',()=>{dragging=null;});
app.addEventListener('change',updateFacility);
dialog.addEventListener('change',e=>{
  const {id,checked,value}=e.target;
  if(id==='deckFilter') {deckFilter=value;deckPage=0;refreshDeck('#deckFilter');return;}
  if(id==='removeCard') {
    const selectedCard=value===''?null:run.deck[Number(value)];
    dialog.querySelector('#removePreview').innerHTML=selectedCard?rewardCard(selectedCard):'';
    dialog.querySelector('#removeForm button').disabled=!selectedCard;
    return;
  }
  if(!['scientific','motion','mute'].includes(id)) return;
  book.prefs[id]=id==='motion'?value:checked;
  if(id==='mute') {sound.unlock();sound.refresh();}
  persist();render();
});
dialog.addEventListener('click',e=>{
  const page=e.target.closest('[data-deck-page]');
  if(!page||page.disabled) return;
  const forward=Number(page.dataset.deckPage)>deckPage;
  deckPage=Number(page.dataset.deckPage);
  refreshDeck(`[aria-label="${forward?'次':'前'}のページ"]:not(:disabled)`);
});
dialog.addEventListener('input',e=>{
  if(e.target.id!=='volume') return;
  book.prefs.volume=Number(e.target.value);
  dialog.querySelector('output[for="volume"]').textContent=book.prefs.volume+'%';
  sound.refresh();
  persist();
});
dialog.addEventListener('submit',e=>{
  if(e.target.id!=='removeForm') return;
  e.preventDefault();
  const value=e.target.elements.card.value;
  if(value!=='') useService('remove',Number(value));
});
render();

function reactionText(move,message,hpLost,outcome) {
  const {blocked,absorbed,intercepted}=outcome;
  const hits=attackHits(move);
  const details=[];
  if(hits||hpLost) details.push(hpLost?'術師 HP −'+hpLost:'術師 HP変化なし');
  if(intercepted) details.push('迎撃で1ヒット阻止');
  if(absorbed) details.push('防御 '+absorbed);
  if(blocked) details.push('結界が妨害を防ぎました');
  else if(!hits) details.push(message);
  else if(attackPatterns[move.kind]?.penalty) details.push(message.split(' ＋ ').at(-1));
  else if(move.kind!=='attack') details.push(attackPatterns[move.kind].name);
  return details.join(' · ');
}
function enemyReaction(move,message,hpLost,outcome) {
  const {blocked,absorbed,intercepted}=outcome;
  cue(({cleave:'melee',wave:'wave',meteor:'meteor',dust:'hex',flare:'flare',eclipse:'eclipse',pursuit:'triple',lock:'seal',fracture:'seal',drain:'drain',wither:'drain',double:'double',attack:'melee'}[move.kind]||'hex'));
  if(blocked||absorbed) cue('ward');
  if(intercepted) cue('intercept');
  const field=app.querySelector('.enemy');
  if(!field||motionMode()==='off') return;
  field.classList.remove('player-strike','player-landed','player-blocked','player-miss','gate-shatter');
  field.classList.add(attackHits(move)?'enemy-strike':'enemy-magic');
  field.dataset.move=blocked&&!attackHits(move)?'ward':move.kind;
  field.classList.toggle('ward-answer',blocked||absorbed>0);
  field.classList.toggle('intercept-reaction',intercepted>0);
  field.classList.toggle('enemy-double',move.kind==='double');
  field.classList.toggle('enemy-triple',move.kind==='pursuit');
  field.querySelector('#incoming').textContent=reactionText(move,message,hpLost,outcome);

}
function clock(duration,signal,update=()=>{}) {
  return new Promise(resolve=>{
    if(signal.aborted) {resolve();return;}
    let frame,timer;
    const start=performance.now();
    const stop=()=>{
      cancelAnimationFrame(frame);clearTimeout(timer);
      signal.removeEventListener('abort',stop);
      resolve();
    };
    const draw=now=>{
      const progress=Math.min(1,Math.max(0,(now-start)/duration));
      update(progress);
      if(progress===1) stop();
      else frame=requestAnimationFrame(draw);
    };
    signal.addEventListener('abort',stop,{once:true});
    timer=setTimeout(()=>{update(1);stop();},duration+40);
    frame=requestAnimationFrame(draw);
  });
}
function updateHeroDisplay(field) {
  field.querySelector('.hero-hp span').style.width=100*run.hp/run.maxHp+'%';
  field.querySelector('#heroHp').textContent='HP '+run.hp+' / '+run.maxHp;
}
async function showHold() {
  const move=run.next;
  const hpBefore=run.hp;
  const outcome=run.enemyOutcome(move);
  const prediction=intentText(move);
  if(!run.hold()) return;
  selected=null;
  notice=reactionText(move,prediction,hpBefore-run.hp,outcome)+(run.phase==='battle'?' ／ 次の手札を引きました':'');
  saveProgress();
  const mode=motionMode();
  if(mode==='off'){enemyReaction(move,prediction,hpBefore-run.hp,outcome);if(run.phase==='battle') cue('draw');render();return;}
  const control=new AbortController();
  sequence=control;
  const field=app.querySelector('.enemy');
  app.querySelectorAll('button:not(:disabled)').forEach(button=>button.disabled=true);
  const skip=app.querySelector('.skip-hold');
  skip.hidden=false;
  skip.disabled=false;
  skip.focus({preventScroll:true});
  enemyReaction(move,prediction,hpBefore-run.hp,outcome);
  updateHeroDisplay(field);
  try {await clock(mode==='fast'?160:570,control.signal);}
  finally {
    sequence=null;
    if(!control.signal.aborted&&run.phase==='battle') cue('draw');
    render();
    app.querySelector('[data-action="hold"]:not(:disabled),[data-action="burst"]')?.focus({preventScroll:true});
  }
}
async function showBurst(intercept=false) {
  const base=run.base, armor=run.enemy.armor, move=run.next;
  const hpBefore=run.hp;
  const outcome=run.enemyOutcome(move,intercept);
  const prediction=intentText(move);
  const p=run.burst(intercept);
  if(!p) return;
  const best=p.final>BigInt(book.best.max);
  if(best) book.best={max:String(p.final),formula:run.stats.formula,seed:run.seed};
  selected=null;
  const strike=p.impact.kind==='barrier'?'バリアがBURSTを無効化':p.impact.kind==='gate'?'耐久段階を突破 · '+compact(p.impact.dealt,false):'BURST '+compact(p.final);
  notice=(intercept?'迎撃成立 · ':'')+strike+(best?' · 新記録':'')+(run.enemy.hp>0n?' ／ '+reactionText(move,prediction,hpBefore-run.hp,outcome):'');
  saveProgress();
  const mode=motionMode();
  const control=new AbortController();
  sequence=control;
  const signal=control.signal;
  const reel=app.querySelector('#reel'), field=app.querySelector('.enemy');
  try {
    if(mode!=='off') {
      const name=reel.querySelector('#stepName'), counter=reel.querySelector('#reelNumber');
      const combo=reel.querySelector('#stepCombo'), progress=reel.querySelector('#stepProgress');
      const steps=timeline(p,armor);
      const countDigits=reel.querySelector('#reelDigits');
      let prior=[BigInt(base),1n];
      let lastDigits=0, lastLevel=0, lastInfinity=false;
      const showValue=(value,infinity=false)=>{
        const text=infinity?'∞':visibleNumber(value);
        if(counter.textContent!==text) counter.textContent=text;
        const visual=burstVisual(value,infinity);
        if(visual.digits!==lastDigits||visual.level!==lastLevel||infinity!==lastInfinity) {
          const grows=visual.digits>lastDigits;
          reel.dataset.level=visual.level;
          reel.style.setProperty('--burst-hue',visual.hue);
          countDigits.textContent=infinity?'INFINITY BREAK':visual.digits+' 桁';
          if(grows||infinity) reel.dataset.beat=reel.dataset.beat==='a'?'b':'a';
          if(grows&&lastDigits&&visual.level>lastLevel&&mode==='full') cue('digitRise',{level:visual.level});
          lastDigits=visual.digits;lastLevel=visual.level;lastInfinity=infinity;
        }
      };
      showValue(prior);
      reel.hidden=false;
      reel.closest('.board-frame').classList.add('calculating');
      field.classList.remove('encounter-arrival');
      field.classList.add('charging');
      const disabled=[...app.querySelectorAll('button:not(:disabled)')].filter(b=>b.dataset.action!=='skip');
      disabled.forEach(b=>b.disabled=true);
      reel.querySelector('button').focus({preventScroll:true});
      const strip=app.querySelector('.board-relics');
      strip.innerHTML=relicStrip(p,true);
      let lit=null, firingRelic=null;
      for(const [i,step] of steps.entries()) {
        if(signal.aborted) break;
        lit?.classList.remove('resolving');
        firingRelic?.classList.remove('relic-pulsing');
        lit=step.index===undefined?null:app.querySelector('[data-calc="'+step.index+'"]');
        lit?.classList.add('resolving');
        firingRelic=null;
        if(step.relic) {
          const previous=strip.querySelector('[data-relic="'+step.relic+'"]');
          const badge=relicBadge(step.relic,'このBURSTで発動','relic-lit relic-pulsing',true);
          if(previous) {
            previous.insertAdjacentHTML('beforebegin',badge);
            previous.remove();
          } else strip.insertAdjacentHTML('beforeend',badge);
          firingRelic=strip.querySelector('[data-relic="'+step.relic+'"]');
        }
        const level=magnitude(step.value);
        reel.dataset.kind=step.type;
        if(step.relic) name.innerHTML=relicIcon(step.relic)+' 発動 · '+esc(step.name);
        else name.textContent=step.name;
        combo.textContent=step.combo+' COMBO';
        counter.title=exactRat(step.value);
        counter.classList.remove('count-pop');
        void counter.offsetWidth;
        counter.classList.add('count-pop');
        progress.style.width=((i+1)*100/steps.length)+'%';
        if(step.type!=='impact') cue(step.type==='relic'?'relic':step.type==='enemy'?'hex':cardCue(p.steps[step.index].card),{level});
        const {samples,duration}=reelTiming(prior,step.value,step.type,mode==='fast');
        await clock(duration,signal,position=>{
          const value=reelValue(prior,step.value,Math.floor(position*samples),samples);
          showValue(value,step.type==='impact'&&position===1&&p.final>CAP);
        });
        prior=step.value;
      }
      if(!signal.aborted) {
        field.classList.remove('charging');
        field.dataset.force=impactForce(p);
        const visual=burstVisual([p.final,1n],p.final>CAP);
        field.dataset.burstLevel=visual.level;
        field.style.setProperty('--burst-hue',visual.hue);
        if(mode==='full'&&p.impact.kind==='hit'&&visual.level>=3) field.style.setProperty('--flight','240ms');
        if(p.impact.kind!=='miss') {
          field.classList.add('burst-firing');
          const heavy=p.impact.kind==='hit'&&Number(field.dataset.burstLevel)>=3;
          cue(heavy?'launchNova':'launch');
          await clock(mode==='fast'?65:heavy?240:155,signal);
          field.classList.remove('burst-firing');
        }
      }
      if(!signal.aborted) {
        const e=run.enemy;
        const impact=p.impact.kind;
        const reaction={barrier:'player-blocked',miss:'player-miss',gate:'player-landed',hit:'player-landed'};
        field.classList.add('player-strike',reaction[impact]);
        if(impact==='gate') field.classList.add('gate-shatter');
        if(e.hp===0n) field.classList.add('enemy-defeated');
        field.querySelector('#outgoing').textContent=impact==='barrier'?'バリアで無効':impact==='miss'?'ダメージなし':
          (impact==='gate'?'段階突破 ':'')+'−'+compact(p.impact.dealt,false);
        field.querySelector('.foe-hp span').style.width=Number(e.hp*1000n/e.max)/10+'%';
        const foeHp=field.querySelector('#foeHp');
        foeHp.textContent='HP '+compact(e.hp)+' / '+compact(e.max);
        foeHp.title=e.hp+' / '+e.max;
        if(impact==='hit') burstFX(p.final,best);
        else cue(impact);
        if(e.hp===0n) cue('victory');
        await clock(mode==='fast'?160:impact==='hit'&&Number(field.dataset.burstLevel)>=3?950:695,signal);
        if(e.hp>0n&&!signal.aborted) {
          enemyReaction(move,prediction,hpBefore-run.hp,outcome);
          updateHeroDisplay(field);
          await clock(mode==='fast'?170:620,signal);
        }
      }
    } else {
      if(p.impact.kind==='hit') burstFX(p.final,best);
      else cue(p.impact.kind);
      if(run.enemy.hp===0n) cue('victory');
      else enemyReaction(move,prediction,hpBefore-run.hp,outcome);
    }
  } finally {
    if(signal.aborted) effect.className='';
    sequence=null;
    if(!signal.aborted&&run.phase==='battle') cue('draw');
    render();
    if(run.phase==='battle') app.querySelector('[data-action="burst"]')?.focus({preventScroll:true});
  }
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&sequence) sequence.abort();
});
