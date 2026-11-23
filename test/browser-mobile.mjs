import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Run} from '../src/run.mjs';
import {writeCheckpoint} from '../src/checkpoint.mjs';

const {chromium,webkit,devices}=await import(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const useWebKit=process.env.BROWSER_ENGINE==='webkit';
const browser=useWebKit?await webkit.launch():await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE});
const source=process.argv[2]||new URL('../index.html',import.meta.url);
const html=readFileSync(source,'utf8');
const origin='http://damage-breaker.test/';
const storageKey='damage-breaker.v01';
const profiles=[
  ['Android compact','Pixel 7',320,568],
  ['Android portrait','Pixel 7',360,640],
  ['iPhone viewport','iPhone 13',390,844],
  ['iPhone large viewport','iPhone 13',430,932],
  ['Android landscape','Pixel 7',667,375],
  ['iPhone landscape','iPhone 13',932,430]
];

async function openPage(options,run=null) {
  const page=await browser.newPage(options);
  page.setDefaultTimeout(6000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(origin,route=>route.fulfill({contentType:'text/html',body:html}));
  if(run) await page.addInitScript(({key,checkpoint})=>{
    if(sessionStorage.getItem('fixture')) return;
    sessionStorage.setItem('fixture','yes');
    localStorage.setItem(key,JSON.stringify({best:{max:'0'},runs:[],prefs:{motion:'fast'},checkpoint}));
  },{key:storageKey,checkpoint:writeCheckpoint({run})});
  await page.goto(origin);
  return {page,errors};
}
const action=(page,id)=>page.locator('[data-action="'+id+'"]');
const readState=page=>page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).checkpoint).state,storageKey);
const settle=page=>page.locator('main.turn-page').waitFor({state:'detached'});
async function noOverflow(page,name) {
  const {width,scroll}=await page.evaluate(()=>({
    width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth
  }));
  assert(scroll<=width+1,`${name}: horizontal scroll ${scroll} > ${width}`);
}
async function dockVisible(page,id) {
  const button=page.locator('.battle-commands [data-action="'+id+'"]');
  const bounds=await button.boundingBox();
  assert(bounds&&bounds.height>=44&&bounds.y>=0&&bounds.y+bounds.height<=page.viewportSize().height+1);
}
function fixture(kind) {
  const run=new Run('mobile-fixture-'+kind);
  const node=run.map.flat().find(entry=>entry.kind===kind);
  run.routes=[node.id];
  run.gold=200;
  assert(run.route(node.id));
  return run;
}

