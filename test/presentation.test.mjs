import test from 'node:test';
import assert from 'node:assert/strict';
import {CAP} from '../src/math.mjs';
import {evaluate} from '../src/relics.mjs';
import {card,upgraded} from '../src/cards.mjs';
import {timeline,magnitude,reelValue} from '../src/presentation.mjs';

test('timeline preserves resolution order, exact relic value and armored damage',()=>{
  const result=evaluate({board:[card('add',10),card('mul',12),card('add',100),card('mul',101)],
    deb:[{kind:'div',value:2,at:2,enemy:true}],owned:['grimoire'],armor:3});
  const steps=timeline(result,3);
  assert.deepEqual(steps.map(s=>s.type),['card','card','enemy','card','card','relic','impact']);
  assert.deepEqual(steps.map(s=>s.combo),[1,2,2,3,4,4,4]);
  assert.deepEqual(steps[5].value,result.triggers[0].result);
  assert.deepEqual(steps.at(-1).value,[result.final,1n]);
});
test('reel samples preserve giant integer endpoints and fraction transitions',()=>{
  const from=[15n,1n],to=[CAP+1n,1n];
  assert.deepEqual(reelValue(from,to,0),from);
  assert.deepEqual(reelValue(from,to,12),to);
  assert(reelValue(from,to,10)[0]>reelValue(from,to,5)[0]);
  assert.deepEqual(reelValue(from,[31n,7n],8),from);
  assert.deepEqual(reelValue(from,[31n,7n],12),[31n,7n]);
  assert.equal(magnitude([CAP,1n]),6);
  assert.equal(magnitude([CAP+1n,1n]),7);
});
test('forge imprint preserves the operation and raises value to the selected final digit',()=>{
  const adjusted=upgraded(card('mul',38),'digit',2);
  assert.equal(adjusted.value,42);
  assert.equal(adjusted.kind,'mul');
  assert.equal(upgraded(adjusted,'digit',7),null);
  assert.equal(upgraded(card('add',10),'digit',0),null);
  assert.equal(upgraded(card('add',10),'digit',-1),null);
  assert.equal(upgraded(card('pow',2),'digit',7),null);
});
