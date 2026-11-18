import test from 'node:test';
import assert from 'node:assert/strict';
import {apply,CAP,format,damage,label} from '../src/math.mjs';
import {evaluate} from '../src/relics.mjs';
import {Run,prices} from '../src/run.mjs';
import {makeMap} from '../src/map.mjs';
import {makeEnemy} from '../src/enemies.mjs';
import {card,fused,generate,random,upgraded} from '../src/cards.mjs';

const a=(kind,value)=>card(kind,value);
const d=(kind,value,at)=>({kind,value,at,enemy:true});
test('all operations use exact rationals',()=>{
  const ops=[a('add',10),a('mul',3),a('pct',25),a('div',7),a('pow',2),a('exp',3),a('sub',1)];
  const n=ops.reduce(apply,[20n,1n]);
  assert.deepEqual(n,[12656201n,49n]);
  assert.equal(damage(n),258289n);
  assert.equal(damage([-1n,2n]),0n);
});
test('left-to-right order matters',()=>{
  const board=[a('add',10),a('mul',3)];
  assert.equal(evaluate({board}).final,90n);
  assert.equal(evaluate({board:board.reverse()}).final,70n);
});
test('cap, plus one, intermediate overflow then divide',()=>{
  assert.equal(format(CAP),'9999無量大数');
  assert.equal(format(CAP+1n),'∞');
  assert.notEqual(format(CAP,true),'∞');
  assert.equal(evaluate({base:CAP,board:[a('mul',100)],deb:[d('div',100,1)]}).final,CAP);
  assert.equal(evaluate({base:CAP,board:[a('add',1)]}).final,CAP+1n);
  assert.equal(evaluate({base:CAP+1n,deb:[d('sub',1,0)]}).final,CAP);
});
test('grimoire uses longest adjacent streak once',()=>{
  const owned=['grimoire'];
  assert.equal(evaluate({board:[a('add',100),a('mul',100)],owned}).final,144000000n);
  const board=[a('add',100),a('mul',120),a('add',150),a('exp',2),a('add',10),a('mul',11)];
  const p=evaluate({board,owned});
  assert.equal(p.triggers.length,1);
  assert.equal(p.triggers[0].op.value,3);
  assert.equal(p.final,p.normal[0]**3n);
  assert.equal(evaluate({board:board.slice(0,2),deb:[d('sub',1,1)],owned}).triggers.length,0);
});
test('tail, ascending, short, chain, and star conditions',()=>{
  const board=[a('add',10),a('add',20),a('add',30)];
  const p=evaluate({board,owned:['tail','order','short','chain','star']});
  assert.equal(p.final,80n*36n*72n*8n);
  assert.deepEqual(p.triggers.map(t=>t.id),['tail','order','short']);
  const q=evaluate({board:[...board,a('mul',2),a('exp',2)],owned:['chain','star']});
  assert.equal(q.final,16000n*30n*100n);
});
test('debuff positions, division relics, percentage, seal, and armor',()=>{
  const board=[a('add',100),a('mul',3)];
  const deb=[d('div',10,1)];
  assert.equal(evaluate({board,deb}).final,36n);
  assert.equal(evaluate({board,deb,owned:['prism']}).final,3600n);
  assert.equal(evaluate({board,deb,owned:['key']}).final,360n);
  assert.equal(evaluate({board,deb:[d('pct',-25,1)],armor:2}).final,135n);
  assert.equal(evaluate({board,deb:[d('seal',0,1)]}).final,120n);
  assert.equal(evaluate({board,deb:[d('sub',150,1)]}).final,0n);
});
test('seed reproduces card values, tiers and hand; ACT locks special families',()=>{
  const make=(seed,act)=>Array.from({length:300},(_,i)=>i).reduce(({rng,cards})=>({rng,cards:[...cards,generate(rng,act)]}),{rng:random(seed),cards:[]}).cards;
  const samples=make('abc',3);
  assert.deepEqual(samples,make('abc',3));
  assert.notDeepEqual(samples,make('xyz',3));
  assert.equal(new Set(samples.map(c=>c.tier)).size,5);
  assert(samples.some(c=>c.kind==='pow'));
  assert(samples.some(c=>c.kind==='exp'));
  assert(make('abc',1).every(c=>['mul','add','pct'].includes(c.kind)));
  assert.equal(label(a('exp',3)),'×10³');
  const r1=new Run('same'),r2=new Run('same');
  assert(r1.route(r1.routes[0]));assert(r2.route(r2.routes[0]));
  assert.deepEqual(r1.hand,r2.hand);
});
test('HOLD keeps board, advances intent and blocks a third HOLD',()=>{
  const r=new Run('qa');r.route(r.routes[0]);r.enemy.cycle=['attack','div'];
  assert.equal(r.deck.length,15);
  assert.equal(r.hand.length,5);
  assert.equal(r.energy,3);
  assert(r.play(0));
  const only=r.board[0];
  assert(r.hold());
  assert.equal(r.hp,95);
  assert.equal(r.board[0],only);
  assert(r.hold());
  assert.equal(r.deb[0].kind,'div');
  assert.equal(r.hold(),false);
  r.burst();
  assert.equal(r.board.length,0);
  assert.equal(r.holds,0);
});
test('ward and cleanse are separate from ordinary slots',()=>{
  const r=new Run('aux');r.route(r.routes[0]);r.enemy.cycle=['attack','div'];
  r.turn=1;
  r.hand=[a('ward',0)];
  assert(r.play(0));
  assert(r.hold());
  assert.equal(r.ward,false);
  assert.equal(r.deb.length,0);
  r.deb=[d('div',2,1)];
  r.hand=[a('clean',0)];
  assert(r.play(0));
  assert.equal(r.deb.length,0);
  assert.equal(r.board.length,0);
});
test('branch upgrade and fusion use exact integer values',()=>{
  assert.equal(upgraded(a('mul',100),'power').value,200);
  assert.equal(upgraded(a('mul',100),'adjust').value,120);
  assert.equal(fused(a('mul',2),a('mul',2)).value,4);
  assert.equal(fused(a('add',100),a('add',100)).value,200);
  assert.equal(fused(a('pow',2),a('pow',2)),null);
  assert.equal(fused(a('exp',2),a('exp',2)),null);
});
const kill=r=>{r.enemy.barrier=0;r.enemy.gates=[];r.enemy.hp=1n;r.burst();};
const forceNode=(r,kind)=>{
  const node=r.map.flat().find(n=>n.kind===kind);
  r.phase='map';r.routes=[node.id];
  assert(r.route(node.id));return node;
};
test('seeded map branches, rejects unreachable nodes, and always ends at boss',()=>{
  for(let act=1;act<=3;act++) {
    const map=makeMap('atlas',act);
    assert.deepEqual(map,makeMap('atlas',act));
    assert.notDeepEqual(map,makeMap('other',act));
    assert.equal(map.length,10);
    assert.equal(map.at(-1).length,1);
    assert.equal(map.at(-1)[0].kind,'boss');
    assert(map.slice(0,-1).flat().every(n=>n.next.length>=1));
    assert(map[0].every(n=>n.next.length>=2));
  }
  const r=new Run('atlas');
  assert.equal(r.route(r.map.at(-1)[0].id),false);
  assert(r.route(r.routes[0]));
  kill(r);assert(r.takeCard(0));assert(!r.takeCard(1));assert(r.chooseGold(true));
  r.advance();assert.deepEqual(r.routes,r.map[0].find(n=>n.id===r.node.id).next);
});
test('shops sell multiple cards, limit other services, and cannot charge for invalid actions',()=>{
  const r=new Run('shop');const node=forceNode(r,'shop');r.gold=300;
  assert(r.service({action:'buy',i:0}));
  assert.equal(r.service({action:'buy',i:0}),null);
  assert(r.service({action:'buy',i:1}));
  assert(r.service({action:'relic',i:0}));
  assert.equal(r.service({action:'relic',i:1}),null);
  assert.equal(r.service({action:'fuse',i:0,j:0}),null);
  assert.equal(r.service({action:'fuse',i:0,j:1}).result.value,22);
  assert.equal(r.service({action:'fuse',i:2,j:3}),null);
  const beforeRemove=[...r.deck];
  const beforeFee=r.gold;
  for(const i of [undefined,'length',NaN,-1,r.deck.length]) {
    assert.equal(r.service({action:'remove',i}),null);
  }
  assert.deepEqual(r.deck,beforeRemove);
  assert.equal(r.gold,beforeFee);
  assert.equal(r.service({action:'remove',i:2}).sources[0],beforeRemove[2]);
  assert.deepEqual(r.deck,beforeRemove.filter((_,i)=>i!==2));
  assert.equal(r.service({action:'remove',i:3}),null);
  assert.equal(r.gold,300-2*prices.buy-prices.relic-prices.fuse-prices.remove);
  assert.equal(r.deck.length,15);
  r.leaveNode();assert.deepEqual(r.routes,node.next);
});
test('rest site allows exactly one forge or heal',()=>{
  const r=new Run('rest');forceNode(r,'rest');r.hp=45;
  assert.equal(r.service({action:'forge',i:0,mode:'power'}).result.value,20);
  assert.equal(r.service({action:'heal'}),null);
  assert.equal(r.hp,45);
  forceNode(r,'rest');assert(r.service({action:'heal'}));assert.equal(r.hp,80);
  assert.equal(r.service({action:'forge',i:1,mode:'power'}),null);
});
test('elite drops and boss drops are unowned; boss advances act and extra is optional',()=>{
  const r=new Run('drops');assert(r.route(r.routes[0]));kill(r);
  assert.equal(r.relicDrop,null);
  forceNode(r,'elite');kill(r);assert.deepEqual(r.owned,[]);
  r.advance();assert.equal(r.phase,'reward');
  assert(r.chooseRelic(false));assert(!r.chooseRelic(true));assert.deepEqual(r.owned,[]);
  forceNode(r,'elite');kill(r);assert(r.chooseRelic(true));assert.deepEqual(r.owned,[r.relicDrop]);
  for(let act=1;act<=3;act++) {
    forceNode(r,'boss');kill(r);assert(r.chooseRelic(true));assert.equal(r.owned.length,act+1);assert(r.skipCard());assert(r.chooseGold(true));r.advance();
  }
  assert.equal(r.phase,'clear');r.extra();
  kill(r);assert.equal(r.phase,'reward');assert(r.chooseRelic(true));assert(r.chooseGold(true));r.advance();assert.equal(r.phase,'win');assert.equal(new Set(r.owned).size,5);
  assert.doesNotThrow(()=>JSON.stringify(r.summary()));
});
test('each act has three elite variants and two bosses with capped scaling',()=>{
  for(let act=1;act<=3;act++) {
    const all=['elite','boss'].flatMap(kind=>Array.from({length:kind==='elite'?3:2},(_,i)=>makeEnemy(act,kind,i,6)));
    assert.equal(new Set(all.map(e=>e.name)).size,5);
  }
  const base=makeEnemy(3,'boss',0,6);
  assert.equal(makeEnemy(3,'boss',0,6,10n**80n).max,base.max*400n);
});
test('barriers block exactly twice; gated boss requires three positive hits',()=>{
  const r=new Run('ward');r.act=1;r.start({kind:'boss',variant:0,row:6});
  const hp=r.enemy.hp;
  assert.equal(r.burst().impact.kind,'barrier');
  assert.equal(r.burst().impact.kind,'barrier');
  assert.equal(r.enemy.hp,hp);
  r.board=[a('add',100)];assert.equal(r.burst().impact.kind,'hit');
  r.act=3;r.start({kind:'boss',variant:0,row:6});
  for(let i=0;i<3;i++) {
    r.board=[a('exp',30)];r.burst();
    assert.equal(r.phase,i===2?'reward':'battle');
  }
});
test('enemy seals target one operation type, HP/base curses resolve and relic trades stack',()=>{
  const r=new Run('trade');r.act=3;r.owned=['furnace','codex','rack','spring'];
  r.start({kind:'boss',variant:1,row:6});
  assert.equal(r.hp,95);assert.equal(r.capacity,7);assert.equal(r.hand.length,4);assert.equal(r.base,32);assert.equal(r.slots,9);
  r.hp=100;r.enemyAction();assert.equal(r.maxHp,86);assert.equal(r.hp,86);assert.equal(r.capacity,5);assert.equal(r.drawCount,6);
  r.enemyAction();r.board=[a('add',100),a('pow',2)];assert.equal(r.preview().steps.find(s=>s.card.kind==='pow').op,null);
  r.enemy.cycle=['drain'];r.enemyAction();assert.equal(r.base,7);
});