async function battleFlow(options) {
  const {page,errors}=await openPage(options);
  await noOverflow(page,'title');
  await action(page,'menu').tap();
  await action(page,'settings').tap();
  await page.locator('#motion').selectOption('fast');
  await page.locator('#scientific').check();
  await page.locator('#dialog button').tap();
  assert.equal(await action(page,'menu').getAttribute('aria-expanded'),'false');
  await page.locator('#start input').fill('mobile-test');
  await page.locator('#start button').tap();
  await settle(page);
  const eligible=page.locator('.map-node.live').first();
  const liveBox=await eligible.boundingBox();
  assert(liveBox.y>=0&&liveBox.y+liveBox.height<=options.viewport.height);
  assert.equal(await page.locator('.map-node').evaluateAll(nodes=>nodes.some((node,i)=>{
    const a=node.getBoundingClientRect();
    return nodes.slice(i+1).some(next=>{
      const b=next.getBoundingClientRect();
      return a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1;
    });
  })),false,'map nodes overlap');
  await noOverflow(page,'map');
  assert.equal(await page.locator('.map-node.rest .tile-icon').count(),4);
  assert.equal(await page.locator('.route-map [data-act-art]').getAttribute('data-act-art'),'act-1');
  await eligible.tap();
  await dockVisible(page,'burst');
  await settle(page);
  await noOverflow(page,'battle');
  assert.match(await page.locator('.board').evaluate(el=>getComputedStyle(el).backgroundImage),/repeating-conic-gradient/);
  assert.equal(await action(page,'intercept').count(),0);
  assert(await page.locator('.hp-forecast').count());
  assert(await page.locator('.duel [data-act-art]').isVisible());
  const firstCard=page.locator('.hand button:not(:disabled)').first();
  const handWidth=(await firstCard.boundingBox()).width;
  await firstCard.tap();
  assert.equal((await firstCard.boundingBox()).width,handWidth);
  await firstCard.tap();
  const {board,energy}=await readState(page);
  assert.equal(board.length,2);
  await action(page,'slot:0').tap();
  await action(page,'shift:1').tap();
  assert.equal(await page.locator('.board-card.card-shift-right').count(),1);
  assert.deepEqual((await readState(page)).board,[board[1],board[0]]);
  assert.match(await page.locator('.board-picked').innerText(),/2枠目/);
  await action(page,'unplay').tap();
  const placed=await readState(page);
  assert.equal(placed.energy,energy+board[0].cost);
  assert.deepEqual(placed.board,[board[1]]);
  await action(page,'hold').tap();
  await page.locator('.skip-sequence[hidden]').waitFor({state:'attached'});
  const held=await readState(page);
  assert.deepEqual(held.board,placed.board);
  assert.equal(held.holds,1);
  await dockVisible(page,'burst');
  await action(page,'burst').tap();
  await dockVisible(page,'skip');
  await page.locator('.battle-commands [data-action="skip"]').tap();
  await page.locator('.last-strike').waitFor();
  const fired=await readState(page);
  assert.equal(fired.stats.turns,2);
  assert.equal(fired.board.length,0);
  assert(fired.enemy.hp.$bigint!==held.enemy.hp.$bigint);
  await page.reload();
  await action(page,'resume').tap();
  await settle(page);
  await page.locator('.last-strike').waitFor();
  assert.deepEqual(await readState(page),fired);
  assert.deepEqual(errors,[]);
  await page.close();
}

async function rewardRelicHints(options) {
  const run=fixture('fight');
  run.enemy.hp=1n;
  run.enemy.barrier=0;
  run.owned=['evenChisel','sum'];
  run.burst();
  run.offers=[
    {kind:'add',value:12,cost:1,tier:0},{kind:'mul',value:3,cost:1,tier:0},{kind:'guard',value:6,cost:1,tier:0}
  ];
  const {page,errors}=await openPage(options,run);
  await action(page,'resume').tap();
  const candidate=action(page,'take:0');
  assert.match(await candidate.locator('.reward-relic-hint').innerText(),/偶数加算3連/);
  assert.match(await candidate.getAttribute('title'),/双数の石鑿.*千和の石版/);
  assert.equal(await page.locator('.reward-cards [data-relic-hint]').count(),1);
  await noOverflow(page,'reward relic hint');
  await candidate.tap();
  assert.equal((await readState(page)).cardDecision.status,'taken');
  assert.equal(await page.locator('.reward-relic-hint').count(),0);
  assert.deepEqual(errors,[]);
  await page.close();
}

