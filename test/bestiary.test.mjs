import test from 'node:test';
import assert from 'node:assert/strict';
import {drawFace} from '../src/faces.mjs';
import {makeEnemy} from '../src/enemies.mjs';

test('all enemy encounters including EXTRA have distinct face silhouettes using their saved art keys',()=>{
  const enemies=[];
  for(let act=1;act<=3;act++) {
    for(const [kind,count] of [['fight',6],['elite',3],['boss',2]]) {
      for(let i=0;i<count;i++) enemies.push(makeEnemy(act,kind,i,5));
    }
  }
  enemies.push(makeEnemy(4,'extra',0));
  const silhouettes=new Set();
  assert.equal(new Set(enemies.map(e=>e.name)).size,34);
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
  assert.equal(silhouettes.size,34);
});
