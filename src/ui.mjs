const app=document.querySelector('#app');
const dialog=document.querySelector('#dialog');
const effect=document.querySelector('#effect');
const book=load();
let suspended=readCheckpoint(book.checkpoint);
let run=null, selected=null, storageWarning=false, audio=null, notice='';
let sequence=null, lastPage=null, craftResult=null, lastDeal=null, lastBattle=null;
const motionMode=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'off':book.prefs.motion||'full';
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
const types={add:'加算',mul:'乗算',pct:'割合',exp:'指数',pow:'累乗',clean:'先頭の妨害を解除',ward:'次の妨害を1回防ぐ'};
const glyph={add:'✦',mul:'✧',pct:'◈',pow:'❖',exp:'✷',clean:'✤',ward:'◇'};
const cardFace=c=>`<span class="card-rank">${rarity[c.tier]}</span><span class="mana" title="消費エネルギー">${c.cost}</span>
  <span class="sigil" aria-hidden="true">${glyph[c.kind]||'◇'}</span><strong class="card-number">${label(c)}${c.upgraded?'✧':''}</strong>
  <span class="card-type">${types[c.kind]||'妨害'}</span>`;
const cardButton=(c,act,i=-1,disabled=false)=>`<button type="button" class="card t${c.tier}" data-action="${act}"
  ${i<0?'':`draggable="${!disabled}" data-hand="${i}"`} title="${types[c.kind]}・消費 ${c.cost}" ${disabled?'disabled':''}>
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
  dialog.innerHTML=`<h2>${title}</h2>${content}<form method="dialog"><button>閉じる</button></form>`;
  if(!dialog.open) dialog.showModal();
}
function routeName(act=run.act){return act===4?'EXTRA':'ACT '+['','I','II','III'][act];}
const direct=a=>a.kind==='attack'||a.kind==='double';
function intentText() {
  const a=run.next;
  if(a.kind==='attack') return `HPに ${a.value} ダメージ`;
  if(a.kind==='double') return `二連撃 · ${a.value} × 2 ダメージ`;
  if(a.kind==='wither') return `吸命 · 戦闘中の最大HP −${a.value}（下限35）`;
  if(a.kind==='drain') return `弱体 · 戦闘中の基礎値 −${a.value}%`;
  if(a.kind==='lock') return `封印 · 次のBURSTまで${operationNames[a.target]}を無効化`;
  return `${a.at}枠目の後に ${label(a)} を挿入${run.ward?'（結界で防御可能）':''}`;
}
function sidebar(p) {
  const active=new Set(p.triggers.map(t=>t.id));
  if(run.deb.some(c=>c.kind==='div')) {
    if(run.owned.includes('prism')) active.add('prism');
    else if(run.owned.includes('key')) active.add('key');
  }
  return `<aside>
    <section class="frame"><h2>術師の記録</h2><div class="data">
    <span>HP <b>${run.hp}/${run.maxHp}</b></span><span>金貨 <b>${run.gold}</b></span>
    <span>基礎 <b>${run.base}</b></span><span>装甲 <b>÷${run.enemy.armor}</b></span></div>
    <small>歴代最高</small><div class="record">${fmt(BigInt(book.best.max))}</div>
    <div class="actions" style="margin-top:9px">${btn('デッキ '+run.deck.length,'deck')}${btn('履歴','history')}</div></section>
    <section class="frame"><h2>所持レリック</h2>${run.owned.map(id=>
      `<button class="rune" data-relic="${id}" data-action="relic:${id}" title="${relics[id].desc}">${relics[id].name}<small>${active.has(id)?'発動':relics[id].desc}</small></button>`
    ).join('')||'<p class="muted">所持なし</p>'}</section></aside>`;
}
function damageReceipt() {
  const p=run.lastBurst;
  if(!p) return '';
  const kind=p.impact.kind, status=kind==='barrier'?'バリアで無効':kind==='gate'?'耐久段階を突破':kind==='miss'?'ダメージなし':'';
  return `<section class="damage-receipt" aria-label="直前の攻撃結果">
    <div><small>確定BURST</small><strong title="${p.final}">${compact(p.final)}</strong></div>
    <div><small>敵HPの減少</small><strong title="${p.impact.dealt}">${compact(p.impact.dealt,false)}</strong>${status?`<small>${status}</small>`:''}</div></section>`;
}
function battle() {
  const p=run.preview(), e=run.enemy;
  const gate=e.gates[0];
  const slots=Array.from({length:run.slots},(_,i)=>{
    const c=run.board[i];
    const status=c?p.steps.find(s=>s.card===c):null;
    const at=Math.min(i,run.board.length);
    const deb=i<=run.board.length?run.deb.filter(d=>Math.min(d.at,run.board.length)===i).map(d=>
      `<span class="slot debuff" data-calc="${p.steps.findIndex(s=>s.card===d)}" title="敵の妨害 · ${d.at}枠目の後">${label(d)}</span>`).join(''):'';
    return deb+(c?`<button type="button" class="slot board-card t${c.tier} ${i===selected?'selected':''}" style="border-color:var(--tone)"
      data-calc="${p.steps.indexOf(status)}" data-action="slot:${i}" data-at="${i}" data-board="${i}" draggable="true" aria-pressed="${i===selected}" title="選択して移動"><strong>${label(c)}</strong><small>${types[c.kind]}</small>${status?.op===null?'<small>封印</small>':''}</button>`:
      `<button type="button" class="slot empty" data-at="${at}" data-action="slot:${at}" aria-label="空き枠 ${i+1}">${i+1}</button>`);
  }).join('');
  const tail=run.board.length===run.slots?run.deb.filter(d=>d.at>=run.slots).map(d=>`<span class="slot debuff" data-calc="${p.steps.findIndex(s=>s.card===d)}">${label(d)}</span>`).join(''):'';
  return `<main class="battle"><div class="column">
    <section class="frame enemy" data-act="${run.act}" data-rank="${e.kind}" data-form="${e.art.form}">
      <div class="duel">
        <figure class="combatant hero"><canvas data-sprite="10" width="48" height="44" aria-hidden="true"></canvas>
        <figcaption>術師</figcaption><div class="hpBar hero-hp" aria-hidden="true"><span style="width:${100*run.hp/run.maxHp}%"></span></div><small id="heroHp">HP ${run.hp} / ${run.maxHp}</small></figure>
        <span class="arena-seal" aria-hidden="true">✧</span>
        <figure class="combatant foe"><canvas data-enemy-art width="88" height="64" aria-hidden="true"></canvas>
        <figcaption>${e.name}</figcaption><div class="hpBar foe-hp" aria-hidden="true"><span style="width:${Number(e.hp*1000n/e.max)/10}%"></span></div><small id="foeHp" title="${e.hp} / ${e.max}">HP ${compact(e.hp)} / ${compact(e.max)}</small></figure>
        <span class="burst-scene" aria-hidden="true"><i class="burst-seal"></i><i class="burst-bolt"></i>
          <i class="burst-ring"></i><i class="burst-ring echo"></i></span>
        <span class="slash" aria-hidden="true"></span><span class="enemy-cast" aria-hidden="true"></span><span id="incoming" aria-hidden="true"></span><span id="outgoing" aria-hidden="true"></span>
      </div>
      <div class="enemy-info"><div class="eyebrow">${routeName()} · 第${run.stage}地点</div><h1>${e.name}</h1><small class="enemy-title">${e.title}${e.elite?' · ELITE':''}</small>
      ${e.detail?`<p class="enemy-rule">${e.detail}</p>`:''}
      ${e.barrier||gate!==undefined?`<p class="enemy-rule defense-status">${e.barrier?'バリア残り '+e.barrier+'回':`耐久段階あと ${e.gates.length} · 次の突破に <b title="${e.hp-gate}">${compact(e.hp-gate,false)}</b> ダメージ`}</p>`:''}
      <div class="intent"><small>敵の次の行動</small><strong>${intentText()}</strong></div></div></section>
    <section class="frame board-frame"><div class="heading"><h2>演算盤</h2><small>${run.board.length} / ${run.slots} 枠 · コンボ ${run.board.length}${run.ward?' · 結界あり':''}</small></div>
      <div class="board"><span class="slot base"><small>基礎</small>${run.base}</span>${slots}${tail}</div>
      ${selected!==null?`<div class="actions" style="margin-top:8px">${btn('← 左へ','shift:-1','',selected===0)}${btn('右へ →','shift:1','',selected===run.board.length-1)}</div>`:''}
      ${damageReceipt()}
      <div class="preview"><div><small>通常演算</small><strong title="${exactRat(p.normal)}">${visibleNumber(p.normal)}</strong></div><div><small>レリック適用後</small><strong title="${exactRat(p.result)}">${visibleNumber(p.result)}</strong></div>
      <div><small>最終ダメージ予測</small><strong title="${p.final}">${compact(p.final)}</strong><small title="${p.impact.dealt}">敵HP −${compact(p.impact.dealt,false)}${p.impact.kind==='barrier'?' · バリアで無効':p.impact.kind==='gate'?' · 耐久段階まで':''}</small></div></div>
      <div id="reel" class="reel" hidden><div class="reel-head"><span id="stepName"></span><span id="stepCombo"></span></div>
      <strong id="reelNumber"></strong><div class="reel-foot"><div id="stepProgress"></div>${btn('演出をスキップ','skip')}</div></div>
      ${notice?`<small role="status">${esc(notice)}</small>`:''}</section>
    <section class="frame"><div class="heading"><h2>手札</h2><span class="energy">エネルギー ${run.energy} / ${run.capacity} <small>· ドロー ${run.drawCount}枚</small></span></div>
      <div class="hand">${run.hand.map((c,i)=>cardButton(c,'hand:'+i,i,c.cost>run.energy||
        (c.kind==='clean'?!run.deb.length:c.kind==='ward'?run.ward:run.board.length>=run.slots))).join('')}</div>
      <div class="controls"><small>クリックで配置・移動。ドラッグで挿入。${run.holds===2?' 次はBURST。':''}</small>
      <div class="actions">${btn('HOLD '+run.holds+'/2','hold','',run.holds>=2)}${btn('BURST','burst','primary')}</div></div></section>
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
    <h3>${relics[id].name}</h3><p>${relics[id].desc}</p>
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
  const {kind,sources,result,relic,price}=craftResult;
  if(kind==='event') return chapter(routeName(),'イベントの結果',`<section class="reward-block">
    ${result?`<div class="reward-result">${rewardCard(result)}<p>デッキに <strong>${label(result)}</strong> を追加しました。</p></div>`:''}
    ${rewardChanges(craftResult)}${!result&&!craftResult.hp&&!craftResult.gold?'<p>HPは満タンでした。</p>':''}
    <p role="status">現在のHP ${run.hp}/100 · 所持金 ${run.gold} 枚</p>
    <div class="actions">${btn('地図へ戻る','craftNext','primary')}</div></section>`);
  const theme=workshopThemes[kind];
  const previous=sources.map(c=>`<span>${label(c)}</span>`).join('')+(price?`<span>${price} 金貨</span>`:'');
  const output=result?`<div class="card result-card t${result.tier}">${cardFace(result)}</div>`:
    relic?`<div class="relic-drop"><div><h2>${relics[relic].name}</h2><p>${relics[relic].desc}</p></div></div>`:'<strong>消去</strong>';
  return chapter(routeName(),theme.title,workshopStage(kind,`
    <div class="workshop-transform"><div class="workshop-sources">${previous}</div><span aria-hidden="true">→</span>${output}</div>
    <p role="status">${theme.done}</p><div class="actions">${btn(run.phase==='facility'?'店へ戻る':'地図へ戻る','craftNext','primary')}</div>`,true));
}
function useService(action,i=NaN,mode) {
  const transaction=run.service({action,i:action!=='remove'&&Number.isNaN(i)?Number(document.querySelector('#i')?.value):i,
    j:Number(document.querySelector('#j')?.value),mode,digit:Number(document.querySelector('#digit')?.value)});
  if(!transaction) {
    const status=action==='remove'?dialog.querySelector('#removeStatus'):app.querySelector('[role="status"]');
    if(status) status.textContent='金貨、素材、または利用回数の条件を満たしていません。';
    return;
  }
  if(action==='remove') dialog.close();
  if(transaction.kind) craftResult=transaction;
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
function eventPreview(offer) {
  return `<p>${offer.story}</p><section class="reward-block"><h2>受け取る内容</h2><p>${offer.offer}</p>
    ${offer.result?rewardCard(offer.result):''}${rewardChanges(offer)}
    ${!offer.available?'<p class="muted">支払いに必要なHPまたは金貨が足りません。</p>':''}
    <div class="actions">${btn('受け取る','service:event','primary',!offer.available)}${btn('見送る','service:decline')}</div></section>`;
}
function facility() {
  const f=run.facility;
  const options=run.deck.map((c,i)=>`<option value="${i}">${i+1}. ${label(c)}${c.upgraded?'✧':''}</option>`).join('');
  const forge=`<div class="choices"><label>強化対象 <select id="i">${options}</select></label>${btn('火力型','forge:power')}${btn('数字調整型','forge:adjust')}</div>
    <div class="choices"><label>刻印する数字 <select id="digit">${Array.from({length:10},(_,i)=>`<option>${i}</option>`).join('')}</select></label>
    ${btn('末尾刻印','forge:digit')}</div><p id="forgePreview"></p>`;
  const unable=key=>run.shopUsed[key]||run.gold<prices[key];
  const body=f==='rest'?`<p>HP ${run.hp}/100 · 回復か鍛冶を1回選択</p><div class="choices">${btn('HPを35回復','service:heal','primary')}</div>${workshopStage('forge',forge)}`:
    f==='event'?eventPreview(run.eventOffer):
    workshopStage('shop',`<p>所持金 ${run.gold} · カード各${prices.buy}金貨</p><div class="choices shop-cards">${run.shop.map((c,i)=>c?cardButton(c,'buy:'+i,-1,unable('buy')):'<span class="sold">売約済み</span>').join('')}</div>
    <h2>レリック · ${run.shopUsed.relic?'購入済み':prices.relic+'金貨／1個まで'}</h2><div class="choices">${run.stockRelics.map((id,i)=>btn(relics[id].name+'<small>'+relics[id].desc+'</small>','relicBuy:'+i,'',unable('relic'))).join('')||'在庫なし'}</div>
    <h2>工房 · デッキ下限12枚</h2><div class="choices"><label>対象 <select id="i">${options}</select></label><label>合成相手 <select id="j">${options}</select></label>
    ${btn(run.shopUsed.fuse?'合成済み':'合成 · '+prices.fuse+'金貨','fuse','',unable('fuse')||run.deck.length<=12)}</div><p id="forgePreview"></p>
    <div class="actions">${btn(run.shopUsed.remove?'削除済み':'削除するカードを選ぶ · '+prices.remove+'金貨','remove','',unable('remove')||run.deck.length<=12)}</div>`);
  return chapter(routeName(),places[f].name,body+`<p role="status">${esc(notice)}</p>`
    +(f!=='event'?`<div class="actions">${btn('地図へ戻る','leave','primary')}</div>`:''));
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
  if(!run) return `<main><section class="frame title"><div><div class="eyebrow">演算魔術譚 · v0.5.8</div><div class="rule"></div>
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
    case 'reward':return chapter(routeName(),'勝利報酬',`<p>HP ${run.hp}/100 ${run.victoryHeal?'（勝利時回復 +'+run.victoryHeal+'）':''} · 所持金 ${run.gold} 枚</p>
      ${damageReceipt()}
      ${cardReward()}${goldReward()}${relicReward()}${takeReport()}
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
  app.innerHTML=`<header><div class="brand">◇ DAMAGE BREAKER</div><nav>${run&&run.phase!=='battle'?btn('デッキ '+run.deck.length,'deck'):''}${run&&suspended?btn('中断','pause'):''}${btn('遊び方','help')}${btn('記録帳','records')}${btn('設定','settings')}</nav></header>${view()}
    ${storageWarning?'<p role="status" style="text-align:center">保存できませんでした。画面を閉じると、今回の進行や記録が失われる場合があります。</p>':''}`;
  const hero=app.querySelector('[data-sprite]');
  if(hero) paintSprite(hero,10);
  const enemy=app.querySelector('[data-enemy-art]');
  if(enemy) {
    paintEnemy(enemy,run.enemy.art);
    const battleKey=run.act+':'+run.stage;
    const dealKey=battleKey+':'+run.turn;
    if(lastBattle!==battleKey&&run.turn===0&&mode!=='off') {
      app.querySelector('.enemy').classList.add('encounter-arrival');
    }
    lastBattle=battleKey;
    if(lastDeal!==dealKey&&mode!=='off') {
      app.querySelector('.hand').classList.add('dealing');
      app.querySelectorAll('.hand .card').forEach((card,index)=>card.style.setProperty('--deal',index));
    }
    lastDeal=dealKey;
  }
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
  updateFacility();
}
function updateFacility() {
  const el=document.querySelector('#forgePreview');
  if(!el) return;
  const i=Number(document.querySelector('#i').value), j=Number(document.querySelector('#j')?.value);
  const c=run.deck[i];
  if(run.facility==='rest') {
    const a=upgraded(c,'power'),b=upgraded(c,'adjust'),d=upgraded(c,'digit',Number(document.querySelector('#digit').value));
    app.querySelector('[data-action="forge:digit"]').disabled=!d;
    el.textContent=a?`変化後　火力型 ${label(a)} ／ 数字調整型 ${label(b)} ／ 末尾刻印 ${d?label(d):'同じ数字'}`:'このパネルは強化対象外です。';
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
  const inf=n>CAP, tier=[10n**4n,10n**8n,10n**12n,10n**16n,10n**20n,10n**64n,CAP].filter(v=>n>=v).length;
  effect.className='';
  if(mode!=='off') {
    effect.textContent=(inf?'INFINITY BREAK ∞':fmt(n))+(best?' · 新記録':'');
    void effect.offsetWidth;
    effect.dataset.tier=tier;
    effect.className='flash'+(inf||tier>=4?' high':'')+(tier>=3&&mode==='full'?' shake':'')+(mode==='fast'?' fast':'');
  }
  if(!book.prefs.mute&&(inf||tier>0||best)) {
    try {
      audio??=new AudioContext();
      const now=audio.currentTime;
      const scale=inf?[196,294,392,587,784]:tier>=4?[196,294,440,587]:tier>=2?[262,392,523]:[262,392];
      scale.forEach((hz,i)=>{
        const osc=audio.createOscillator(),gain=audio.createGain();
        osc.type='triangle';osc.frequency.value=hz;
        const t=now+i*.048;
        gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.045,t+.012);
        gain.gain.exponentialRampToValueAtTime(.0001,t+.18);
        osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+.19);
      });
    } catch {}
  }
}
effect.addEventListener('animationend',()=>{effect.className='';});
const prefsHTML=()=>`<p><label><input type="checkbox" id="scientific" ${book.prefs.scientific?'checked':''}> 指数表記</label></p>
  <p><label>演出 <select id="motion">${[['full','通常'],['fast','高速・軽量'],['off','スキップ']].map(([id,t])=>
    `<option value="${id}" ${(book.prefs.motion||'full')===id?'selected':''}>${t}</option>`).join('')}</select></label></p>
  <p><label><input type="checkbox" id="mute" ${book.prefs.mute?'checked':''}> 効果音を消す</label></p>`;