async function facilityFlow(options) {
  const elite=fixture('elite');
  elite.enemy.hp=elite.enemy.max=1n;
  elite.enemy.barrier=0;
  const reward=await openPage(options,elite);
  const p=reward.page;
  await action(p,'resume').tap();
  await action(p,'burst').tap();
  await action(p,'advance').waitFor();
  await settle(p);
  assert(await action(p,'advance').isDisabled());
  await noOverflow(p,'elite reward');
  await action(p,'take:0').tap();
  assert.equal(await p.locator('.reward-cards .reward-claimed').count(),1);
  await action(p,'goldTake').tap();
  assert.equal(await p.locator('.reward-gold.reward-claimed').count(),1);
  await action(p,'relicTake:1').tap();
  if(await action(p,'omenTake').count()) await action(p,'omenTake').tap();
  assert.equal((await readState(p)).relicDecision,'taken');
  assert(await action(p,'advance').isEnabled());
  await action(p,'advance').tap();
  await settle(p);
  assert((await readState(p)).phase==='map');
  assert.deepEqual(reward.errors,[]);
  await p.close();

  const shop=await openPage(options,fixture('shop'));
  const s=shop.page;
  await action(s,'resume').tap();
  await settle(s);
  await noOverflow(s,'shop');
  await action(s,'buy:0').tap();
  assert.equal((await readState(s)).gold,170);
  await action(s,'craftNext').tap();
  assert.equal(await action(s,'buy:0').count(),0);
  await action(s,'shopTab:relics').tap();
  assert(await action(s,'relicBuy:0').isVisible());
  await action(s,'shopTab:forge').tap();
  assert(await s.locator('[data-event-art="shop"]').isVisible());
  assert(await s.locator('.coin-icon').count()>=3);
  await action(s,'fuse').tap();
  assert(await s.locator('[data-craft-confirm]').isDisabled());
  await s.locator('[data-craft-card="0"]').tap();
  assert(await s.locator('[data-craft-confirm]').isDisabled());
  await s.locator('[data-craft-card="1"]').tap();
  await s.locator('.craft-confirm .result-card').waitFor();
  await s.locator('[data-craft-confirm]').tap();
  assert.equal(await s.locator('.craft-materials .result-card').count(),2);
  await action(s,'craftNext').tap();
  await action(s,'remove').tap();
  const confirmRemoval=s.locator('.remove-dialog [data-craft-confirm]');
  const beforeRemoval=await readState(s);
  assert(await confirmRemoval.isDisabled());
  const filter=s.locator('#removeFilter');
  await filter.selectOption('mul');
  const filtered=s.locator('.remove-dialog [data-craft-card]');
  assert.equal(await filtered.count(),beforeRemoval.deck.filter(card=>card.kind==='mul').length);
  await filtered.first().tap();
  await s.locator('.remove-target .result-card').waitFor();
  await filter.selectOption('add');
  assert(await confirmRemoval.isDisabled());
  await filtered.first().tap();
  await s.getByRole('button',{name:'閉じる',exact:true}).tap();
  assert.deepEqual(await readState(s),beforeRemoval);
  await action(s,'remove').tap();
  await filter.selectOption('add');
  const target=filtered.nth(1);
  const index=Number(await target.getAttribute('data-craft-card'));
  await target.tap();
  await target.tap();
  assert(await confirmRemoval.isDisabled());
  await target.tap();
  assert.equal(await target.getAttribute('aria-pressed'),'true');
  await noOverflow(s,'removal dialog');
  await confirmRemoval.tap();
  const afterRemoval=await readState(s);
  assert.deepEqual(afterRemoval.deck,beforeRemoval.deck.filter((_,at)=>at!==index));
  assert.equal(afterRemoval.gold,beforeRemoval.gold-30);
  assert.equal(await s.locator('.removal-sparks i').count(),7);
  assert.equal(await s.locator('.removal-sparks i').first().evaluate(el=>getComputedStyle(el).animationName),'erase-sparks');
  await noOverflow(s,'removal receipt');
  await action(s,'craftNext').tap();
  assert(await action(s,'remove').isDisabled());
  await action(s,'menu').tap();
  await action(s,'deck').tap();
  await s.locator('#deckFilter').selectOption('add');
  assert(await s.locator('.deck-cards .card').count()>0);
  await s.locator('#dialog button').last().tap();
  await action(s,'leave').tap();
  assert.equal((await readState(s)).phase,'map');
  assert.deepEqual(shop.errors,[]);
  await s.close();

  const rest=await openPage(options,fixture('rest'));
  await action(rest.page,'resume').tap();
  assert(await rest.page.locator('[data-event-art="rest"]').isVisible());
  await action(rest.page,'forge').tap();
  await rest.page.locator('[data-craft-card="0"]').tap();
  assert(await rest.page.locator('[data-craft-confirm]').isDisabled());
  await rest.page.locator('[data-craft-mode="power"]').tap();
  await rest.page.locator('.craft-confirm .result-card').waitFor();
  await rest.page.locator('[data-craft-confirm]').tap();
  await rest.page.locator('.workshop-reveal .workshop-output .result-card').waitFor();
  await noOverflow(rest.page,'forge receipt');
  assert((await readState(rest.page)).deck.some(card=>card.upgraded));
  assert.deepEqual(rest.errors,[]);
  await rest.page.close();

  const event=await openPage(options,fixture('event'));
  await action(event.page,'resume').tap();
  await noOverflow(event.page,'event');
  await action(event.page,'service:decline').tap();
  assert.equal((await readState(event.page)).phase,'map');
  assert.deepEqual(event.errors,[]);
  await event.page.close();
}

