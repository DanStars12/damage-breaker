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
  await eligible.tap();
  await dockVisible(page,'burst');
  await settle(page);
  await noOverflow(page,'battle');
  const firstCard=page.locator('.hand button:not(:disabled)').first();
  const handWidth=(await firstCard.boundingBox()).width;
  await firstCard.tap();
  assert.equal((await firstCard.boundingBox()).width,handWidth);
  await firstCard.tap();
  const {board,energy}=await readState(page);
  assert.equal(board.length,2);
  await action(page,'slot:0').tap();
  await action(page,'shift:1').tap();
  assert.deepEqual((await readState(page)).board,[board[1],board[0]]);
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
  await action(p,'goldTake').tap();
  await action(p,'relicTake:1').tap();
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
  await action(s,'remove').tap();
  assert(await s.locator('#removeForm button').isDisabled());
  await s.locator('#removeCard').selectOption('1');
  await noOverflow(s,'removal dialog');
  await s.locator('#removePreview .result-card').waitFor();
  await s.locator('#removeForm button').tap();
  assert.equal((await readState(s)).deck.length,15);
  await noOverflow(s,'removal receipt');
  await action(s,'craftNext').tap();
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
  await rest.page.locator('#i').selectOption('0');
  await action(rest.page,'forge:power').tap();
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
  await action(page,'burst').click();
  await page.locator('.last-strike').waitFor();
  await noOverflow(page,'desktop battle');
  assert.deepEqual(errors,[]);
  await page.close();
}

try {
  for(const [name,device,width,height] of profiles) {
    if(useWebKit&&device==='Pixel 7') continue;
    const options={...devices[device],viewport:{width,height}};
    await battleFlow(options);
    console.log(`PASS ${name} ${width}×${height} menu → map → placement → move → return → HOLD → BURST → reload`);
    if(width===320||width===390||width===932) {
      await facilityFlow(options);
      console.log(`PASS ${name} ${width}×${height} rewards → shop → deck/removal → forge → event`);
    }
  }
  if(!useWebKit) {
    await desktopFlow();
    console.log('PASS desktop Chrome 1366×768 drag placement → BURST');
  }
} finally {
  await browser.close();
}
