import {burstVisual,reelTiming,attackAnimation} from './presentation.mjs';
import {paintEvent,eventCanvasSize} from './event-art.mjs';
import {events} from './events.mjs';
import {supportValue,supportKinds,enchantments,enchantmentFor,canEnchant} from './cards.mjs';
import {numberUnits} from './math.mjs';
import {boardRelicStates} from './presentation.mjs';
import {relicIcon} from './relic-art.mjs';
import {relicRanks,relicRewardHints} from './relics.mjs';
import {attackPatterns,attackHits,attenuationPattern} from './enemies.mjs';
import {readDivination} from './hint.mjs';
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
const compactScreen=matchMedia('(max-width: 550px), (max-width: 850px) and (pointer: coarse), (max-height: 550px) and (max-width: 1100px) and (pointer: coarse)');
const sound=createSound(globalThis.AudioContext??globalThis.webkitAudioContext,()=>book.prefs);
const cue=(id,options={})=>sound.play(id,{fast:motionMode()==='fast',signal:sequence?.signal,...options});
const cardCue=c=>({guard:'ward',ward:'ward',clean:'clean',mul:'multiply',pct:'multiply',pow:'mystic',exp:'mystic'}[c.kind]||'place');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const coin='<svg class="coin-icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true"><path fill="#6b3d25" d="M3 0h6v1h2v2h1v6h-1v2H9v1H3v-1H1V9H0V3h1V1h2z"/><path fill="#e1a446" d="M3 1h6v1h2v7H9v2H3V9H1V3h2z"/><path fill="#ffe29b" d="M3 2h6v1H4v1H3v5H2V3h1z"/><path fill="#995522" d="M5 3h2v1h2v2H7V5H5v1h2v1h2v2H7v1H5V9H3V7h2v1h2V7H5V6H3V4h2z"/></svg>';
const moneyText=text=>esc(text).replace(/所持金|金貨/g,word=>coin+word);
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
const enchantPixels={
  repeat:'M2 1h6v1h2v2H7V3H3v2H1V3h1zm8 6h1v2h-1v2H4v-1H2V8h3v2h4V7z',
  energy:'M6 0h4L7 5h3l-6 7 1-5H2z',
  draw:'M4 0h7v9H9V2H4zM1 3h7v9H1zm2 2v5h3V5z'
};
function enchantBadge(card) {
  const e=enchantmentFor(card);
  return e?`<span class="enchant-mark" data-enchant="${card.enchant}" title="${e.name} · ${e.description}" aria-label="${e.name}"><svg viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges"><path fill-rule="evenodd" d="${enchantPixels[e.mark]}"/></svg></span>`:'';
}
const cardFace=c=>{
  const value=label(c);
  const valueWidth=Array.from(value).reduce((width,character)=>width+(/^[\x20-\x7E×²³⁰-⁹]$/u.test(character)?.67:1),0);
  return `<span class="card-head"><span class="card-rank" aria-label="${rarity[c.tier]}"><span class="rank-full">${rarity[c.tier]}</span><span class="rank-short" aria-hidden="true">${rarity[c.tier][0]}</span></span>
    <span class="card-emblems">${c.upgraded?'<span class="card-upgrade" title="強化済み" aria-label="強化済み">✧</span>':''}${enchantBadge(c)}</span>
    <span class="mana" title="消費エネルギー">${c.cost}</span></span>
    <span class="card-display" data-kind="${c.kind}"><span class="sigil" aria-hidden="true">${glyph[c.kind]||'◇'}</span>
      <strong class="card-number" style="--value-width:${Math.max(2,valueWidth).toFixed(2)}">${value}</strong></span>
    <span class="card-type">${supportKinds.includes(c.kind)?'スペル · ':''}${cardEffect(c)||'妨害'}</span>`;
};
const cardButton=(c,act,i=-1,disabled=false,hints=[])=>`<button type="button" class="card t${c.tier}${supportKinds.includes(c.kind)?' spell-card':''}" ${hints.length?' data-relic-hint':''} data-action="${act}"
  ${i<0?'':`draggable="${!disabled&&!supportKinds.includes(c.kind)}" data-hand="${i}"`} title="${cardEffect(c)}・消費 ${c.cost}${c.enchant?' · '+enchantmentFor(c).description:''}${hints.length?' · '+esc(hints.map(({id,reason})=>relics[id].name+'（'+reason+'） '+relics[id].desc).join(' ／ ')):''}" ${disabled?'disabled':''}>
  ${cardFace(c)}${hints.length?`<span class="reward-relic-hint">${relicIcon(hints[0].id)}<span>${hints[0].reason}</span><span class="reward-relic-name">${esc(relics[hints[0].id].name)}の条件候補</span></span>`:''}</button>`;
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
    const penalty={jam:'次のドロー −1',tax:'次のエナジー −1',fracture:'指定位置の次の演算を1枚封印',shatter:'結界を最大2層破壊',scorch:`演算盤に −${20*run.act}`}[pattern.penalty];
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
    <span>HP <b>${run.hp}/${run.maxHp}</b></span><span>${coin}金貨 <b>${run.gold}</b></span>
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
  const record=run.battleRecord;
  return `<section class="damage-receipt" aria-label="直前の攻撃結果">
    <div><small>確定BURST</small><strong title="${p.final}">${compact(p.final)}</strong></div>
    <div><small>敵HPの減少</small><strong title="${p.impact.dealt}">${compact(p.impact.dealt,false)}</strong>${status?`<small>${status}</small>`:''}</div>
    ${record?`<div class="record-receipt"><b>✦ 歴代記録更新${record.final===p.final?'':' · '+compact(record.final)}</b><p>${esc(record.formula)}</p></div>`:''}
    ${fired.length?`<p class="relic-receipt">✦ 発動レリック　${fired.join(' ／ ')}</p>`:''}</section>`;
}
function tacticalReadout(p,outcome,response) {
  const held=run.holdPreview(outcome);
  const lethal=!outcome.hp;
  const victory=p.impact.dealt===run.enemy.hp;
  const burstLethal=response.outcome?.hp===0;
  const holdText=run.holds>=run.holdLimit?'HOLD上限':lethal?'反撃で敗北':
    outcome.hp<run.hp?'HP −'+(run.hp-outcome.hp):outcome.maxHp<run.maxHp?'最大HP −'+(run.maxHp-outcome.maxHp):
    outcome.drain!==run.drain?'基礎 '+run.base+' → '+run.baseAt(outcome.drain):
    outcome.drawPenalty?'次のドロー −1':outcome.energyPenalty?'次のエナジー −1':outcome.deb!==run.deb?'妨害が盤に入る':outcome.blocked||outcome.absorbed?'HP変化なし':'追加の変化なし';
  const burstText=victory?'このBURSTで撃破':p.impact.kind==='gate'?'耐久段階を突破':
    p.impact.kind==='barrier'?'バリアを'+p.impact.breaks+'層破る':p.impact.kind==='miss'?'攻撃が通らない':'敵HP −'+compact(p.impact.dealt,false);
  const burstDefense=response.status==='success'&&!victory
    ?response.outcome.hp>0?' · 減衰後 HP '+response.outcome.hp:' · 減衰しても敗北'
    :burstLethal?' · 反撃で敗北':'';
  return `<div class="tactics" aria-label="HOLDとBURSTの比較">
    <div class="${lethal&&run.holds<run.holdLimit?'tactics-danger':''}"><b>HOLD</b><span>${holdText}${outcome.broken&&run.holds<run.holdLimit?' · 結界 −'+outcome.broken:outcome.blocked&&run.holds<run.holdLimit&&!lethal?' · 結界で妨害を防ぐ':''}${outcome.absorbed&&run.holds<run.holdLimit?' · 防御 '+outcome.absorbed:''}${held!==null&&held!==p.final?` <small title="${held}"> · 引く前の予測 ${compact(held)}</small>`:''}</span></div>
    <div class="${victory?'tactics-win':burstLethal?'tactics-danger':''}"><b>BURST</b><span>${burstText}${burstDefense}</span></div></div>`;
}
function battleCommands() {
  return `<div class="actions battle-commands">
    <button type="button" class="command" data-action="hold" ${run.holds>=run.holdLimit?'disabled':''}>
      <b>HOLD ${run.holds}/${run.holdLimit}</b><small>盤のカードを維持</small></button>
    <button type="button" class="command primary" data-action="burst"><b>BURST</b><small>今の盤で演算</small></button>
    <button type="button" data-action="skip" class="skip-sequence" hidden>演出をスキップ</button>
  </div>`;
}
const hpPercent=(hp,max)=>Number(hp*1000n/max)/10;
const enemyNameHTML=name=>name.split(/(?<=・)/u).map(part=>`<span class="enemy-name-part">${esc(part)}</span>`).join('<wbr>');
const actBackdrop=()=>`<canvas class="act-backdrop" data-act-art="act-${run.act}" width="${eventCanvasSize[0]}" height="${eventCanvasSize[1]}" aria-hidden="true"></canvas>`;
function gateLabel(g,max) {
  if(g===max*2n/3n) return '⅔';
  if(g===max/3n) return '⅓';
  if(g===max/2n) return '½';
  return Math.round(Number(g*1000n/max)/10)+'%';
}
function defenseStatus(enemy) {
  const {barrier,gates,hp,max,armor}=enemy;
  const marks=(enemy.originalGates??gates).map(g=>
    `<span class="phase-mark ${gates.includes(g)?'':'passed'}">${gateLabel(g,max)}</span>`).join('');
  return [
    armor>1?`<div class="defense-status"><b>装甲 ÷${armor}</b><small>最終ダメージを軽減</small></div>`:'',
    barrier?`<div class="defense-status"><b>バリア ${barrier}層</b><span class="shield-marks" aria-hidden="true">${'◆'.repeat(barrier)}</span><small>BURSTを無効化</small></div>`:'',
    gates.length?`<div class="defense-status"><b>耐久ライン 残り${gates.length}本</b><span class="phase-marks" aria-label="耐久ライン一覧">${marks}</span><small>次はHP ${gateLabel(gates[0],max)}で止まる · 必要ダメージ ${compact(hp-gates[0],false)}</small></div>`:''
  ].join('');
}
function gateTicks(enemy) {
  return (enemy.originalGates??enemy.gates).map(g=>`<i class="gate-tick${enemy.gates.includes(g)?'':' passed'}" style="--gate:${Number(g*1000n/enemy.max)/10}%" title="HP ${gateLabel(g,enemy.max)}"></i>`).join('');
}
function attenuationEffectText(move,{attenuationEffect:{value,nullified},broken}) {
  if(!attackHits(move)) return nullified?'妨害を無効化':intentText({...move,value});
  const hits=attackHits(move);
  const damage=`${value}${hits>1?' × '+hits:''}ダメージ`;
  const extra=nullified?'妨害を無効化':move.kind==='flare'?`妨害 −${10*run.act}`:
    move.kind==='shatter'&&broken?`結界 −${broken}層`:'';
  return [damage,extra].filter(Boolean).join(' · ');
}
function attenuationHint(move,response) {
  if(run.attenuationUsed) return '<div class="attenuation-hint">減衰済み</div>';
  const condition=attenuationPattern(move).map(kind=>types[kind]).join(' → ');
  const ready=response.status==='success';
  const forecast=ready?'<small>BURST時 · '+attenuationEffectText(move,response.outcome)+
    (response.outcome.hp>0?' · 残HP '+response.outcome.hp:' · 反撃で敗北')+'</small>':'';
  return `<div class="attenuation-hint${ready?' attenuation-ready':''}">
    <b>${ready?'減衰可能':'減衰条件'}</b> ${condition}${forecast}</div>`;
}
function battle() {
  const p=run.preview(), e=run.enemy;
  const move=run.next;
  const outcome=run.enemyOutcome(move);
  const response=run.burstResponse(p,move);
  const provisional=run.board.filter((_,i)=>run.canReturn(i)).length;
  const slots=Array.from({length:run.slots},(_,i)=>{
    const c=run.board[i];
    const status=c?p.steps.find(s=>s.card===c):null;
    const at=Math.min(i,run.board.length);
    const deb=i<=run.board.length?run.deb.filter(d=>Math.min(d.at,run.board.length)===i).map(d=>
      `<span class="slot debuff" data-calc="${p.steps.findIndex(s=>s.card===d)}" title="敵の妨害 · ${d.at}枠目の後">${label(d)}</span>`).join(''):'';
    return deb+(c?`<button type="button" class="slot board-card t${c.tier} ${status?.op===null?'is-sealed':''} ${i===selected?'selected':''}" style="border-color:var(--tone)"
      data-calc="${p.steps.indexOf(status)}" data-action="slot:${i}" data-at="${i}" data-board="${i}" draggable="true" aria-pressed="${i===selected}" aria-keyshortcuts="ArrowLeft ArrowRight Delete Escape" title="${run.canReturn(i)?'選択して移動・取り消し':'選択して移動'}"><strong>${label(c)}</strong><small>${types[c.kind]} ${enchantBadge(c)}</small>${run.canReturn(i)?'<small class="returnable-label">仮置き</small>':''}${status?.op===null?'<small>封印</small>':''}</button>`:
      `<button type="button" class="slot empty" data-at="${at}" data-action="slot:${at}" aria-label="空き枠 ${i+1}">${i+1}</button>`);
  }).join('');
  const tail=run.board.length===run.slots?run.deb.filter(d=>d.at>=run.slots).map(d=>`<span class="slot debuff" data-calc="${p.steps.findIndex(s=>s.card===d)}">${label(d)}</span>`).join(''):'';
  return `<main class="battle"><div class="column">
    <section class="frame enemy" data-act="${run.act}" data-rank="${e.kind}" data-form="${e.art.form}">
      <div class="enemy-identity"><div class="eyebrow">${routeName()} · 第${run.stage}地点</div>
        <h1>${enemyNameHTML(e.name)}</h1><div class="enemy-title">${e.title}${e.elite?' · ELITE':''}</div></div>
      <div class="duel">
        ${actBackdrop()}
        <figure class="combatant hero" data-defense="${run.wardCharges?'ward':run.guardPoints?'guard':'none'}"><div class="idle-sprite"><i class="barrier-shell" aria-hidden="true"></i><canvas data-sprite="10" width="48" height="44" aria-hidden="true"></canvas></div>
        <figcaption>術師</figcaption><div class="hpBar hero-hp" aria-hidden="true"><span style="width:${100*run.hp/run.maxHp}%"></span></div><small id="heroHp">HP ${run.hp} / ${run.maxHp}</small></figure>
        <span class="arena-seal" aria-hidden="true">✧</span>
        <figure class="combatant foe" data-defense="${e.barrier?'ward':'none'}"><div class="idle-sprite"><i class="barrier-shell" aria-hidden="true"></i><canvas data-enemy-art width="88" height="64" aria-hidden="true"></canvas></div>
        <figcaption>敵</figcaption><div class="hpBar foe-hp" aria-hidden="true"><span style="width:${hpPercent(e.hp,e.max)}%"></span>${p.impact.dealt>0n?`<i class="hp-forecast" style="--damage-from:${hpPercent(e.hp-p.impact.dealt,e.max)}%;--damage-to:${hpPercent(e.hp,e.max)}%"></i>`:''}${gateTicks(e)}</div><small id="foeHp" title="${e.hp} / ${e.max}">HP ${compact(e.hp)} / ${compact(e.max)}</small></figure>
        <span class="burst-scene" aria-hidden="true"><i class="burst-seal"></i><i class="burst-bolt"></i>
          <i class="burst-ring"></i><i class="burst-ring echo"></i><i class="burst-wake"></i><i class="burst-nova"></i><i class="burst-crown"></i><i class="burst-glyph"></i><span class="burst-sparks"></span></span>
        ${e.kind==='boss'?`<div class="boss-entry" aria-hidden="true"><i></i><span>ACT BOSS</span><strong>${enemyNameHTML(e.name)}</strong></div>`:''}
        <span class="boss-attack" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="slash" aria-hidden="true"></span><span class="enemy-cast" aria-hidden="true"></span><span class="enemy-hit-fx" aria-hidden="true"></span><span id="incoming" aria-hidden="true"></span><span id="outgoing" aria-hidden="true"></span>
      </div>
      <div class="enemy-info">
      ${e.detail?`<p class="enemy-rule">${e.detail}</p>`:''}
      <div class="enemy-defenses">${defenseStatus(e)}</div>
      <div class="intent" data-move="${move.kind}"><small>敵の次の行動 ${outcome.hp===0&&p.impact.dealt!==e.hp?'<b class="intent-danger">通常反撃は致命的</b>':''}</small><strong>${intentText(move)}</strong>${attenuationHint(move,response)}</div></div></section>
    <section class="frame board-frame"><div class="heading"><h2>演算盤</h2><small>${run.board.length} / ${run.slots} 枠 · コンボ ${run.board.length}${run.wardCharges?' · 結界 '+run.wardCharges:''}${run.guardPoints?' · 防御 '+run.guardPoints:''}</small></div>
      <div class="board-relics" aria-label="演算盤のレリック">${relicStrip(p)}</div>
      <div class="board"><span class="slot base${baseGlow?' base-awaken':''}"><small>基礎</small>${run.base}</span>${slots}${tail}</div>
      ${selected!==null||provisional>1?`<div class="actions board-actions">
        ${selected!==null?`<span class="board-picked">${selected+1}枠目 · ${label(run.board[selected])}${enchantmentFor(run.board[selected])?' · '+enchantmentFor(run.board[selected]).name:''}</span>${btn('← 左へ','shift:-1','',selected===0)}${btn('右へ →','shift:1','',selected===run.board.length-1)}${run.canReturn(selected)?btn('手札に戻す','unplay'):''}`:''}
        ${provisional>1?btn('仮置き'+provisional+'枚を戻す','unplayAll'):''}
      </div>`:''}
      <div class="preview"><div><small>通常演算</small><strong title="${exactRat(p.normal)}">${visibleNumber(p.normal)}</strong></div><div><small>レリック適用後</small><strong title="${exactRat(p.result)}">${visibleNumber(p.result)}</strong></div>
      <div class="preview-final"><small>最終ダメージ予測</small><strong title="${p.final}">${compact(p.final)}</strong><small title="${p.impact.dealt}">敵HP −${compact(p.impact.dealt,false)}${p.impact.kind==='barrier'?' · バリア '+p.impact.breaks+'層破壊':p.impact.kind==='gate'?' · 耐久段階まで':''}</small></div></div>
      <div id="reel" class="reel" hidden><div class="reel-head"><span id="stepName"></span><span id="stepCombo"></span></div>
      <div class="reel-display"><i aria-hidden="true"></i><strong id="reelNumber"></strong><small id="reelDigits"></small></div><div class="reel-foot"><div id="stepProgress"></div>${btn('演出をスキップ','skip')}</div></div>
      ${run.lastBurst?`<div class="last-strike" title="${[...relicActivations(run.lastBurst)].map(id=>relics[id].name).join(' ／ ')}">直前BURST <b title="${run.lastBurst.final}">${compact(run.lastBurst.final)}</b> · 敵HP −${compact(run.lastBurst.impact.dealt,false)}</div>`:''}
      ${notice?`<small class="battle-notice" role="status">${moneyText(notice)}</small>`:''}</section>
    <section class="frame hand-frame"><div class="heading"><h2>手札</h2><span class="energy">エネルギー ${run.energy} / ${run.capacity} <small>· ドロー ${run.drawCount}枚</small></span></div>
      ${run.omens>0?`<div class="hint-line">${btn('✧ 星詠みの頁 · 残り'+run.omens,'divine')}</div>`:''}
      <div class="hand" data-hand-return>${run.hand.map((c,i)=>cardButton(c,'hand:'+i,i,!run.canPlay(c))).join('')}</div>
      ${tacticalReadout(p,outcome,response)}
      <div class="controls"><small>仮置きは選択して手札に戻せます。HOLDまたはBURSTで確定。${run.holds===run.holdLimit?' 次はBURST。':''}</small>
      ${battleCommands()}
      </div></section>
    </div>${sidebar(p)}</main>`;
}
const chapter=(tag,title,body)=>`<main><section class="frame chapter"><div class="eyebrow">${tag}</div><h1>${title}</h1>${body}</section></main>`;
const workshopThemes={
  forge:{symbol:'⚒',title:'鍛冶炉の刻印',done:'カードを強化しました'},
  omen:{symbol:'✷',title:'星図の余白',done:'星詠みの頁を1枚獲得しました'},
  shop:{symbol:'⚖',title:'旅商人の取引',done:'30金貨を支払い、カードを獲得しました'},
  fuse:{symbol:'◈',title:'錬成陣の結合',done:'素材2枚を新しいカードにしました'},
  relic:{symbol:'✧',title:'秘宝の譲渡',done:'レリックを獲得しました'},
  remove:{symbol:'♜',title:'刻印の消去',done:'デッキからカードを削除しました'}
};
const rewardCard=c=>`<div class="card result-card t${c.tier}${supportKinds.includes(c.kind)?' spell-card':''}">${cardFace(c)}</div>`;
function rewardChanges({hp,gold}) {
  const delta=(name,n)=>n?`<span>${name} <strong>${n>0?'+':'−'}${Math.abs(n)}</strong></span>`:'';
  return `<div class="reward-changes">${delta('HP',hp)}${delta(coin+'金貨',gold)}</div>`;
}
function cardReward() {
  const {status,card}=run.cardDecision;
  if(status==='none') return '';
  return `<section class="reward-block reward-cards"><h2>演算パネル</h2>${
    status==='pending'?`<p>獲得するパネルを1枚選ぶか、見送れます。</p><div class="choices">${run.offers.map((c,i)=>cardButton(c,'take:'+i,-1,false,relicRewardHints(c,run.deck,run.owned))).join('')}</div>
      ${btn('カードを見送る','cardSkip')}`:
      status==='taken'?`<div class="reward-result">${rewardCard(card)}<p><strong>取得済み</strong><br>デッキに ${label(card)} を追加しました。</p></div>`:
      '<p class="muted">カードは見送り済み</p>'}</section>`;
}
function goldReward() {
  const status=run.goldDecision;
  return `<section class="reward-block reward-gold"><div><h2>${coin}金貨</h2><p><strong>${run.goldReward}</strong> 枚
    ${status==='taken'?' · 取得済み':status==='skipped'?' · 見送り済み':''}</p></div>
    ${status==='pending'?`<div class="actions">${btn(coin+'金貨を受け取る','goldTake','primary')}${btn(coin+'金貨を見送る','goldSkip')}</div>`:''}</section>`;
}
function takeReport() {
  const items=[];
  if(run.cardDecision.status==='taken') items.push('カード '+label(run.cardDecision.card));
  if(run.goldDecision==='taken') items.push(coin+run.goldReward+' 金貨');
  if(run.omenDecision==='taken') items.push('星詠みの頁 1枚');
  if(run.relicDecision==='taken') items.push(relics[run.relicDrop].name);
  const content=items.length?items.join(' ／ '):run.rewardPending?'報酬を選択中':'受け取った報酬はありません。';
  return `<p class="loot-receipt" role="status"><strong>今回の取得</strong>　${content}</p>`;
}
function omenReward() {
  if(run.omenDecision!=='pending') return '';
  return `<section class="reward-block reward-omen"><h2>✧ 星詠みの頁</h2><p>1枚につき1回、手札から最も大きいBURSTになる演算を仮置きできます。</p>
    <div class="actions">${btn('頁を受け取る','omenTake','primary')}${btn('見送る','omenSkip')}</div></section>`;
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
      run.relicDecision==='taken'?`${relicTile(run.relicDrop,0)}<small>取得済み</small>${run.relicEnchantedCard?rewardCard(run.relicEnchantedCard):''}`:'<p>レリックは見送り済み</p>'}
    </div></section>`;
}
function workshopStage(kind,body,reveal=false) {
  const theme=workshopThemes[kind];
  const motion=reveal?' data-motion="'+motionMode()+'"':'';
  return `<div class="workshop workshop-${kind}${reveal?' workshop-reveal':''}"${motion}>
    <div class="workshop-sigil" aria-hidden="true"><span>${theme.symbol}</span><i></i></div><div class="workshop-content">${body}</div></div>`;
}
function workResult() {
  const {kind,sources,result,relic,price,baseGain,omen}=craftResult;
  if(kind==='event') {
    const id=craftResult.event??run.event;
    if(craftResult.exchanged) return eventChapter(id,workshopStage('relic',`
      <div class="exchange-receipt">
        ${exchangeRelic(craftResult.exchanged,'手放したレリック')}
        <span class="workshop-arrow" aria-hidden="true">→</span>
        ${exchangeRelic(relic,'獲得したレリック')}
      </div>
      ${result?rewardCard(result):''}
      ${baseBanner(baseGain??null)}
      <p role="status">レリックの交換が完了しました。</p>
      <div class="actions">${btn('地図へ戻る','craftNext','primary')}</div>`,true),true);
    return eventChapter(id,`<section class="reward-block"><h2>イベントの結果</h2>
      ${result?`<div class="reward-result">${rewardCard(result)}<p><strong>${label(result)}</strong>${craftResult.enchant?' に「'+enchantmentFor(result).name+'」を付与しました。':' をデッキに追加しました。'}</p></div>`:''}
      ${rewardChanges(craftResult)}${omen?'<p>星詠みの頁を '+omen+' 枚獲得しました。</p>':''}${!result&&!omen&&!craftResult.hp&&!craftResult.gold?'<p>HPは満タンでした。</p>':''}
      <p role="status">現在のHP ${run.hp}/100 · ${coin}所持金 ${run.gold} 枚</p>
      <div class="actions">${btn('地図へ戻る','craftNext','primary')}</div></section>`,true);
  }
  const theme=workshopThemes[kind];
  if(kind==='remove'&&sources[0]) {
    const card=sources[0];
    return chapter(routeName(),theme.title,workshopStage(kind,`
      <div class="removal-scene" aria-hidden="true">
        <div class="card removed-card t${card.tier}">${cardFace(card)}</div>
        <i class="removal-ring"></i><i class="removal-cut"></i>
        <span class="removal-sparks">${[[8,46],[-34,-43],[50,-28],[-57,17],[24,-55],[-20,50],[62,26]].map(([x,y])=>
          `<i style="--dx:${x}px;--dy:${y}px"></i>`).join('')}</span>
      </div>
      <p role="status">「${label(card)}」をデッキから削除しました。</p>
      <p class="muted">${coin}${price} 金貨を支払い · デッキ残り ${run.deck.length} 枚</p>
      <div class="actions">${btn('店へ戻る','craftNext','primary')}</div>`,true));
  }
  const previous=price?`<span>${coin}${price} 金貨</span>`:'';
  const output=relic?`<div class="relic-drop"><div><h2>${relicIcon(relic)} ${relics[relic].name} ${rankMark(relic)}</h2><p>${relics[relic].desc}</p>${result?rewardCard(result):''}</div></div>`:
    result?rewardCard(result):'<strong>✧ 星詠みの頁</strong>';
  return chapter(routeName(),theme.title,workshopStage(kind,`
    <div class="workshop-transform">${sources.length?`<div class="craft-materials">${sources.map(rewardCard).join('')}</div>`:`<div class="workshop-sources">${previous}</div>`}
    <span class="workshop-arrow" aria-hidden="true">→</span><div class="workshop-output">${output}${kind==='forge'?'<i class="forge-strike" aria-hidden="true"></i><i class="forge-embers" aria-hidden="true"></i>':''}</div></div>
    ${sources.length&&price?`<p class="muted">${coin}${price} 金貨を支払い</p>`:''}
    ${baseBanner(baseGain??null)}
    <p role="status">${moneyText(theme.done)}</p><div class="actions">${btn(run.phase==='facility'?'店へ戻る':'地図へ戻る','craftNext','primary')}</div>`,true));
}
function useService(action,i,j,mode,digit) {
  sound.unlock();
  const oldBase=run.baseAt();
  const transaction=run.service({action,i,j,mode,digit});
  if(!transaction) {
    const status=dialog.open?dialog.querySelector('[role="status"]'):app.querySelector('[role="status"]');
    if(status) status.innerHTML=moneyText('金貨、素材、または利用回数の条件を満たしていません。');
    return;
  }
  if(dialog.open) dialog.close();
  cue(({buy:'gold',relic:'relic',exchange:'relic',fuse:'fuse',forge:'forge',remove:'remove',heal:'ward'})[action]||'page');
  markBaseGain(oldBase);
  if(transaction.kind) craftResult={...transaction,...(baseGlow?{baseGain:baseGlow}:{})};
  else notice=transaction.message;
  saveProgress();
  render();
  app.querySelector('[data-action="craftNext"]')?.focus({preventScroll:true});
}
function eventChapter(id,content,resolved=false) {
  const definition=events[id];
  const [width,height]=eventCanvasSize;
  return `<main class="event-page"><section class="frame chapter event-chapter">
    <div class="event-hero">
      ${definition?`<canvas data-event-art="${id}" width="${width}" height="${height}" aria-hidden="true"></canvas>`:''}
      <div class="event-heading"><div class="eyebrow">${routeName()} · ランダムイベント</div>
        <h1>${esc(definition?.name??'旅先の出来事')}</h1></div>
    </div><div class="event-content">${!resolved&&definition?`<p class="event-story">${moneyText(definition.story)}</p>`:''}${content}</div>
    </section></main>`;
}
function exchangeRelic(id,status,action='') {
  const {name,desc}=relics[id];
  return `<article class="relic-option exchange-relic" data-exchange-relic="${id}">
    <small>${status}</small><h3>${relicIcon(id)} ${esc(name)} ${rankMark(id)}</h3>
    <p>${esc(desc)}</p>${action}</article>`;
}
function exchangeChoices(source) {
  if(!source) return '<p class="muted">手放すレリックを選ぶと、交換候補と効果が表示されます。</p>';
  const choices=run.eventExchanges(source);
  return `${exchangeRelic(source,'手放すレリック')}
    <div class="exchange-candidates">${choices.map((id,i)=>
      exchangeRelic(id,'交換で獲得',btn('「'+esc(relics[id].name)+'」に交換','eventExchange:'+i,'primary'))).join('')}</div>`;
}
function eventPreview() {
  if(events[run.event]?.exchange) {
    const sources=run.owned.filter(id=>run.exchangePool(id).length);
    const form=sources.length?`<label class="exchange-label" for="exchangeSource">手放すレリック
      <select id="exchangeSource"><option value="">選んでください</option>${sources.map(id=>
        `<option value="${id}">${esc(relics[id].name)} · ${relicRanks[relics[id].rank].name}</option>`).join('')}</select></label>
      <div id="exchangeChoices" class="exchange-choices">${exchangeChoices('')}</div>`:'<p>交換できるレリックがありません。</p>';
    return eventChapter(run.event,`${form}<div class="actions">${btn('交換せずに立ち去る','service:decline')}</div>`);
  }
  const choices=run.eventOffers.map((offer,i)=>`<section class="reward-block event-choice">
    <h2>${moneyText(offer.offer)}</h2>
    ${offer.result?rewardCard(offer.result):''}${rewardChanges(offer)}
    ${offer.enchant?`<p>${enchantments[offer.enchant].description}</p>`:''}
    ${!offer.available?'<p class="muted">'+moneyText(offer.enchant?'金貨または付与できる演算カードが足りません。':'必要なHPまたは金貨が足りません。')+'</p>':''}
    ${btn(offer.enchant?'カードを選ぶ':'この選択を受ける','eventChoice:'+i,'primary',!offer.available)}</section>`).join('');
  return eventChapter(run.event,`<div class="event-choices">${choices}</div>
    <div class="actions">${btn('見送る','service:decline')}</div>`);
}
function facility() {
  const f=run.facility;
  if(f==='event') return eventPreview();
  const [width,height]=eventCanvasSize;
  return `<main class="event-page"><section class="frame chapter event-chapter">
    <div class="event-hero facility-hero ${f}"><canvas data-event-art="${f}" width="${width}" height="${height}" aria-hidden="true"></canvas>
    <div class="event-heading"><div class="eyebrow">${routeName()}</div><h1>${places[f].name}</h1></div></div>
    <div class="event-content">${f==='rest'?`<p>HP ${run.hp}/100 · 回復か鍛冶を1回選択</p>
      <div class="actions">${btn('HPを35回復','service:heal','primary')}${btn('カードを強化','forge')}</div>`:shopContents()}
    <p role="status">${moneyText(notice)}</p><div class="actions">${btn('地図へ戻る','leave','primary')}</div></div>
    </section></main>`;
}
function shopContents() {
  const unable=key=>run.shopUsed[key]||run.gold<prices[key];
  const tabs=[['cards','カード'],['relics','レリック'],['forge','工房']];
  let contents;
  if(shopTab==='cards') contents=`<h2>カード各 ${coin}${prices.buy} 金貨</h2><div class="choices shop-cards">${run.shop.map((c,i)=>
    c?cardButton(c,'buy:'+i,-1,unable('buy')):'<span class="sold">売約済み</span>').join('')}</div>
    ${run.shopOmen?btn('✧ 星詠みの頁を買う · '+coin+prices.omen+' 金貨','service:omen','',unable('omen')):''}`;
  else if(shopTab==='relics') contents=`<h2>レリック · ${run.shopUsed.relic?'購入済み':coin+prices.relic+' 金貨／1個まで'}</h2>
    <div class="choices">${run.stockRelics.map((id,i)=>btn(relicIcon(id)+' '+relics[id].name+' '+rankMark(id)+'<small>'+relics[id].desc+'</small>','relicBuy:'+i,'',unable('relic'))).join('')||'在庫なし'}</div>`;
  else contents=`<h2>工房 · デッキ下限12枚</h2><div class="actions">
    ${btn(run.shopUsed.fuse?'合成済み':'カードを合成 · '+coin+prices.fuse+' 金貨','fuse','',unable('fuse')||run.deck.length<=12)}
    ${btn(run.shopUsed.remove?'削除済み':'削除するカードを選ぶ · '+coin+prices.remove+' 金貨','remove','',unable('remove')||run.deck.length<=12)}</div>`;
  return `<div class="shop-head"><p>${coin}所持金 <b>${run.gold}</b></p><div class="actions" aria-label="売り場">${tabs.map(([key,name])=>
    `<button data-action="shopTab:${key}" aria-pressed="${key===shopTab}">${name}</button>`).join('')}</div></div>${contents}`;
}
let crafting=null, enchantSelection=null;
function openEnchant(id,confirm) {
  if(!id) return false;
  const eligible=run.deck.map((card,index)=>({card,index})).filter(({card})=>canEnchant(card,id));
  if(!eligible.length) return false;
  enchantSelection={index:null,confirm};
  const enchant=enchantments[id];
  modal('エンチャント · '+enchant.name,`<p>${enchant.description} 付与する演算カードを1枚選んでください。</p>
    <div class="deck-cards craft-stock">${eligible.map(({card,index})=>
      `<button type="button" class="card t${card.tier}" data-enchant-target="${index}" aria-pressed="false" aria-label="${index+1}枚目 ${label(card)}">${cardFace(card)}</button>`).join('')}</div>
    <button type="button" class="primary" data-enchant-confirm disabled>付与を確定</button>`);
  dialog.classList.add('craft-dialog','enchant-dialog');
  return true;
}

function openCraft(kind) {
  crafting={kind,i:null,j:null,mode:null,digit:0,filter:'all'};
  const titles={fuse:'カード合成',forge:'カード強化',remove:'削除するカードを選ぶ'};
  modal(titles[kind],'<div id="craftPicker"></div>');
  dialog.classList.add('craft-dialog');
  dialog.classList.toggle('remove-dialog',kind==='remove');
  renderCraft();
  if(kind==='remove') dialog.querySelector('#removeFilter').focus({preventScroll:true});
}
function craftCard(card,index,disabled,pressed) {
  return `<button type="button" class="card t${card.tier}${supportKinds.includes(card.kind)?' spell-card':''}" data-craft-card="${index}" aria-label="${index+1}枚目 ${label(card)} ${cardEffect(card)} 消費${card.cost}${card.upgraded?' 強化済み':''}" aria-pressed="${pressed}" ${disabled?'disabled':''}>${cardFace(card)}</button>`;
}
function renderRemoval(keepScroll) {
  const {i,filter}=crafting;
  const picked=run.deck[i];
  const candidates=run.deck.map((card,index)=>({card,index}))
    .filter(({card})=>filter==='all'||card.kind===filter)
    .sort((a,b)=>deckKinds.indexOf(a.card.kind)-deckKinds.indexOf(b.card.kind)||a.index-b.index);
  const container=dialog.querySelector('#craftPicker');
  const scroll=keepScroll?container.querySelector('.craft-stock')?.scrollTop??0:0;
  container.innerHTML=`<p>削除するカードを1枚選びます。</p>
    <div class="remove-toolbar">
      <label>種類 <select id="removeFilter">${['all',...deckKinds].map(kind=>
        `<option value="${kind}" ${kind===filter?'selected':''}>${deckNames[kind]??'すべて'}</option>`).join('')}</select></label>
      <small>${candidates.length} / ${run.deck.length}枚</small>
    </div>
    <div class="craft-stock deck-cards" aria-label="削除候補">${candidates.length?candidates.map(({card,index})=>
      craftCard(card,index,false,index===i)).join(''):'<p>この種類のカードはありません。</p>'}</div>
    <div class="craft-confirm removal-confirm">
      <div class="remove-target">${picked?rewardCard(picked):'<span class="remove-placeholder" aria-hidden="true">◇</span>'}</div>
      <div class="remove-details"><p aria-live="polite">${picked?'削除対象 · '+label(picked)+(picked.upgraded?'（強化済み）':''):'カード未選択'}</p>
        <small>${coin}料金 ${prices.remove}金貨 · ${coin}所持金 ${run.gold}金貨</small>
        <small>デッキ ${run.deck.length}枚${picked?' → '+(run.deck.length-1)+'枚':''} · 下限12枚</small>
        <p role="status"></p>
        <button type="button" class="primary" data-craft-confirm ${picked?'':'disabled'}>削除を確定</button>
      </div>
    </div>`;
  container.querySelector('.craft-stock').scrollTop=scroll;
}
function renderCraft(keepScroll=true) {
  if(crafting.kind==='remove') return renderRemoval(keepScroll);
  const {kind,i,j,mode,digit}=crafting;
  const fusion=kind==='fuse', first=run.deck[i];
  const modes=['power','adjust','digit'];
  const support=first&&supportKinds.includes(first.kind);
  const titles=[support?'効果強化':'火力型',support?'消費軽減':'数字調整型','末尾刻印'];
  const results=modes.map(key=>upgraded(first,key,digit));
  const result=fusion?fused(first,run.deck[j]):mode&&upgraded(first,mode,digit);
  const available=(card,index)=>fusion
    ?i===null?run.deck.some((other,at)=>at!==index&&fused(card,other)):index===i||Boolean(fused(first,card))
    :modes.some(key=>upgraded(card,key,0)||key==='digit'&&upgraded(card,key,9));
  const tiles=run.deck.map((card,index)=>craftCard(card,index,!available(card,index),index===i||index===j)).join('');
  const options=!fusion&&first?`<div class="forge-options">${results.map((card,index)=>`<div>
    <button type="button" data-craft-mode="${modes[index]}" aria-pressed="${mode===modes[index]}" ${card?'':'disabled'}>${titles[index]}</button>
    ${card?rewardCard(card):''}</div>`).join('')}</div>
    ${!support?`<label>末尾の数字 <select id="craftDigit">${Array.from({length:10},(_,n)=>`<option ${digit===n?'selected':''}>${n}</option>`).join('')}</select></label>`:''}`:'';
  const container=dialog.querySelector('#craftPicker');
  const oldScroll=container.querySelector('.craft-stock')?.scrollTop??0;
  container.innerHTML=`<p>${fusion?(first?'同じ系統の素材をもう1枚選ぶ。':'素材となるカードを2枚選ぶ。'):'強化したいカードを選ぶ。'}</p>
    <div class="craft-stock deck-cards">${tiles}</div>${options}
    <div class="craft-confirm">${result?`<span>完成プレビュー</span>${rewardCard(result)}`:''}
    <p role="status"></p><button type="button" class="primary" data-craft-confirm ${result?'':'disabled'}>${fusion?'合成を確定 · '+coin+prices.fuse+' 金貨':'強化を確定'}</button></div>`;
  container.querySelector('.craft-stock').scrollTop=oldScroll;
}
const tilePixels={
  fight:'M11 0h3v3h-2v3h-2v2H8v2h2v2H8v-2H6v2H4v2H1v-3h2V9h2V7h2V5h2V2h2z',
  event:'M2 1h10v2h1v8h-2v2H1V9h2V3H2zm3 3v1h5V4zm0 3v1h5V7z',
  rest:'M6 1h2v2h1v2h1v2h1v2h1v2h1v2H1v-2h1V9h1V7h1V5h1V3h1zm1 5L4 12h6z',
  elite:'M7 0h1v2h2v2h2v2h2v2h-2v2h-2v2H8v2H7v-2H5v-2H3V8H1V6h2V4h2V2h2zm0 5v4h1V5z',
  shop:'M2 1h10v2h1v2h1v2h-2v6H2V7H0V5h1V3h1zm2 7v4h3V8zm5 0v2h2V8z',
  boss:'M1 2h2v2h2v2h1V3h1V1h1v2h1v3h1V4h2V2h2v6h-1v4H2V8H1zm3 7v1h7V9z'
};
const tileIcon=kind=>`<svg class="tile-icon" viewBox="0 0 15 15" aria-hidden="true" shape-rendering="crispEdges"><path fill-rule="evenodd" d="${tilePixels[kind]}"/></svg>`;
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
      ${tileIcon(n.kind)}<small>${place.name}</small></button>`;
  }).join('');
  return chapter(routeName(),'巡歴の地図',`<div class="map-heading"><p>下から上へ、光るマスを選ぶ。</p><p>HP ${run.hp}/100 · ${coin}${run.gold} 金貨${run.omens?' · 星詠みの頁 '+run.omens+'枚':''}</p></div>
    ${notice?`<p role="status">${moneyText(notice)}</p>`:''}
    <div class="route-map">${actBackdrop()}<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${links}</svg>${nodes}</div>
    <div class="map-legend">${Object.entries(places).map(([kind,p])=>`<span>${tileIcon(kind)} ${moneyText(p.desc)}</span>`).join('')}</div>`);
}
const checkpointLabels={map:'地図',battle:'戦闘中',reward:'勝利報酬',facility:'施設',clear:'EXTRA挑戦前'};
function view() {
  if(!run) return `<main><section class="frame title"><div><div class="eyebrow">演算魔術譚 · v1.4.2</div><div class="rule"></div>
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
    case 'reward':return chapter(routeName(),'勝利報酬',`${baseBanner()}<p>HP ${run.hp}/100 ${run.victoryHeal?'（勝利時回復 +'+run.victoryHeal+'）':''} · ${coin}所持金 ${run.gold} 枚</p>
      ${damageReceipt()}
      <div class="loot-grid${run.relicDrop?' has-relic':''}"><div>${cardReward()}${goldReward()}${omenReward()}</div>${relicReward()}</div>${takeReport()}
      ${btn('ページをめくる','advance','primary',run.rewardPending)}`);
    case 'map':return mapView();
    case 'facility':return facility();
    default: {
      const title={loss:'探索終了',clear:'無量門突破',win:'EXTRA 突破'}[run.phase];
      return chapter('DAMAGE BREAKER',title,`<p>シード ${esc(run.seed)}</p>${run.phase==='loss'?`<p>${routeName()} · 第${run.stage}地点 · ${run.enemy.name}との戦闘で敗北</p>${notice?`<p role="status">${esc(notice)}</p>`:''}`:''}<h2>今回の最大ダメージ</h2>
        <p class="record">${fmt(run.stats.max)}</p><p class="muted">${esc(run.stats.formula)}</p>
        <h2>コンボ ${run.stats.combo} · ∞ ${run.stats.infinity}回 · ${run.stats.turns}ターン</h2>
        <div class="actions">${run.phase==='clear'?btn('EXTRAへ挑む','extra','primary'):''}${btn('タイトルへ','title')}${btn('記録帳','records')}</div>`);
    }
  }
}
function render() {
  const mode=motionMode();
  app.dataset.motion=mode;
  app.innerHTML=`<header><div class="brand">◇ DAMAGE BREAKER</div><button type="button" class="menu-toggle" data-action="menu" aria-controls="game-nav" aria-expanded="false">メニュー</button><nav id="game-nav" aria-label="ゲームメニュー">${run&&run.phase!=='battle'?btn('デッキ '+run.deck.length,'deck'):''}${run&&suspended?btn('中断','pause'):''}${btn('遊び方','help')}${btn('数字の単位・読み方','numberUnits')}${btn('記録帳','records')}${btn('設定','settings')}</nav></header>${view()}
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
  const actArt=app.querySelector('[data-act-art]');
  if(actArt) paintEvent(actArt,actArt.dataset.actArt);
  const titleArt=app.querySelector('.title canvas');
  if(titleArt) paint(titleArt,2,1);
  const page=craftResult?'craft':run?.phase??'title';
  if(lastPage!==null&&lastPage!==page&&mode!=='off') {
    const chapter=app.querySelector('main');
    chapter.classList.add('turn-page');
    chapter.classList.toggle('turn-fast',mode==='fast');
    chapter.addEventListener('animationend',function finishPage(e) {
      if(e.target!==chapter||!['turn-page','mobile-arena-arrival'].includes(e.animationName)) return;
      chapter.classList.remove('turn-page','turn-fast');
      chapter.removeEventListener('animationend',finishPage);
    });
  }
  if(compactScreen.matches&&lastPage!==page) {
    const route=page==='map'?app.querySelector('.map-node.live'):null;
    if(route&&route.getBoundingClientRect().bottom>window.innerHeight) route.scrollIntoView({block:'center'});
    else window.scrollTo(0,0);
  }
  lastPage=page;
  baseGlow=null;
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
const deckNames={...types,ward:'結界',clean:'浄化',spell:'スペル（全種）'};
function deckContents() {
  const stock=[...run.deck].sort((a,b)=>deckKinds.indexOf(a.kind)-deckKinds.indexOf(b.kind)||a.value-b.value||a.cost-b.cost);
  const shown=stock.filter(card=>deckFilter==='all'||card.kind===deckFilter||(deckFilter==='spell'&&supportKinds.includes(card.kind)));
  const pages=Math.max(1,Math.ceil(shown.length/12));
  return `<div class="deck-toolbar"><label>種類 <select id="deckFilter">
    ${['all','spell',...deckKinds].map(kind=>`<option value="${kind}" ${kind===deckFilter?'selected':''}>${deckNames[kind]??'すべて（種類順）'}</option>`).join('')}</select></label>
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
function action(command,target) {
  const [name,arg]=command.split(':');
  if(sequence) {if(name==='skip') sequence.abort();return;}
  const menu=app.querySelector('.menu-toggle');
  if(name==='menu') {
    menu.setAttribute('aria-expanded',String(menu.getAttribute('aria-expanded')!=='true'));
    return;
  }
  if(menu.getAttribute('aria-expanded')==='true') {
    menu.setAttribute('aria-expanded','false');
    menu.focus({preventScroll:true});
  }
  sound.unlock();
  const i=Number(arg);
  if(name==='help') return modal('遊び方',`<p>手札の演算を盤に置き、基礎攻撃力から左順に計算します。地図は下から上へ、光っているマスを選びます。たとえば 20 → +10 → ×3 は90です。</p>
    <p>演算盤のカードにフォーカスして、左右キーで移動、Deleteで仮置きを手札に戻せます。確定前のカードは「仮置き○枚を戻す」でまとめて戻せます。</p>
    <p>HOLDは盤を維持して新しい手札を引きます。敵はHOLD後、またはBURSTで生き残った後に予告どおり行動します。</p>
    <p>反撃減衰は、予告欄の順序で有効な演算を隣接させてBURSTすると成立します。敵が生き残ったときに反撃や妨害を弱めます。成立は各戦闘で1回です。</p>
    <p>防御・結界・浄化は手札から直接使うスペルです。エンチャントは演算カードに1つ。再現は同じ演算を2回行い、コンボでは1枚として数えます。エナジーや手札を得た配置は確定します。</p>
    <p>差し引きで負になった値や分数も計算中は保持します。装甲適用後、負のダメージは0、小数は切り捨てです。</p>
    <p>星詠みの頁は、手札の演算カードを現在のエネルギーと空き枠の範囲で並べ、レリック込みの最大ダメージになる候補を仮置きします。スペルは手動で使えます。ダメージを伸ばせた場合に1枚消費します。</p>
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
    shopTab=arg;render();app.querySelector('[data-action="shopTab:'+arg+'"]').focus({preventScroll:true});return;
  }
  if(name==='relic') return modal(relics[arg].name,`<p class="relic-detail">${relicIcon(arg)} ${rankMark(arg)} ${relics[arg].desc}</p>`);
  if(name==='history') return modal('計算履歴',run.history.map(p=>`<details><summary>${fmt(p.final)} · ${esc(p.formula)}</summary>
    <ol>${p.steps.map(s=>`<li>${label(s.card)}${s.op?.kind!==s.card.kind?' → '+(s.op?label(s.op):'無効'):''} → ${s.firstResult?rat(s.firstResult)+' → 再現 → ':''}${rat(s.result)}</li>`).join('')}
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
  const hasFocus=app.contains(document.activeElement)&&document.activeElement.matches('button');
  const keepNotice=name==='craftNext'||name==='slot'||name==='shift'||name==='hand'||name==='unplay'||name==='unplayAll';
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
    case 'unplayAll': {
      const cards=run.board.filter((_,at)=>run.canReturn(at));
      for(const card of cards) run.returnToHand(run.board.indexOf(card));
      if(cards.length) {
        notice='仮置き '+cards.length+' 枚を手札に戻しました。';
        feedback={selector:'.hand [data-hand]:last-child',className:'card-returned'};
        selected=null;
        cue('undo');
      }
      break;
    }
    case 'shift': {
      if(selected===null) break;
      const to=selected+i;
      feedback=moveCard(selected,to);
      if(feedback) selected=to;
      break;
    }
    case 'hold': void showHold();return;
    case 'burst': void showBurst();return;
    case 'take':
      if(run.takeCard(i)) {cue('mystic');feedback={selector:'.reward-cards .reward-result',className:'reward-claimed'};}
      break;
    case 'cardSkip':run.skipCard();break;
    case 'goldTake':
      if(run.chooseGold(true)) {cue('gold');feedback={selector:'.reward-gold',className:'reward-claimed'};}
      break;
    case 'goldSkip':run.chooseGold(false);break;
    case 'omenTake':
      if(run.chooseOmen(true)) {cue('mystic');feedback={selector:'.loot-receipt',className:'reward-claimed'};}
      break;
    case 'omenSkip':run.chooseOmen(false);break;
    case 'divine':void useDivination();return;
    case 'relicTake': {
      const relic=[run.relicDrop,run.relicAlternative][i];
      if(target===undefined&&openEnchant(relics[relic]?.grantEnchant,at=>action(command,at))) return;
      if(run.chooseRelic(true,i,target)) {
        if(dialog.open) dialog.close();
        cue('relic');
        feedback={selector:'.relic-drop',className:'reward-claimed'};
      }
      break;
    }
    case 'relicSkip':run.chooseRelic(false);break;
    case 'advance':run.advance();cue('page');break;
    case 'route':
      if(run.route(arg)) {shopTab='cards';cue(run.phase==='battle'?'draw':'page');}
      break;
    case 'leave':run.leaveNode();break;
    case 'extra':run.extra();cue('draw');break;
    case 'craftNext':craftResult=null;break;
    case 'buy':useService('buy',i);return;
    case 'relicBuy':
      if(target===undefined&&openEnchant(relics[run.stockRelics[i]]?.grantEnchant,at=>action(command,at))) return;
      useService('relic',i,target);return;
    case 'service':useService(arg);return;
    case 'eventChoice':
      if(target===undefined&&openEnchant(run.eventOffers[i]?.enchant,at=>action(command,at))) return;
      useService('event',i,target);return;
    case 'eventExchange': {
      const source=app.querySelector('#exchangeSource')?.value;
      if(target===undefined&&openEnchant(relics[run.eventExchanges(source)[i]]?.grantEnchant,at=>action(command,at))) return;
      useService('exchange',i,target,source);return;
    }
    case 'forge':openCraft('forge');return;
    case 'remove':openCraft('remove');return;
    case 'fuse':openCraft('fuse');return;
  }
  markBaseGain(oldBase);
  saveProgress();
  render();
  animateFeedback(feedback);
  if(hasFocus&&run?.phase==='battle') {
    const focus=name==='shift'||name==='slot'?selected!==null?`[data-board="${selected}"]`:name==='slot'?`[data-board="${i}"]`:null:
      name==='hand'?'.hand button:not(:disabled)':
        name==='unplay'||name==='unplayAll'?feedback?.selector:null;
    if(focus) app.querySelector(focus)?.focus({preventScroll:true});
  }
}
async function useDivination() {
  if(run.phase!=='battle'||!(run.omens>0)) return;
  const control=new AbortController();
  sequence=control;
  const search=readDivination(run);
  const hint=app.querySelector('[data-action="divine"]');
  hint.textContent='星図を読み解いています…';
  app.querySelectorAll('button:not(:disabled)').forEach(button=>button.disabled=true);
  try {
    let next=search.next();
    while(!next.done&&!control.signal.aborted) {
      await new Promise(resolve=>setTimeout(resolve,0));
      if(!control.signal.aborted) next=search.next();
    }
    if(control.signal.aborted) return;
    const {order,damage,cost,limited}=next.value;
    if(cost===0) {
      notice=limited?'星詠み · 探索上限に達しました。改善案が見つからなかったため頁は保持しました。':
        '星詠み · いまの手札と枠ではこれ以上伸ばせません。頁は保持しました。';
      return;
    }
    const oldBoard=new Set(run.board);
    for(const [at,card] of order.entries()) if(!oldBoard.has(card)) run.play(run.hand.indexOf(card),at);
    run.omens--;
    notice='星詠み'+(limited?'（探索上限内の推奨）':'')+' · '+(order.length-oldBoard.size)+'枚を仮置き · BURST予測 '+compact(damage);
    selected=null;
    saveProgress();
    cue('mystic');
  } finally {
    sequence=null;
    render();
    animateFeedback({selector:'.board-frame',className:'divination-glow'});
  }
}
function playCard(index,at=run.board.length) {
  const card=run.hand[index];
  if(!run.play(index,at)) return null;
  cue(cardCue(card));
  if(supportKinds.includes(card.kind)) {
    notice=cardEffect(card);
    return card.kind==='clean'?{selector:'.board-frame',className:'support-applied'}:{selector:'.enemy',className:'barrier-cast'};
  }
  const enchant=enchantmentFor(card);
  if(enchant?.energy||enchant?.draw) notice=enchant.name+' · '+enchant.description+' 配置確定。';
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
  return {selector:'.board-card[data-at="'+to+'"]',className:to>from?'card-shift-right':'card-shift-left'};
}
function animateFeedback(feedback) {
  if(feedback&&motionMode()!=='off') app.querySelector(feedback.selector)?.classList.add(feedback.className);
}
app.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');
  if(b&&!b.disabled) action(b.dataset.action);

});
app.addEventListener('change',e=>{
  if(e.target.id==='exchangeSource') app.querySelector('#exchangeChoices').innerHTML=exchangeChoices(e.target.value);
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
  dragging=null;selected=null;saveProgress();render();animateFeedback(feedback);
});
app.addEventListener('dragend',()=>{dragging=null;});
dialog.addEventListener('change',e=>{
  const {id,checked,value}=e.target;
  if(id==='craftDigit'&&crafting) {
    crafting.digit=Number(value);
    renderCraft();
    dialog.querySelector('#craftDigit').focus({preventScroll:true});
    return;
  }
  if(id==='deckFilter') {deckFilter=value;deckPage=0;refreshDeck('#deckFilter');return;}
  if(id==='removeFilter'&&crafting?.kind==='remove') {
    crafting.filter=value;
    crafting.i=null;
    renderCraft(false);
    dialog.querySelector('#removeFilter').focus({preventScroll:true});
    return;
  }
  if(!['scientific','motion','mute'].includes(id)) return;
  book.prefs[id]=id==='motion'?value:checked;
  if(id==='mute') {sound.unlock();sound.refresh();}
  persist();render();
});
dialog.addEventListener('close',()=>{if(!dialog.open) enchantSelection=null;});
dialog.addEventListener('click',e=>{
  const enchantOption=e.target.closest('[data-enchant-target],[data-enchant-confirm]');
  if(enchantOption&&enchantSelection&&!enchantOption.disabled) {
    if(enchantOption.hasAttribute('data-enchant-confirm')) enchantSelection.confirm(enchantSelection.index);
    else {
      enchantSelection.index=Number(enchantOption.dataset.enchantTarget);
      for(const btn of dialog.querySelectorAll('[data-enchant-target]')) btn.setAttribute('aria-pressed',String(btn===enchantOption));
      dialog.querySelector('[data-enchant-confirm]').disabled=false;
    }
    return;
  }
  const option=e.target.closest('[data-craft-card],[data-craft-mode],[data-craft-confirm]');
  if(option&&crafting&&!option.disabled) {
    const {kind,i,j,mode,digit}=crafting;
    if(option.hasAttribute('data-craft-confirm')) {useService(kind,i,j,mode,digit);return;}
    if(option.dataset.craftMode) crafting.mode=option.dataset.craftMode;
    else {
      const index=Number(option.dataset.craftCard);
      if(kind!=='fuse') {
        crafting.i=kind==='remove'&&i===index?null:index;
        crafting.mode=null;
      } else if(i===index) {
        crafting.i=null;crafting.j=null;
      } else if(i===null) crafting.i=index;
      else crafting.j=j===index?null:index;
    }
    const focus=option.dataset.craftMode?'[data-craft-mode="'+option.dataset.craftMode+'"]':'[data-craft-card="'+option.dataset.craftCard+'"]';
    renderCraft();
    dialog.querySelector(focus)?.focus({preventScroll:true});
    return;
  }
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

render();

function reactionText(move,message,hpLost,outcome) {
  const {blocked,absorbed,broken,attenuationEffect,hitDetails}=outcome;
  const hits=attackHits(move);
  const details=[];
  if(attenuationEffect&&hits) hpLost=hitDetails.reduce((total,hit)=>total+hit.lost,0);
  if(hits||hpLost) details.push(hpLost?'術師 HP −'+hpLost:'術師 HP変化なし');
  if(absorbed) details.push('防御 '+absorbed);
  if(broken) details.push('結界 '+broken+'層破壊');
  if(blocked) details.push('結界が妨害を防ぎました');
  else if(attenuationEffect) details.push(attenuationEffectText(move,outcome));
  else if(!hits) details.push(message);
  else if(attackPatterns[move.kind]?.penalty&&move.kind!=='shatter') details.push(message.split(' ＋ ').at(-1));
  else if(move.kind!=='attack') details.push(attackPatterns[move.kind].name);
  return details.join(' · ');
}
const enemyCues={cleave:'melee',wave:'wave',meteor:'meteor',dust:'hex',flare:'flare',eclipse:'eclipse',
  lock:'seal',fracture:'seal',drain:'drain',wither:'drain',attack:'melee',shatter:'seal'};
function enemyReaction(move,outcome,hit) {
  cue(enemyCues[move.kind]??(hit?'melee':'hex'));
  if(outcome.blocked||hit?.defended||outcome.broken) cue(outcome.broken?'barrier':'ward');
}
async function showEnemyReaction(field,move,message,hpLost,outcome,signal) {
  const fast=motionMode()==='fast';
  const incoming=field.querySelector('#incoming');
  const hero=field.querySelector('.hero');
  const details=outcome.hitDetails.length?outcome.hitDetails:[null];
  field.classList.remove('player-strike','player-landed','player-blocked','player-miss','gate-shatter','foe-barrier-struck');
  for(const [i,hit] of details.entries()) {
    if(signal.aborted) return;
    const last=i===details.length-1;
    const guarded=Boolean(hit?.defended||(last&&outcome.blocked));
    const shattered=last&&outcome.broken>0;
    field.classList.remove('enemy-strike','enemy-magic','ward-answer','hero-barrier-struck','barrier-shatter');
    void field.offsetWidth;
    field.classList.add(hit?'enemy-strike':'enemy-magic');
    field.dataset.move=outcome.blocked&&!hit?'ward':move.kind;
    field.dataset.hit=String(i+1);
    field.classList.toggle('ward-answer',guarded);
    field.classList.toggle('hero-barrier-struck',guarded||shattered);
    field.classList.toggle('barrier-shatter',shattered);
    const prefix=details.length>1?`${i+1} / ${details.length} 撃 · `:'';
    incoming.textContent=hit?prefix+(hit.lost?'HP −'+hit.lost:'防御')+(shattered?' · 結界 −'+outcome.broken:''):
      reactionText(move,message,hpLost,outcome);
    if(hit) {
      hero.dataset.defense=run.wardCharges||shattered||outcome.blocked?'ward':hit.guardLeft||guarded?'guard':'none';
      updateHeroDisplay(field,hit.hp,run.maxHp);
    }
    else updateHeroDisplay(field);
    enemyReaction(move,last?outcome:{},hit);
    await clock(fast?170:details.length>1?330:580,signal);
  }
  hero.dataset.defense=run.wardCharges?'ward':run.guardPoints?'guard':'none';
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
function updateHeroDisplay(field,hp=run.hp,maxHp=run.maxHp) {
  field.querySelector('.hero-hp span').style.width=100*hp/maxHp+'%';
  field.querySelector('#heroHp').textContent='HP '+hp+' / '+maxHp;
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
  if(mode==='off'){enemyReaction(move,outcome,outcome.hitDetails[0]);if(run.phase==='battle') cue('draw');render();return;}
  const control=new AbortController();
  sequence=control;
  const field=app.querySelector('.enemy');
  app.querySelectorAll('button:not(:disabled)').forEach(button=>button.disabled=true);
  const skip=app.querySelector('.skip-sequence');
  skip.hidden=false;
  skip.disabled=false;
  skip.focus({preventScroll:true});
  if(compactScreen.matches) field.scrollIntoView({block:'nearest'});
  try {await showEnemyReaction(field,move,prediction,hpBefore-run.hp,outcome,control.signal);}
  finally {
    sequence=null;
    if(!control.signal.aborted&&run.phase==='battle') cue('draw');
    render();
    app.querySelector('[data-action="hold"]:not(:disabled),[data-action="burst"]')?.focus({preventScroll:true});
  }
}
async function showBurst() {
  const base=run.base, armor=run.enemy.armor, move=run.next;
  const hpBefore=run.hp;
  const prediction=intentText(move);
  const p=run.burst();
  if(!p) return;
  const {status,outcome}=p.response;
  const hpLost=outcome?hpBefore-outcome.hp:0;
  const bonuses=status==='success'&&run.hp>0?[
    ['エナジー',run.turnEnergy],['ドロー',run.turnDraw],
    ['防御',run.guardPoints-outcome.guard],['HP回復',run.hp-outcome.hp]
  ].filter(([,n])=>n).map(([label,n])=>label+'＋'+n):[];
  const attenuation=status==='success'?'減衰成立'+(bonuses.length?'　次ターン '+bonuses.join('／'):''):status==='failure'?'減衰失敗':'';
  const best=p.final>BigInt(book.best.max);
  if(best) {
    run.battleRecord={final:p.final,formula:run.lastBurst.formula};
    book.best={max:String(p.final),formula:run.stats.formula,seed:run.seed};
  }
  selected=null;
  const strike=p.impact.kind==='barrier'?'敵バリア '+p.impact.breaks+'層破壊':p.impact.kind==='gate'?'耐久段階を突破 · '+compact(p.impact.dealt,false):'BURST '+compact(p.final);
  notice=strike+(best?' · 新記録':'')+(outcome?' ／ '+[attenuation,reactionText(move,prediction,hpLost,outcome)].filter(Boolean).join(' · '):'');
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
      const skip=compactScreen.matches?app.querySelector('.skip-sequence'):reel.querySelector('button');
      skip.hidden=false;
      skip.focus({preventScroll:true});
      if(compactScreen.matches) reel.scrollIntoView({block:'nearest'});
      const strip=app.querySelector('.board-relics');
      strip.innerHTML=relicStrip(p,true);
      let lit=null, firingRelic=null;
      for(const [i,step] of steps.entries()) {
        if(signal.aborted) break;
        lit?.classList.remove('resolving','enchant-firing');
        firingRelic?.classList.remove('relic-pulsing');
        lit=step.index===undefined?null:app.querySelector('[data-calc="'+step.index+'"]');
        lit?.classList.add('resolving');
        if(step.type==='repeat') lit?.classList.add('enchant-firing');
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
        if(step.type!=='impact') cue(step.type==='relic'?'relic':step.type==='enemy'?'hex':step.type==='repeat'?'mystic':cardCue(p.steps[step.index].card),{level});
        const {samples,duration}=reelTiming(prior,step.value,step.type,mode==='fast');
        await clock(duration,signal,position=>{
          const value=reelValue(prior,step.value,Math.floor(position*samples),samples);
          showValue(value,step.type==='impact'&&position===1&&p.final>CAP);
        });
        prior=step.value;
      }
      lit?.classList.remove('enchant-firing');
      const attack=attackAnimation(p.final);
      if(!signal.aborted) {
        field.classList.remove('charging');
        if(compactScreen.matches) field.scrollIntoView({block:'start'});
        field.dataset.force=impactForce(p);
        const visual=burstVisual([p.final,1n],p.final>CAP);
        field.dataset.burstLevel=visual.level;
        field.style.setProperty('--burst-hue',visual.hue);
        field.dataset.attackMotif=attack.motif;
        field.dataset.attackDigits=attack.digits;
        field.style.setProperty('--attack-color',`hsl(${attack.hue} 94% 69%)`);
        field.style.setProperty('--attack-power',attack.power);
        field.style.setProperty('--cast-angle',attack.angle+'deg');
        field.style.setProperty('--cast-lift',-attack.lift+'px');
        field.style.setProperty('--attack-time',attack.impact+'ms');
        field.style.setProperty('--flight',(mode==='fast'?65:attack.flight)+'ms');
        field.querySelector('.burst-sparks').innerHTML=Array.from({length:mode==='fast'?Math.min(10,attack.sparks):attack.sparks},(_,i)=>{
          const angle=i*2.39996+attack.digits*.17,r=attack.reach*(.48+(i%5)*.13);
          return `<i style="--dx:${Math.round(Math.cos(angle)*r)}px;--dy:${Math.round(Math.sin(angle)*r)}px;--delay:${i%6*13}ms"></i>`;
        }).join('');
        if(p.impact.kind!=='miss') {
          field.classList.add('burst-firing');
          const heavy=p.impact.kind==='hit'&&Number(field.dataset.burstLevel)>=3;
          cue(heavy?'launchNova':'launch');
          await clock(mode==='fast'?65:attack.flight,signal);
          field.classList.remove('burst-firing');
        }
      }
      if(!signal.aborted) {
        if(attenuation) {
          const badge=field.querySelector('.attenuation-hint');
          badge.className='attenuation-hint '+(status==='success'?'attenuation-ready':'attenuation-failed');
          badge.textContent=attenuation;
        }
        const e=run.enemy;
        const impact=p.impact.kind;
        const reaction={barrier:'player-blocked',miss:'player-miss',gate:'player-landed',hit:'player-landed'};
        field.classList.add('player-strike',reaction[impact]);
        if(impact==='gate') field.classList.add('gate-shatter');
        if(impact==='barrier') field.classList.add('foe-barrier-struck');
        if(p.impact.relic) {
          const badge=app.querySelector('[data-board-relic][data-relic="'+p.impact.relic+'"]');
          badge?.classList.add('relic-lit','relic-pulsing');
        }
        if(e.hp===0n) field.classList.add('enemy-defeated');
        field.querySelector('#outgoing').textContent=impact==='barrier'?'バリア '+p.impact.breaks+'層破壊':impact==='miss'?'ダメージなし':
          (impact==='gate'?'段階突破 ':'')+'−'+compact(p.impact.dealt,false);
        field.querySelector('.foe-hp span').style.width=Number(e.hp*1000n/e.max)/10+'%';
        const foeHp=field.querySelector('#foeHp');
        foeHp.textContent='HP '+compact(e.hp)+' / '+compact(e.max);
        foeHp.title=e.hp+' / '+e.max;
        field.querySelector('.enemy-defenses').innerHTML=defenseStatus(e);
        const hpBar=field.querySelector('.foe-hp');
        hpBar.querySelector('.hp-forecast')?.remove();
        hpBar.querySelectorAll('.gate-tick').forEach(mark=>mark.remove());
        hpBar.insertAdjacentHTML('beforeend',gateTicks(e));
        if(impact==='hit') burstFX(p.final,best);
        else cue(impact);
        if(e.hp===0n) cue('victory');
        await clock(mode==='fast'?160:impact==='hit'?attack.impact:695,signal);
        field.querySelector('.foe').dataset.defense=e.barrier?'ward':'none';
        if(e.hp>0n&&!signal.aborted) {
          await showEnemyReaction(field,move,prediction,hpLost,outcome,signal);
        }
      }
    } else {
      if(p.impact.kind==='hit') burstFX(p.final,best);
      else cue(p.impact.kind);
      if(run.enemy.hp===0n) cue('victory');
      else enemyReaction(move,outcome,outcome.hitDetails[0]);
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
  if(e.key==='Escape'&&sequence) {sequence.abort();return;}
  if(sequence||dialog.open||run?.phase!=='battle'||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey) return;
  const card=e.target instanceof Element?e.target.closest('.board-card[data-board]'):null;
  if(!card) return;
  const at=Number(card.dataset.board);
  if(e.key==='Escape'&&selected!==null) {
    selected=null;
    render();
    app.querySelector(`[data-board="${at}"]`)?.focus({preventScroll:true});
  } else if(e.key==='ArrowLeft'||e.key==='ArrowRight') {
    e.preventDefault();
    selected=at;
    action(e.key==='ArrowLeft'?'shift:-1':'shift:1');
  } else if(e.key==='Delete'&&run.canReturn(at)) {
    e.preventDefault();
    selected=at;
    action('unplay');
  }
});