async function relicExchange(options) {
  const run=fixture('event');
  run.event='exchange';
  run.owned=['chalk','grimoire'];
  const expected=run.eventExchanges('grimoire')[1];
  const {page,errors}=await openPage(options,run);
  await action(page,'resume').tap();
  await settle(page);
  assert(await page.locator('[data-event-art="exchange"]').isVisible());
  assert.equal(await action(page,'eventExchange:0').count(),0);
  await page.locator('#exchangeSource').selectOption('chalk');
  assert(await page.locator('[data-exchange-relic="chalk"]').isVisible());
  await page.locator('#exchangeSource').selectOption('grimoire');
  assert(await page.locator('[data-exchange-relic="grimoire"]').isVisible());
  assert.equal(await action(page,'eventExchange:1').locator('..').getAttribute('data-exchange-relic'),expected);
  await noOverflow(page,'exchange candidates');
  await action(page,'eventExchange:1').tap();
  assert.deepEqual((await readState(page)).owned,['chalk',expected]);
  assert.equal(await page.locator('.exchange-receipt [data-exchange-relic]').count(),2);
  await noOverflow(page,'exchange receipt');
  await page.reload();
  await action(page,'resume').tap();
  assert(await page.locator('.exchange-receipt').isVisible());
  await action(page,'craftNext').tap();
  assert.equal((await readState(page)).phase,'map');
  assert.deepEqual(errors,[]);
  await page.close();

  const declined=await openPage(options,run);
  await action(declined.page,'resume').tap();
  await declined.page.locator('#exchangeSource').selectOption('grimoire');
  await action(declined.page,'service:decline').tap();
  assert.deepEqual((await readState(declined.page)).owned,run.owned);
  assert.deepEqual(declined.errors,[]);
  await declined.page.close();
}