test('additive relic requires only active addition panels and scales by count',()=>{
  assert.equal(evaluate({board:[a('add',10),a('add',20)],owned:['sum']}).final,6000n);
  assert.equal(evaluate({board:[a('add',10),a('mul',2)],owned:['sum']}).final,60n);
  assert.equal(evaluate({board:[],owned:['sum']}).final,20n);
  const two=[a('add',10),a('add',20)];
  assert.equal(evaluate({board:two,owned:['abacus']}).final,50n);
  assert.equal(evaluate({board:[...two,a('add',30)],owned:['abacus']}).final,6400n);
  assert.equal(evaluate({board:[...two,a('mul',3)],owned:['abacus']}).final,150n);
  const four=[...two,a('add',30),a('add',40)];
  assert.equal(evaluate({board:four,owned:['abacus']}).final,120n**2n);
  const five=[...four,a('add',50)];
  assert.equal(evaluate({board:five,owned:['abacus']}).final,170n**3n);
  assert.equal(evaluate({board:[...five,a('mul',2)],owned:['abacus']}).final,340n);
  assert.equal(evaluate({board:five,deb:[d('seal',0,1)],owned:['abacus']}).final,150n**2n);
});
test('random events charge only when their entire offer can be accepted',()=>{
  const r=new Run('event');forceNode(r,'event');r.event='courier';r.gold=14;
  assert.equal(r.service({action:'event'}),null);assert.equal(r.deck.length,15);
  r.gold=15;
  const shown=r.eventOffer.result;
  assert.deepEqual(r.eventOffer.result,shown);
  const accepted=r.service({action:'event'});
  assert.deepEqual(accepted.result,shown);assert.deepEqual(r.deck.at(-1),shown);
  assert.equal(accepted.gold,-15);assert.equal(r.gold,0);assert.equal(r.deck.length,16);
  forceNode(r,'event');r.event='duel';r.hp=9;
  assert.equal(r.service({action:'event'}),null);assert(r.service({action:'decline'}));assert.equal(r.hp,9);
});

