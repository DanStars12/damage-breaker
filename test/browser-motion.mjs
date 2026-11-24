import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Run} from '../src/run.mjs';
import {writeCheckpoint} from '../src/checkpoint.mjs';

const {chromium,firefox,webkit}=await import(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const markup=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const origin='http://damage-breaker.test/';
const key='damage-breaker.v01';

function battleFixture(seed) {
  const run=new Run('motion-matrix-'+seed);
  const node=run.map.flat().find(n=>n.kind==='fight');
  run.routes=[node.id];assert(run.route(node.id));
  run.enemy.hp=10000n;run.enemy.max=10000n;run.enemy.armor=1;run.enemy.barrier=0;
  run.enemy.gates=[];run.enemy.originalGates=[];
  run.enemy.cycle=['attack'];
  run.board=[
    {kind:'add',value:10,tier:0,cost:1},
    {kind:'mul',value:3,tier:0,cost:1}
  ];
  return run;
}
async function setup(browser,{width=390,reducedMotion='reduce',preference,seed='default'}={}) {
  const page=await browser.newPage({
    viewport:{width,height:width===390?844:768},
    hasTouch:width===390, reducedMotion
  });
  page.setDefaultTimeout(9000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(origin,route=>route.fulfill({contentType:'text/html',body:markup}));
  const payload={best:{max:'0'},runs:[],prefs:preference===undefined?{}:{motion:preference},
    checkpoint:writeCheckpoint({run:battleFixture(seed)})};
  await page.addInitScript(({key,payload})=>localStorage.setItem(key,JSON.stringify(payload)),{key,payload});
  await page.goto(origin);
  await page.locator('[data-action="resume"]').click();
  return {page,errors};
}
const mode=page=>page.locator('#app').getAttribute('data-motion');
const opacity=(page,selector)=>page.locator(selector).evaluate(el=>Number(getComputedStyle(el).opacity));
const display=(page,selector)=>page.locator(selector).evaluate(el=>getComputedStyle(el).display);
async function runAnimatedScenario(engine,browser,{reducedMotion,preference,width,expected,label}) {
  const {page,errors}=await setup(browser,{reducedMotion,preference,width,seed:engine+'-'+label});
  assert.equal(await mode(page),expected,engine+' '+label+' effective mode');
  assert.notEqual(await display(page,'.enemy .burst-scene'),'none',engine+' '+label+' effect layer');
  await page.locator('[data-action="burst"]').click();
  await page.locator('#reel:not([hidden])').waitFor({state:'visible'});
  assert(await page.locator('#reelNumber').isVisible(),engine+' '+label+' readable numeric reel');
  await page.locator('.enemy.burst-firing').waitFor({state:'attached'});
  if(expected==='calm') {
    assert((await opacity(page,'.enemy.burst-firing .burst-bolt'))>.5,engine+' calm launch appears');
    assert.notEqual(await display(page,'.enemy.burst-firing .burst-bolt'),'none');
  }
  await page.locator('.enemy.player-strike').waitFor({state:'attached'});
  if(expected==='calm') {
    assert((await opacity(page,'.enemy.player-strike #outgoing'))>.9,engine+' calm damage text persists');
    assert((await opacity(page,'.enemy.player-strike .burst-ring:not(.echo)'))>.5,engine+' calm impact symbol persists');
  }
  await page.locator('.last-strike').waitFor();
  assert.match(await page.locator('.last-strike').innerText(),/BURST/);
  assert.deepEqual(errors,[],engine+' '+label+' JS errors');
  await page.close();
  console.log('PASS '+engine+' '+label+' '+width+'px '+reducedMotion+' -> '+expected);
}
async function explicitOff(engine,browser) {
  const {page,errors}=await setup(browser,{reducedMotion:'reduce',preference:'off',seed:engine+'-off'});
  assert.equal(await mode(page),'off');
  await page.locator('[data-action="burst"]').click();
  await page.locator('.last-strike').waitFor();
  assert.equal(await page.locator('#reel:not([hidden])').count(),0,'explicit skip has no reel');
  assert.deepEqual(errors,[]);
  await page.close();
}
async function backgroundPause(browser) {
  const {page,errors}=await setup(browser,{reducedMotion:'no-preference',preference:'full',width:1280,seed:'background'});
  await page.locator('[data-action="burst"]').click();
  await page.locator('#reel:not([hidden])').waitFor({state:'visible'});
  await page.evaluate(()=>{
    window.__motionTestHidden=true;
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__motionTestHidden});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const before=await page.locator('#stepProgress').evaluate(el=>el.style.width);
  await page.waitForTimeout(950);
  assert.equal(await page.locator('#stepProgress').evaluate(el=>el.style.width),before,
    'timeline does not progress while tab hidden');
  assert(await page.locator('#reel:not([hidden])').isVisible(),
    'timeline remains available after background throttling');
  await page.evaluate(()=>{
    window.__motionTestHidden=false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.locator('.last-strike').waitFor();
  assert.deepEqual(errors,[]);
  await page.close();
  console.log('PASS Chromium background visibility pause/resume without silently skipping combat');
}
const engines=[
  ['Chromium',chromium],
  ['Firefox',firefox],
  ['WebKit',webkit]
];
for(const [engine,driver] of engines) {
  const browser=await driver.launch();
  try {
    await runAnimatedScenario(engine,browser,{label:'OS-reduced default',width:390,
      reducedMotion:'reduce',expected:'calm'});
    await runAnimatedScenario(engine,browser,{label:'explicit full overrides OS',width:1280,
      reducedMotion:'reduce',preference:'full',expected:'full'});
    await runAnimatedScenario(engine,browser,{label:'lightweight remains visible',width:390,
      reducedMotion:'no-preference',preference:'fast',expected:'fast'});
    await explicitOff(engine,browser);
    if(engine==='Chromium') await backgroundPause(browser);
  } finally {
    await browser.close();
  }
}