async function combatEffects(options) {
  const run=fixture('fight');
  run.owned=['grimoire'];
  run.enemy.cycle=['pursuit','shatter'];
  run.ward=3;
  run.omens=1;
  run.energy=2;
  const make=(kind,value)=>({kind,value,cost:1,tier:0});
  run.hand=[make('add',120),make('mul',12),make('mul',90)];
  const {page,errors}=await openPage(options,run);
  await action(page,'resume').tap();
  await action(page,'divine').tap();
  assert.deepEqual((await readState(page)).board.map(c=>[c.kind,c.value]),[['add',120],['mul',12]]);
  assert.equal((await readState(page)).omens,0);
  assert.equal(await page.locator('.board .returnable-label').count(),2);
  assert(await page.locator('.hero[data-defense="ward"] .barrier-shell').isVisible());
  await action(page,'hold').tap();
  for(const hit of [1,2,3]) {
    const marker=page.locator('.enemy[data-hit="'+hit+'"] .enemy-hit-fx');
    await marker.waitFor({state:'attached'});
    assert.equal(await marker.evaluate(el=>getComputedStyle(el).animationName),'individual-hit');
  }
  await page.locator('.skip-sequence[hidden]').waitFor({state:'attached'});
  await action(page,'hold').tap();
  await page.locator('.enemy.hero-barrier-struck.barrier-shatter').waitFor({state:'attached'});
  await page.locator('.skip-sequence[hidden]').waitFor({state:'attached'});
  assert.equal((await readState(page)).ward,1);
  assert.deepEqual(errors,[]);
  await page.close();

  const boss=fixture('boss');
  boss.owned=['breach'];
  boss.enemy.barrier=2;
  boss.board=[10,12,15,20].map(value=>make('add',value));
  const barrier=await openPage(options,boss);
  const b=barrier.page;
  await action(b,'resume').tap();
  assert(await b.locator('.foe[data-defense="ward"] .barrier-shell').isVisible());
  await b.evaluate(()=>{
    const arena=document.querySelector('.enemy');
    const observer=new MutationObserver(()=>{
      if(arena.classList.contains('foe-barrier-struck')) document.body.dataset.foeBarrierFlash=arena.querySelector('#outgoing').textContent;
    });
    observer.observe(arena,{attributes:true,attributeFilter:['class']});
  });
  await action(b,'burst').tap();
  await b.locator('.last-strike').waitFor();
  assert.match(await b.locator('body').getAttribute('data-foe-barrier-flash')??'',/2層破壊/);
  assert.equal((await readState(b)).enemy.barrier,0);
  assert.deepEqual(barrier.errors,[]);
  await b.close();
}

async function phaseGauges(options) {
  const run=fixture('boss');
  run.act=3;
  run.enemy.barrier=0;
  run.enemy.max=run.enemy.hp=300n;
  run.enemy.originalGates=[200n,100n];
  run.enemy.gates=[...run.enemy.originalGates];
  run.enemy.cycle=['attack'];
  run.board=[{kind:'add',value:150,tier:0,cost:1}];
  run.owned=['stillwater'];
  const {page,errors}=await openPage(options,run);
  await action(page,'resume').tap();
  assert.match(await action(page,'hold').innerText(),/0\/3/);
  assert.equal(await page.locator('.gate-tick:not(.passed)').count(),2);
  assert.match(await page.locator('.enemy-defenses').innerText(),/⅔/);
  assert.match(await page.locator('[data-boss-tactic="gate"]').innerText(),/耐久ライン残2本/);
  await noOverflow(page,'boss tactic and gate preview');
  await page.evaluate(()=>{
    const arena=document.querySelector('.enemy');
    new MutationObserver(()=>{
      if(arena.classList.contains('gate-shatter')) document.body.dataset.castMotif=arena.dataset.attackMotif;
    }).observe(arena,{attributes:true,attributeFilter:['class']});
  });
  await action(page,'burst').tap();
  await page.locator('.last-strike').waitFor();
  assert.equal(await page.locator('body').getAttribute('data-cast-motif'),'cross');
  assert.equal(await page.locator('.gate-tick.passed').count(),1);
  assert.match(await page.locator('.enemy-defenses').innerText(),/次はHP ⅓/);
  assert.match(await page.locator('[data-boss-tactic="gate"]').innerText(),/耐久ライン残1本/);
  assert.equal((await readState(page)).enemy.hp.$bigint,'200');
  assert.deepEqual(errors,[]);
  await page.close();
}

