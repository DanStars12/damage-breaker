import {random,shuffle} from './cards.mjs';
import {encounterCount} from './enemies.mjs';
export const places={
  fight:{name:'通常戦闘',desc:'金貨とカード'},
  event:{name:'封書の間',desc:'ランダムイベント'},
  rest:{name:'休憩所',desc:'回復か鍛冶'},
  elite:{name:'デフレーション',desc:'特殊攻撃・レリック'},
  shop:{name:'旅商人',desc:'購入・合成・削除'},
  boss:{name:'ボス',desc:'ACTの最終戦'}
};
export function makeMap(seed,act) {
  const rng=random(seed+'/map/'+act);
  const encounterRng=random(seed+'/map-expansion/'+act);
  const facilities=['event','rest','shop'];
  const types=[['fight','fight','fight'],facilities,['fight','elite','fight'],
    ['fight','rest','shop'],['fight','elite','elite'],facilities,
    ['fight','fight','elite'],['event','shop','rest'],['fight','elite','fight'],['boss']];
  const rows=types.map((kinds,row)=>shuffle(kinds,rng).map((kind,i)=>{
    const roll=rng();
    const count=encounterCount(act,kind)||3;
    // Keep the original rolls and links for the encounters outside the expansion pool.
    const baseCount=kind==='fight'?8:count;
    const variant=kind==='fight'&&encounterRng()<(count-baseCount)/count?
      baseCount+Math.floor(roll*(count-baseCount)):Math.floor(roll*baseCount);
    return {id:row+'-'+i,row,col:kind==='boss'?1:i,kind,variant,next:[]};
  }));
  rows.forEach((nodes,row)=>nodes.forEach(node=>{
    const next=rows[row+1]||[];
    const neighbors=next.filter(n=>Math.abs(n.col-node.col)<=1);
    node.next=neighbors.filter((n,i)=>n.col===node.col||next.length===1||row===0||
      (node.col===1&&i===row%2*2)||rng()<.66).map(n=>n.id);
  }));
  return rows;
}