test('battle reward choices are independent and applied once',()=>{
  const r=new Run('receipt');
  assert(r.route(r.routes[0]));kill(r);
  assert.equal(r.gold,20);
  assert.equal(r.rewardPending,true);
  r.advance();assert.equal(r.phase,'reward');
  assert(r.skipCard());assert(!r.takeCard(0));assert.equal(r.deck.length,15);
  assert(r.chooseGold(true));assert(!r.chooseGold(true));assert.equal(r.gold,44);
  assert.equal(r.rewardPending,false);
  r.advance();assert.equal(r.phase,'map');
  forceNode(r,'fight');kill(r);
  assert(r.chooseGold(false));assert.equal(r.gold,44);
  const card=r.offers[1];
  assert(r.takeCard(1));assert.deepEqual(r.cardDecision,{status:'taken',card});
  assert.equal(r.deck.at(-1),card);
});

test('only early elites offer a seeded, distinct second choice when eligible relics remain',()=>{
  const collect=(act,kind,owned=[])=>{
    const r=new Run('gear');
    r.act=act;
    r.owned=[...owned];
    r.beginMap();
    forceNode(r,kind);
    kill(r);
    return r;
  };
  const early=collect(1,'elite');
  assert(early.relicAlternative);
  assert.notEqual(early.relicDrop,early.relicAlternative);
  assert.equal(early.relicAlternative,collect(1,'elite').relicAlternative);
  assert.equal(collect(1,'boss').relicAlternative,null);
  assert.equal(collect(3,'elite').relicAlternative,null);
  assert.equal(collect(2,'elite',['sum','abacus','lattice','ratio','order','tail']).relicAlternative,null);
  assert(early.chooseRelic(false));
  assert.equal(early.chooseRelic(true,1),false);
  assert.deepEqual(early.owned,[]);
});