async function commandFeedback(options) {
  const run=fixture('fight');
  run.hp=3;
  run.enemy.cycle=['double'];
  run.enemy.hp=run.enemy.max=200n;
  run.energy=3;
  run.hand=[{kind:'add',value:20,tier:0,cost:1},{kind:'add',value:30,tier:0,cost:1},{kind:'mul',value:10,tier:0,cost:1}];
  run.board=[{kind:'add',value:5,tier:0,cost:1}];
  const {page,errors}=await openPage(options,run);
  await action(page,'resume').tap();
  assert.equal(await action(page,'hold').locator('small').innerText(),'盤のカードを維持');
  assert.equal(await action(page,'burst').locator('small').innerText(),'今の盤で演算');
  assert.match(await page.locator('.tactics').innerText(),/反撃で敗北/);
  assert.match(await page.locator('.tactics > div').first().innerText(),/HOLDすると敗北/);
  assert.match(await page.locator('.intent').innerText(),/致命的/);
  const before=await readState(page);
  await action(page,'hand:0').tap();
  await action(page,'hand:0').tap();
  await action(page,'unplayAll').tap();
  const after=await readState(page);
  assert.deepEqual(after.board,before.board);
  assert.equal(after.energy,before.energy);
  assert.equal(after.hand.length,before.hand.length);
  assert.match(await page.locator('.battle-notice').innerText(),/2 枚を手札に戻しました/);
  await action(page,'hand:0').tap();
  assert.equal(await action(page,'burst').locator('small').innerText(),'今の盤で演算');
  assert.match(await page.locator('.tactics-win').innerText(),/このBURSTで撃破/);
  await page.locator('.tactics-more summary').tap();
  assert.match(await page.locator('.tactics-detail-grid').innerText(),/撃破するため反撃なし/);
  assert.match(await page.locator('.tactics-detail-grid').innerText(),/敵の残HP 0/);
  await noOverflow(page,'lethal HOLD vs winning BURST details');
  assert.deepEqual(errors,[]);
  await page.close();
}

async function tacticalClarity(options) {
  const run=fixture('fight');
  const op=(kind,value,cost=1)=>({kind,value,tier:0,cost});
  run.enemy.cycle=['attack'];
  run.enemy.attack=10;
  run.enemy.barrier=2;
  run.enemy.hp=run.enemy.max=1000n;
  run.enemy.armor=1;
  run.hp=20;
  run.guard=0;
  run.ward=0;
  run.board=[op('add',5)];
  run.hand=[op('mul',3),op('add',10,2),op('clean',1)];
  run.energy=1;
  const {page,errors}=await openPage(options,run);
  await action(page,'resume').tap();
  assert.equal(await page.locator('.attenuation-start').count(),1);
  assert.match(await page.locator('.attenuation-hint').innerText(),/あと1枚/);
  assert.equal(await page.locator('.tactics-more').getAttribute('open'),null);
  assert.match(await action(page,'hand:1').getAttribute('title'),/エナジー不足/);
  assert.match(await page.locator('.hand [data-hand="2"] .card-type').innerText(),/浄化対象なし/);
  await page.locator('.tactics-more summary').tap();
  assert.match(await page.locator('.tactics-detail-grid').innerText(),/HOLD · 盤を維持/);
  assert.match(await page.locator('.tactics-detail-grid').innerText(),/HP 20 → 10/);
  assert.match(await page.locator('.tactics-detail-grid').innerText(),/バリア 1層破壊/);
  await noOverflow(page,'expanded tactical forecast');
  await action(page,'hand:0').tap();
  assert.equal(await page.locator('.attenuation-first').count(),1);
  assert.equal(await page.locator('.attenuation-second').count(),1);
  assert.match(await page.locator('.attenuation-hint').innerText(),/減衰可能/);
  await page.locator('.tactics-more summary').tap();
  assert.match(await page.locator('.tactics-detail-grid').innerText(),/術師HP 20 → 15/);
  assert.match(await page.locator('.tactics-detail-grid').innerText(),/反撃減衰成立/);
  await noOverflow(page,'attenuation tactical forecast');
  assert.deepEqual(errors,[]);
  await page.close();
}

