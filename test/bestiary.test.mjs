import test from 'node:test';
import assert from 'node:assert/strict';
import {drawFace} from '../src/faces.mjs';
import {makeMap} from '../src/map.mjs';
import {encounterCount, makeEnemy} from '../src/enemies.mjs';

test('all enemy encounters including EXTRA have distinct face silhouettes using their saved art keys',()=>{
  const enemies=[];
  for(let act=1;act<=3;act++) {
    for(const kind of ['fight','elite','boss']) {
      const count=encounterCount(act,kind);
      for(let i=0;i<count;i++) enemies.push(makeEnemy(act,kind,i,5));
    }
  }
  enemies.push(makeEnemy(4,'extra',0));
  const silhouettes=new Set();
  assert.equal(new Set(enemies.map(e=>e.name)).size,46);
  assert(enemies.every(e=>/^[ァ-ヺー・]+$/.test(e.name)));
  for(const {name,art:{form,palette}} of enemies) {
    let path, silhouette;
    const context={
      beginPath(){path=[];},
      moveTo(x,y){path.push([x,y]);},
      lineTo(x,y){path.push([x,y]);},
      closePath(){},
      fill(){assert.equal(typeof this.fillStyle,'string',name);silhouette??=JSON.stringify(path);},
      fillRect(){assert.equal(typeof this.fillStyle,'string',name);}
    };
    drawFace(context,form,palette,0,0,1,{ink:'#100e1b',shade:'#333',steel:'#666',light:'#999'});
    assert(silhouette,name+' has no face');
    assert(!silhouettes.has(silhouette),name+' has a repeated silhouette');
    silhouettes.add(silhouette);
  }
  assert.equal(silhouettes.size,46);
});

test('seeded maps can roll every ACT encounter variant',()=>{
  for(let act=1;act<=3;act++) {
    const rolled={fight:new Set(),elite:new Set(),boss:new Set()};
    for(let i=0;i<128;i++) {
      const seed='bestiary-'+i;
      const map=makeMap(seed,act);
      assert.deepEqual(makeMap(seed,act),map);
      for(const node of map.flat()) {
        if(!rolled[node.kind]) continue;
        const enemy=makeEnemy(act,node.kind,node.variant,node.row);
        assert.equal(enemy.variant,node.variant);
        rolled[node.kind].add(node.variant);
      }
    }
    assert.deepEqual(Object.values(rolled).map(variants=>variants.size),[8,4,3]);
  }
});