function openDeck() {
  const groups=[['add','加算'],['mul','乗算'],['pct','割合'],['pow','累乗'],['exp','指数'],['aux','補助']];
  const sections=groups.flatMap(([kind,name])=>{
    const cards=run.deck.filter(c=>kind==='aux'?c.kind==='clean'||c.kind==='ward':c.kind===kind);
    if(!cards.length) return [];
    return [`<details open><summary>${name} · ${cards.length}枚</summary><ul>
      ${cards.map(c=>`<li>${label(c)}${c.upgraded?' ✧':''} · ${rarity[c.tier]} · 消費 ${c.cost}</li>`).join('')}</ul></details>`];
  });
  modal('デッキ '+run.deck.length+'枚',`<div class="deck-groups">${sections.join('')}</div>`);
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
  const i=Number(arg);
  if(name==='help') return modal('遊び方',`<p>手札の演算を盤に置き、基礎攻撃力から左順に計算します。地図は下から上へ、光っているマスを選びます。たとえば 20 → +10 → ×3 は90です。</p>
    <p>HOLDは盤を維持して新しい手札を引きます。敵はHOLD後、またはBURSTで生き残った後に予告どおり行動します。</p>
    <p>差し引きで負になった値や分数も計算中は保持します。装甲適用後、負のダメージは0、小数は切り捨てです。</p>
    <p>次の盤に入る妨害は、指定枠が空なら一時的に末尾で処理します。封印は直後の自分の演算を1枚無効化します。</p>`);
  if(name==='settings') return modal('設定',prefsHTML());
  if(name==='records') return openRecords();
  if(name==='deck') return openDeck();
  if(name==='relic') return modal(relics[arg].name,'<p>'+relics[arg].desc+'</p>');
  if(name==='history') return modal('計算履歴',run.history.map(p=>`<details><summary>${fmt(p.final)} · ${esc(p.formula)}</summary>
    <ol>${p.steps.map(s=>`<li>${label(s.card)}${s.op?.kind!==s.card.kind?' → '+(s.op?label(s.op):'無効'):''} → ${rat(s.result)}</li>`).join('')}
    ${p.triggers.map(t=>`<li>${relics[t.id].name} → ${rat(t.result)}</li>`).join('')}</ol></details>`).join('')||'<p>まだBURSTしていません。</p>');
  if(name==='resume'&&suspended) {
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
  const keepNotice=name==='craftNext'||name==='slot'||name==='shift'||name==='hand';
  if(!keepNotice) notice='';
  switch(name) {
    case 'hand':run.play(i);break;
    case 'slot':
      if(selected!==null&&selected!==i) {run.move(selected,Math.min(i,run.board.length-1));selected=null;}
      else selected=i===selected||!run.board[i]?null:i;
      break;
    case 'shift': {
      const to=selected+i;
      if(run.move(selected,to)) selected=to;
      break;
    }
    case 'hold': void showHold();return;
    case 'burst': void showBurst();return;
    case 'take':run.takeCard(i);break;
    case 'cardSkip':run.skipCard();break;
    case 'goldTake':run.chooseGold(true);break;
    case 'goldSkip':run.chooseGold(false);break;
    case 'relicTake':run.chooseRelic(true,i);break;
    case 'relicSkip':run.chooseRelic(false);break;
    case 'advance':run.advance();break;
    case 'route':run.route(arg);break;
    case 'leave':run.leaveNode();break;
    case 'extra':run.extra();break;
    case 'craftNext':craftResult=null;break;
    case 'buy':useService('buy',i);return;
    case 'relicBuy':useService('relic',i);return;
    case 'service':useService(arg);return;
    case 'forge':useService('forge',NaN,arg);return;
    case 'remove':openRemoval();return;
    case 'fuse':useService(name);return;
  }
  saveProgress();
  render();
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
  const el=e.target.closest('[draggable="true"]');
  if(!el) return;
  dragging=el.dataset.hand!==undefined?{hand:Number(el.dataset.hand)}:{board:Number(el.dataset.board)};
  e.dataTransfer.setData('text/plain','damage-breaker');
  e.dataTransfer.effectAllowed='move';
});
app.addEventListener('dragover',e=>{
  if(dragging&&e.target.closest('[data-at]')) e.preventDefault();
});
app.addEventListener('drop',e=>{
  const el=e.target.closest('[data-at]');
  if(!el||!dragging||sequence) return;
  e.preventDefault();
  const at=Number(el.dataset.at);
  if(dragging.hand!==undefined) run.play(dragging.hand,at);
  else run.move(dragging.board,Math.min(at,run.board.length-1));
  dragging=null;selected=null;saveProgress();render();
});
app.addEventListener('dragend',()=>{dragging=null;});
app.addEventListener('change',updateFacility);
dialog.addEventListener('change',e=>{
  const {id,checked,value}=e.target;
  if(id==='removeCard') {
    const selectedCard=value===''?null:run.deck[Number(value)];
    dialog.querySelector('#removePreview').innerHTML=selectedCard?rewardCard(selectedCard):'';
    dialog.querySelector('#removeForm button').disabled=!selectedCard;
    return;
  }
  if(!['scientific','motion','mute'].includes(id)) return;
  book.prefs[id]=id==='motion'?value:checked;
  persist();render();
});
dialog.addEventListener('submit',e=>{
  if(e.target.id!=='removeForm') return;
  e.preventDefault();
  const value=e.target.elements.card.value;
  if(value!=='') useService('remove',Number(value));
});
render();