async function enchantmentFlow(options) {
  const eventRun=fixture('event');
  eventRun.event='echoShrine';
  eventRun.deck[0]={...eventRun.deck[0],enchant:'energy'};
  const event=await openPage(options,eventRun);
  const e=event.page;
  await action(e,'resume').tap();
  assert(await e.locator('[data-event-art="echoShrine"]').isVisible());
  await action(e,'eventChoice:0').tap();
  assert.equal(await e.locator('[data-enchant-target="0"]').count(),0);
  assert.equal(await e.locator('[data-enchant-target]').count(),12);
  const confirm=e.locator('[data-enchant-confirm]');
  assert(await confirm.isDisabled());
  await e.locator('[data-enchant-target="1"]').tap();
  await noOverflow(e,'enchant dialog');
  await confirm.tap();
  assert.match(await e.locator('.reward-result').innerText(),/再現/);
  assert.equal((await readState(e)).deck[1].enchant,'repeat');
  await e.reload();
  await action(e,'resume').tap();
  assert(await e.locator('.reward-result [data-enchant="repeat"]').isVisible());
  assert.deepEqual(event.errors,[]);
  await e.close();

  const rewardRun=fixture('elite');
  rewardRun.enemy.barrier=0;
  rewardRun.enemy.gates=[];
  rewardRun.enemy.hp=1n;
  rewardRun.burst();
  rewardRun.relicDrop='echoEngraver';
  rewardRun.relicAlternative=null;
  rewardRun.relicDecision='pending';
  const reward=await openPage(options,rewardRun);
  const r=reward.page;
  await action(r,'resume').tap();
  await action(r,'relicTake:0').tap();
  await r.locator('[data-enchant-target="0"]').tap();
  await r.locator('[data-enchant-confirm]').tap();
  assert.equal((await readState(r)).relicEnchantedCard.enchant,'repeat');
  assert(await r.locator('.relic-reward-content [data-enchant="repeat"]').isVisible());
  assert.deepEqual(reward.errors,[]);
  await r.close();
}

async function attenuationFlow(options) {
  const run=fixture('fight');
  run.owned=['furnaceRemainder','setComplement'];
  run.enemy.attack=19;
  run.enemy.armor=1;
  run.enemy.cycle=['attack'];
  run.enemy.hp=run.enemy.max=9000n;
  run.hand=[
    {kind:'add',value:10,cost:1,tier:0,enchant:'repeat'},{kind:'mul',value:3,cost:1,tier:0},
    {kind:'ward',value:1,cost:1,tier:0}
  ];
  const failure=await openPage(options,run);
  await action(failure.page,'resume').tap();
  await action(failure.page,'burst').tap();
  await failure.page.locator('.battle-notice').waitFor();
  assert.match(await failure.page.locator('.battle-notice').innerText(),/減衰失敗/);
  assert.equal((await readState(failure.page)).hp,81);
  assert.equal((await readState(failure.page)).attenuationUsed,false);
  assert.deepEqual(failure.errors,[]);
  await failure.page.close();

  const {page,errors}=await openPage(options,run);
  await action(page,'resume').tap();
  assert.equal(await action(page,'hand:2').getAttribute('draggable'),'false');
  assert.match(await action(page,'hand:2').innerText(),/スペル/);
  await action(page,'hand:2').tap();
  assert.equal((await readState(page)).board.length,0);
  await action(page,'hand:0').tap();
  await action(page,'hand:0').tap();
  assert.match(await page.locator('.attenuation-ready').innerText(),/減衰可能[\s\S]*10ダメージ/);
  assert(await page.locator('.board-card [data-enchant="repeat"]').isVisible());
  await page.evaluate(()=>{
    const step=document.querySelector('#stepName');
    new MutationObserver(()=>{
      if(step.textContent.includes('再現')&&document.querySelector('.board-card.enchant-firing')) document.body.dataset.echo='yes';
    }).observe(step,{childList:true,subtree:true});
  });
  await action(page,'burst').tap();
  await page.locator('.last-strike').waitFor();
  const result=await readState(page);
  assert.equal(result.hp,90);
  assert.equal(result.energy,5);
  assert.equal(result.hand.length,7);
  assert.equal(result.lastBurst.final.$bigint,'120');
  assert.equal(await page.locator('body').getAttribute('data-echo'),'yes');
  assert.match(await page.locator('.battle-notice').innerText(),/減衰成立[\s\S]*エナジー＋2[\s\S]*ドロー＋2/);
  assert.match(await page.locator('.attenuation-hint').innerText(),/減衰済み/);
  await noOverflow(page,'attenuation battle');
  assert.deepEqual(errors,[]);
  await page.close();
}

