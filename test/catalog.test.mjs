import test from 'node:test';
import assert from 'node:assert/strict';
import {enemyCatalog,relicCatalog,enemyKey,normalizeCodex,
  discoverEnemy,discoverRelics,inheritCodex,catalogMoveName} from '../src/catalog.mjs';
import {codexContents,codexPageSize} from '../src/codex-ui.mjs';
import {relics} from '../src/relics.mjs';
import {Run} from '../src/run.mjs';
import {paintEnemyFinish} from '../src/enemy-finish.mjs';
import {paintEnemy} from '../src/bestiary.mjs';

const blank=()=>({enemies:[],relics:[]});
test('stable catalog lists all 52 distinct enemy identities and every obtainable relic',()=>{
  assert.equal(enemyCatalog.length,52);
  assert.equal(new Set(enemyCatalog.map(e=>e.id)).size,52);
  assert.equal(new Set(enemyCatalog.map(e=>e.name)).size,52);
  assert.equal(new Set(enemyCatalog.map(e=>e.art.form+':'+e.art.palette)).size,52);
  assert.equal(enemyCatalog.filter(e=>e.kind==='fight').length,30);
  assert.equal(enemyCatalog.filter(e=>e.kind==='elite').length,12);
  assert.equal(enemyCatalog.filter(e=>e.kind==='boss').length,9);
  assert.equal(enemyCatalog.filter(e=>e.kind==='extra').length,1);
  assert.deepEqual(relicCatalog.map(e=>e.id),Object.keys(relics));
  assert.equal(enemyKey(4,'extra',0),'4:extra:0');
  assert.match(catalogMoveName('lock:add'),/加算封印/);
  assert.match(catalogMoveName('pursuit'),/追撃/);
});

test('discovery is idempotent, ignores invalid IDs and does not expose unearned items',()=>{
  const codex=normalizeCodex({enemies:['bad','1:fight:0','1:fight:0',42],
    relics:['unknown','sum','sum',null]});
  assert.deepEqual(codex,{enemies:['1:fight:0'],relics:['sum']});
  assert.equal(discoverEnemy(codex,1,'fight',0),false);
  assert.equal(discoverEnemy(codex,1,'fight',1),true);
  assert.equal(discoverEnemy(codex,9,'fight',0),false);
  assert.equal(discoverRelics(codex,['sum','sum','abacus','bad']),true);
  assert.equal(discoverRelics(codex,['sum','abacus']),false);
  assert.deepEqual(codex.relics,['sum','abacus']);
});

test('old save history and a current checkpoint recover proven discoveries without changing RNG',()=>{
  const run=new Run('codex-legacy');
  const node=run.map.flat().find(n=>n.kind==='fight');
  run.routes=[node.id];assert(run.route(node.id));
  run.owned=['ratio','furnace'];
  run.visited=[node.id];
  const state=run.rng.state();
  const codex=inheritCodex(null,[{relics:['sum','ratio']},{relics:['key']}],run);
  assert.equal(run.rng.state(),state);
  assert.deepEqual(new Set(codex.relics),new Set(['sum','ratio','key','furnace']));
  assert(codex.enemies.includes(enemyKey(1,'fight',node.variant)));
  assert.equal(inheritCodex(codex,[{relics:['sum']}],run).enemies.length,codex.enemies.length);
  assert.equal(inheritCodex(codex,[{relics:['sum']}],run).relics.length,codex.relics.length);
});

test('codex hides names, art and descriptions for undiscovered entries; filters and details unlock',()=>{
  const empty=codexContents(blank());
  assert.match(empty,/0\/52/);
  assert.match(empty,/？？？/);
  assert(!empty.includes(enemyCatalog[0].name));
  assert(!empty.includes('data-codex-art='));
  assert.equal((empty.match(/class="codex-entry is-locked"/g)||[]).length,codexPageSize);
  const lockedRelics=codexContents(blank(),{tab:'relics'});
  assert(!lockedRelics.includes(relicCatalog[0].name));
  assert(!lockedRelics.includes(relicCatalog[0].description));
  const codex=blank();
  const foe=enemyCatalog[0],relic=relicCatalog[0];
  assert(discoverEnemy(codex,foe.act,foe.kind,foe.variant));
  assert(discoverRelics(codex,[relic.id]));
  const known=codexContents(codex,{filter:'known',selected:foe.id});
  assert.match(known,/1\/52/);
  assert(known.includes(foe.name));
  assert(known.includes('data-codex-art="'+foe.id+'"'));
  assert.match(known,/主な行動/);
  const relicView=codexContents(codex,{tab:'relics',filter:'known',selected:relic.id});
  assert(relicView.includes(relic.description));
  assert(relicView.includes(relic.name));
  assert(!relicView.includes('data-codex-art='));
  const unknown=codexContents(codex,{filter:'unknown'});
  assert(!unknown.includes(foe.name));
});

test('fine pixel pass adds deterministic material details without leaving 88×64 bounds',()=>{
  const colors={ink:'#111',shade:'#333',mid:'#666',light:'#aaa',glow:'#fff'};
  for(const {art,name} of enemyCatalog) {
    const marks=[];
    const ctx={fillRect(x,y,w,h){marks.push([x,y,w,h,this.fillStyle]);}};
    paintEnemyFinish(ctx,art,colors);
    assert(marks.length>=20,name+' has too little finishing detail');
    assert(marks.every(([x,y,w,h])=>Number.isInteger(x)&&Number.isInteger(y)&&
      x>=0&&x+w<=88&&y>=0&&y+h<=64),name+' out-of-bounds finish');
    const second=[];
    paintEnemyFinish({fillRect(x,y,w,h){second.push([x,y,w,h,this.fillStyle]);}},art,colors);
    assert.deepEqual(marks,second,name+' unstable pixels');
  }
});

test('full enemy artist uses native 88×64 context and keeps smoothing disabled',()=>{
  for(const entry of enemyCatalog) {
    let draws=0;
    const context={
      fillStyle:'',strokeStyle:'',lineWidth:1,
      clearRect(){},fillRect(){draws++;},beginPath(){},moveTo(){},lineTo(){},
      closePath(){},fill(){},stroke(){},ellipse(){},save(){},restore(){},translate(){},scale(){}
    };
    const canvas={getContext(){return context;}};
    assert.doesNotThrow(()=>paintEnemy(canvas,entry.art),entry.name);
    assert.equal(context.imageSmoothingEnabled,false,entry.name);
    assert(draws>20,entry.name+' missing pixel details');
  }
});