test('ACT III boss HP curves preserve dragon gates and the emperor barrier',()=>{
  const dragon=makeEnemy(3,'boss',0,9);
  const emperor=makeEnemy(3,'boss',1,9);
  assert.equal(dragon.max,8n*10n**18n);
  assert.deepEqual(dragon.gates,[dragon.max*2n/3n,dragon.max/3n]);
  assert.equal(emperor.max,5n*10n**18n);
  assert.equal(emperor.armor,2);
  assert.equal(emperor.barrier,2);
  const bench=6n*10n**19n;
  assert.equal(makeEnemy(3,'boss',0,9,bench).max,bench/2n);
  assert.equal(makeEnemy(3,'boss',1,9,bench).max,bench/3n);
  assert.equal(makeEnemy(3,'boss',1,9,10n**80n).max,emperor.max*400n);
});


test('boss attack follows the ACT curve and victory healing depends on encounter rank',()=>{
  for(const [i,attack] of [12,18,25].entries()) {
    for(const variant of [0,1]) {
      assert.equal(makeEnemy(i+1,'boss',variant,9).attack,attack);
    }
  }
  const r=new Run('recovery-by-rank');
  for(const [kind,recovery] of [['fight',7],['elite',13],['boss',28]]) {
    forceNode(r,kind);
    r.hp=40;
    kill(r);
    assert.equal(r.victoryHeal,recovery);
    assert.equal(r.hp,40+recovery);
  }
  forceNode(r,'fight');
  r.hp=98;
  kill(r);
  assert.equal(r.hp,100);
  assert.equal(r.victoryHeal,2);
});

test('only cards staged this turn can go back to hand and refund their exact cost',()=>{
  const r=new Run('return-to-hand');
  r.act=2;
  r.start({kind:'fight',variant:0,row:0});
  const locked=card('add',21), first=card('pow',2), second=card('mul',5);
  r.hand=[locked];
  assert(r.play(0));
  assert(r.hold());
  assert.equal(r.returnToHand(0),false);
  r.hand=[first,second];
  assert(r.play(0,0));
  assert(r.move(0,1));
  assert.equal(r.canReturn(0),false);
  assert.equal(r.canReturn(1),true);
  assert.equal(r.energy,0);
  assert(r.returnToHand(1));
  assert.equal(r.hand.at(-1),first);
  assert.equal(r.energy,first.cost);
  assert.equal(r.stats.usage.pow,undefined);
  assert(r.play(0));
  assert.equal(r.stats.usage.mul,1);
  r.burst();
  assert.equal(r.uncommittedCards.size,0);
  assert.equal(r.returnToHand(0),false);
});