function reactionText(move,message,hpLost) {
  if(!hpLost) return message;
  const loss='術師 HP −'+hpLost;
  return direct(move)?loss+(move.kind==='double'?' · 二連撃':''):message+' · '+loss;
}
function enemyReaction(move,message,hpLost) {
  const field=app.querySelector('.enemy');
  if(!field||motionMode()==='off') return;
  const blocked=message.startsWith('結界');
  field.classList.remove('player-strike','player-landed','player-blocked','player-miss');
  field.classList.add(!blocked&&direct(move)?'enemy-strike':'enemy-magic');
  field.dataset.move=blocked?'ward':move.kind;
  field.classList.toggle('enemy-double',move.kind==='double');
  field.querySelector('#incoming').textContent=reactionText(move,message,hpLost);
  const tones={attack:2,double:1,div:3,lock:5,drain:4,wither:1,pct:6,sub:2};
  chime(tones[move.kind]||1,'enemy');
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
function chime(level,kind) {
  if(book.prefs.mute) return;
  try {
    audio??=new AudioContext();
    const oscillator=audio.createOscillator(), gain=audio.createGain(),t=audio.currentTime;
    oscillator.frequency.value=kind==='enemy'?110+level*19:220*2**(level/7);
    oscillator.type=kind==='relic'?'sine':'triangle';
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(.018,t+.018);
    gain.gain.exponentialRampToValueAtTime(.0001,t+.12);
    oscillator.connect(gain);gain.connect(audio.destination);
    oscillator.start(t);oscillator.stop(t+.13);
  } catch {}
}
function updateHeroDisplay(field) {
  field.querySelector('.hero-hp span').style.width=100*run.hp/run.maxHp+'%';
  field.querySelector('#heroHp').textContent='HP '+run.hp+' / '+run.maxHp;
}
async function showHold() {
  const move=run.next;
  const hpBefore=run.hp;
  const prediction=run.ward&&!direct(move)?'結界が妨害を防ぎました':intentText();
  if(!run.hold()) return;
  selected=null;
  notice=reactionText(move,prediction,hpBefore-run.hp)+(run.phase==='battle'?' ／ 次の手札を引きました':'');
  saveProgress();
  const mode=motionMode();
  if(mode==='off'){render();return;}
  const control=new AbortController();
  sequence=control;
  const field=app.querySelector('.enemy');
  app.querySelectorAll('button:not(:disabled)').forEach(button=>button.disabled=true);
  enemyReaction(move,prediction,hpBefore-run.hp);
  updateHeroDisplay(field);
  try {await clock(mode==='fast'?160:510,control.signal);}
  finally {sequence=null;render();}
}
async function showBurst() {
  const base=run.base, armor=run.enemy.armor, move=run.next;
  const hpBefore=run.hp;
  const prediction=run.ward&&!direct(move)?'結界が妨害を防ぎました':intentText();
  const p=run.burst();
  if(!p) return;
  const best=p.final>BigInt(book.best.max);
  if(best) book.best={max:String(p.final),formula:run.stats.formula,seed:run.seed};
  selected=null;
  const strike=p.impact.kind==='barrier'?'バリアがBURSTを無効化':p.impact.kind==='gate'?'耐久段階を突破 · '+compact(p.impact.dealt,false):'BURST '+compact(p.final);
  notice=strike+(best?' · 新記録':'')+(run.enemy.hp>0n?' ／ '+reactionText(move,prediction,hpBefore-run.hp):'');
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
      let prior=[BigInt(base),1n];
      counter.textContent=visibleNumber(prior);
      reel.hidden=false;
      reel.closest('.board-frame').classList.add('calculating');
      field.classList.remove('encounter-arrival');
      field.classList.add('charging');
      const disabled=[...app.querySelectorAll('button:not(:disabled)')].filter(b=>b.dataset.action!=='skip');
      disabled.forEach(b=>b.disabled=true);
      reel.querySelector('button').focus({preventScroll:true});
      let lit=null;
      for(const [i,step] of steps.entries()) {
        if(signal.aborted) break;
        lit?.classList.remove('resolving');
        lit=step.relic?app.querySelector('[data-relic="'+step.relic+'"]'):
          step.index===undefined?null:app.querySelector('[data-calc="'+step.index+'"]');
        lit?.classList.add('resolving');
        const level=magnitude(step.value);
        reel.dataset.kind=step.type;
        reel.dataset.level=level;
        name.textContent=step.name;
        combo.textContent=step.combo+' COMBO';
        counter.title=exactRat(step.value);
        counter.classList.remove('count-pop');
        void counter.offsetWidth;
        counter.classList.add('count-pop');
        progress.style.width=((i+1)*100/steps.length)+'%';
        chime(level,step.type);
        const duration=mode==='fast'?95:step.type==='impact'?260:step.type==='relic'?400:270;
        await clock(duration,signal,position=>{
          const value=reelValue(prior,step.value,Math.floor(position*12));
          const display=step.type==='impact'&&position===1?compact(p.final):visibleNumber(value);
          if(counter.textContent!==display) counter.textContent=display;
        });
        prior=step.value;
      }
      if(!signal.aborted) {
        field.classList.remove('charging');
        field.dataset.force=impactForce(p);
        if(p.impact.kind!=='miss') {
          field.classList.add('burst-firing');
          await clock(mode==='fast'?65:155,signal);
          field.classList.remove('burst-firing');
        }
      }
      if(!signal.aborted) {
        const e=run.enemy;
        const impact=p.impact.kind;
        const reaction={barrier:'player-blocked',miss:'player-miss',gate:'player-landed',hit:'player-landed'};
        field.classList.add('player-strike',reaction[impact]);
        if(e.hp===0n) field.classList.add('enemy-defeated');
        field.querySelector('#outgoing').textContent=impact==='barrier'?'バリアで無効':impact==='miss'?'ダメージなし':
          (impact==='gate'?'段階突破 ':'')+'−'+compact(p.impact.dealt,false);
        field.querySelector('.foe-hp span').style.width=Number(e.hp*1000n/e.max)/10+'%';
        const foeHp=field.querySelector('#foeHp');
        foeHp.textContent='HP '+compact(e.hp)+' / '+compact(e.max);
        foeHp.title=e.hp+' / '+e.max;
        if(impact==='hit') burstFX(p.final,best);
        else if(impact==='gate'||impact==='barrier') chime(impact==='gate'?5:2,'relic');
        await clock(mode==='fast'?160:695,signal);
        if(e.hp>0n&&!signal.aborted) {
          enemyReaction(move,prediction,hpBefore-run.hp);
          updateHeroDisplay(field);
          await clock(mode==='fast'?170:620,signal);
        }
      }
    } else if(p.impact.kind==='hit') burstFX(p.final,best);
  } finally {
    if(signal.aborted) effect.className='';
    sequence=null;
    render();
    if(run.phase==='battle') app.querySelector('[data-action="burst"]')?.focus({preventScroll:true});
  }
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&sequence) sequence.abort();
});
