import test from 'node:test';
import assert from 'node:assert/strict';
import {helpGuide} from '../src/help-guide.mjs';
import {apply,damage} from '../src/math.mjs';

const html=helpGuide();

test('beginner guide has an open quick-start and seven collapsed reference sections',()=>{
  const headings=[...html.matchAll(/<summary>([^<]+)<\/summary>/g)].map(m=>m[1]);
  assert.equal(headings.length,8);
  assert.deepEqual(headings.map(s=>Number(s.slice(0,2))),[1,2,3,4,5,6,7,8]);
  assert.equal((html.match(/class="guide-section" open/g)||[]).length,1);
  assert.equal((html.match(/<\/details>/g)||[]).length,8);
  assert(html.indexOf('01 ·')<html.indexOf('02 ·'));
  assert(html.includes('まずは1戦'));
  assert(html.includes('敵の次の行動'));
});

test('guide covers all primary controls and mechanics without outdated intercept mode',()=>{
  for(const term of [
    'HOLD','BURST','反撃減衰','防御カード','結界カード','浄化カード','バリア','耐久ライン',
    '＋50%','−25%','累乗','指数','演算妨害','再現','蓄力','招札',
    'レリック','星詠みの頁','図鑑','スマホ','PC','Delete','×10²',
    '9999無量大数','手札に戻す','仮置き','エネルギー','装甲','スキップ'
  ]) assert(html.includes(term),term+' not explained');
  assert(!html.includes('迎撃BURST'),'retired intercept mode must not be taught');
  assert(!html.includes('押しっぱなし'),'unsupported input method');
});

test('worked examples follow precise rational computation including percentage and exponent',()=>{
  const add=apply([20n,1n],{kind:'add',value:10});
  const mul=apply(add,{kind:'mul',value:3});
  const reverse=apply(apply([20n,1n],{kind:'mul',value:3}),{kind:'add',value:10});
  assert.equal(damage(mul),90n);
  assert.equal(damage(reverse),70n);
  assert.equal(damage(apply([90n,1n],{kind:'pct',value:50})),135n);
  assert.equal(damage(apply([90n,1n],{kind:'exp',value:2})),9000n);
  assert.match(html,/90/);
  assert.match(html,/70/);
  assert.match(html,/9000/);
});

test('help content is safe standalone markup without script or injected handlers',()=>{
  assert(!/<script|onerror=|onclick=|javascript:/i.test(html));
  assert.equal((html.match(/<ol/g)||[]).length,(html.match(/<\/ol>/g)||[]).length);
  assert.match(html,/class="guide-equation"/);
  assert.match(html,/class="guide-warning"/);
});
