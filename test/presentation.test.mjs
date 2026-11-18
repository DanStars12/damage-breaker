import test from 'node:test';
import assert from 'node:assert/strict';
import {CAP} from '../src/math.mjs';
import {evaluate} from '../src/relics.mjs';
import {card,upgraded} from '../src/cards.mjs';
import {timeline,magnitude,reelValue,impactForce,relicActivations,boardRelicStates,burstVisual,reelTiming} from '../src/presentation.mjs';

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

test('arena effects distinguish ordinary and large hits from defensive outcomes',()=>{
  const feel=(final,kind)=>impactForce({final,impact:{kind}});
  assert.equal(feel(9999n,'hit'),'standard');
  assert.equal(feel(10n**8n,'hit'),'great');
  assert.equal(feel(CAP,'hit'),'great');
  assert.equal(feel(CAP+1n,'hit'),'infinity');
  assert.equal(feel(CAP+1n,'barrier'),'ward');
  assert.equal(feel(CAP+1n,'gate'),'break');
  assert.equal(feel(0n,'miss'),'none');
});

test('relic feedback follows the real calculation order and respects DIV priority',()=>{
  const board=[card('add',20)];
  const deb=[{kind:'div',value:2,at:0,enemy:true},{kind:'div',value:5,at:1,enemy:true}];
  const both=evaluate({board,deb,owned:['key','prism','sum']});
  assert.deepEqual([...relicActivations(both)],['prism','sum']);
  const steps=timeline(both,1);
  assert.deepEqual(steps.filter(s=>s.relic).map(s=>s.relic),['prism','prism','sum']);
  assert.deepEqual(steps[0].value,[40n,1n]);
  assert.equal(steps[0].index,0);
  const cancelled=timeline(evaluate({board,deb,owned:['key']}),1);
  assert.equal(cancelled[0].relic,'key');
  assert.match(cancelled[0].name,/無効/);
  assert.deepEqual([...relicActivations(evaluate({board,owned:['prism','key','furnace']}))],[]);
});

test('board relic strip differentiates pending, already fired and continuous effects',()=>{
  const owned=['furnace','key','sum','short','grimoire'];
  const pending=evaluate({board:[card('add',20)],owned});
  const previous=evaluate({board:[card('mul',2)],deb:[{kind:'div',value:3,at:0,enemy:true}],owned});
  assert.deepEqual(boardRelicStates(owned,pending,previous),[
    {id:'furnace',fixed:true,ready:false,fired:false},
    {id:'key',fixed:false,ready:false,fired:true},
    {id:'sum',fixed:false,ready:true,fired:false},
    {id:'short',fixed:false,ready:true,fired:true}
  ]);
});

test('BURST passes through every digit on a large rise, using a different hue for each step',()=>{
  const from=[19n,1n],to=[2n*10n**44n,1n];
  const {samples,duration}=reelTiming(from,to,'relic',false);
  const colors=Array.from({length:samples+1},(_,i)=>burstVisual(reelValue(from,to,i,samples)));
  const digits=[...new Set(colors.map(value=>value.digits))];
  assert.deepEqual(digits,Array.from({length:44},(_,i)=>i+2));
  for(let i=1;i<colors.length;i++) {
    if(colors[i].digits!==colors[i-1].digits) assert.notEqual(colors[i].hue,colors[i-1].hue);
  }
  assert(duration>reelTiming(from,to,'relic',true).duration);
  assert.deepEqual(reelValue(from,to,samples,samples),to);
  assert.equal(burstVisual([CAP,1n]).level,6);
  assert.equal(burstVisual([CAP+1n,1n]).level,6); // Intermediate values still display as numbers.
  assert.equal(burstVisual([CAP+1n,1n],true).level,7);
});
