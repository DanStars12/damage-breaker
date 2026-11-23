import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEnemy,intent,impact,attackHits,bossCounterplay} from '../src/enemies.mjs';

test('all existing ACT bosses advertise a counterplay tied to actual combat defenses',()=>{
  let barriers=0,gates=0,other=0;
  for(let act=1;act<=3;act++) for(let variant=0;variant<3;variant++) {
    const enemy=makeEnemy(act,'boss',variant,10);
    const move=intent(enemy,0,act);
    const hint=bossCounterplay(enemy,move);
    assert(hint?.text?.length>0,enemy.name);
    if(enemy.barrier) {
      barriers++;
      assert.equal(hint.kind,'barrier');
      assert.equal(impact(enemy,enemy.hp*10n).kind,'barrier');
      assert.match(hint.text,/HPを削れない/);
    } else if(enemy.gates.length) {
      gates++;
      assert.equal(hint.kind,'gate');
      assert.equal(impact(enemy,enemy.hp*10n).kind,'gate');
      assert.match(hint.text,/1BURSTで最大1本/);
    } else other++;
    enemy.barrier=0;
    enemy.gates=[];
    assert.equal(bossCounterplay(enemy,{kind:'pursuit',value:8}).kind,'multi');
    assert.equal(attackHits({kind:'pursuit'}),3);
    assert.match(bossCounterplay(enemy,{kind:'pursuit',value:8}).text,/3回攻撃/);
    assert.equal(bossCounterplay(enemy,{kind:'lock',value:0}).kind,'disruption');
    assert.equal(bossCounterplay(enemy,{kind:'shatter',value:8}).kind,'shatter');
    assert.match(bossCounterplay(enemy,{kind:'shatter',value:8}).text,/結界を破壊/);
    assert.equal(bossCounterplay(enemy,{kind:'attack',value:8}).kind,'attack');
  }
  assert(barriers>0&&gates>0&&other>0);
});
test('EXTRA gate count changes as phases are cleared, and regular mobs get no extra label',()=>{
  const enemy=makeEnemy(4,'extra',0,10);
  assert.equal(bossCounterplay(enemy,{kind:'double',value:4}).kind,'gate');
  assert.match(bossCounterplay(enemy,{kind:'double',value:4}).text,/残1本/);
  enemy.gates.shift();
  assert.equal(bossCounterplay(enemy,{kind:'double',value:4}).kind,'multi');
  assert.equal(bossCounterplay(makeEnemy(1,'fight',0,2),{kind:'attack',value:5}),null);
  assert.equal(bossCounterplay(makeEnemy(1,'elite',0,2),{kind:'attack',value:5}),null);
});