async function desktopFlow() {
  const {page,errors}=await openPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});
  assert(await action(page,'menu').isHidden());
  await page.locator('#start input').fill('mobile-test');
  await page.locator('#start button').click();
  await page.locator('.map-node.live').first().click();
  assert.equal(await page.locator('.battle-commands').evaluate(el=>getComputedStyle(el).position),'static');
  const card=page.locator('.hand button:not(:disabled)').first();
  await card.dragTo(page.locator('.board .empty').first());
  assert.equal((await readState(page)).board.length,1);
  await page.locator('.hand button:not(:disabled)').first().click();
  const beforeMove=(await readState(page)).board;
  await dockVisible(page,'burst');
  await action(page,'slot:0').press('ArrowRight');
  assert.deepEqual((await readState(page)).board,beforeMove.toReversed());
  assert.equal(await page.locator(':focus').getAttribute('data-board'),'1');
  await page.keyboard.press('Delete');
  assert.deepEqual((await readState(page)).board,[beforeMove[1]]);
  assert.equal(await page.locator(':focus').getAttribute('data-hand'),String((await readState(page)).hand.length-1));
  await action(page,'burst').click();
  await page.locator('.last-strike').waitFor();
  await noOverflow(page,'desktop battle');
  assert.deepEqual(errors,[]);
  await page.close();

  const shop=await openPage({viewport:{width:1366,height:768},reducedMotion:'reduce'},fixture('shop'));
  const s=shop.page;
  await action(s,'resume').click();
  await action(s,'shopTab:forge').click();
  await action(s,'remove').click();
  const confirm=s.locator('.remove-dialog [data-craft-confirm]');
  assert(await confirm.isDisabled());
  await s.locator('[data-craft-card="0"]').press('Enter');
  await confirm.press('Enter');
  await s.locator('.removal-scene').waitFor();
  assert.equal((await readState(s)).deck.length,14);
  assert.equal(await s.locator('.removal-sparks i').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.deepEqual(shop.errors,[]);
  await s.close();
}

try {
  for(const [name,device,width,height] of profiles) {
    if(useWebKit&&device==='Pixel 7') continue;
    const options={...devices[device],viewport:{width,height}};
    await battleFlow(options);
    console.log(`PASS ${name} ${width}×${height} menu → map → placement → move → return → HOLD → BURST → reload`);
    if(width===390) {
      await combatEffects(options);
      await phaseGauges(options);
      await commandFeedback(options);
      await tacticalClarity(options);
      await enchantmentFlow(options);
      await attenuationFlow(options);
      console.log('PASS enchantment event and relic grants, spell class, attenuation success and failure');
      console.log('PASS divination → 3 visual hits → shatter → breach relic');
      console.log('PASS static HOLD and BURST labels, lethal intent and winning forecast, provisional refund');
    }
    if(width===320||width===390) {
      await relicExchange(options);
      console.log(`PASS relic exchange ${width}×${height} comparison → reload receipt → decline`);
    }
    if(width===320||width===390) await rewardRelicHints(options);
    if(width===320||width===390||width===932) {
      await facilityFlow(options);
      console.log(`PASS ${name} ${width}×${height} rewards → shop → deck/removal → forge → event`);
    }
  }
  if(!useWebKit) {
    await desktopFlow();
    console.log('PASS desktop Chrome 1366×768 drag placement → BURST, keyboard removal / reduced motion');
  }
} finally {
  await browser.close();
}
