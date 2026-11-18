import {apply,damage} from './math.mjs';
const numeric = c => !c.enemy && ['add','mul','pct'].includes(c.kind);
function streak(cards,key) {
  let last=null, run=0,best=0;
  for(const c of cards) {
    const digit=numeric(c)?key(String(c.value)):null;
    run=digit===null?0:digit===last?run+1:1;
    best=Math.max(best,run);
    last=digit;
  }
  return best;
}
export const relics = {
  grimoire:{name:'同頭累乗の魔導書',desc:'先頭数字が隣接で2枚以上一致。通常結果を最長連続枚数で累乗。', effect:({cards})=>{
    const n=streak(cards,s=>s[0]);
    return n>=2?{kind:'pow',value:n}:null;
  }},
  tail:{name:'末尾の銀印',desc:'末尾数字が隣接で2枚以上一致すると、連続枚数×12倍。',effect:({cards})=>{
    const n=streak(cards,s=>s.at(-1));
    return n>=2?{kind:'mul',value:n*12}:null;
  }},
  order:{name:'昇階の羅針盤',desc:'隣接する数字パネル3枚が厳密に昇順なら×72。',effect:({cards})=>
    cards.some((c,i)=>i>=2 && cards.slice(i-2,i+1).every(numeric) &&
      cards[i-2].value<cards[i-1].value && cards[i-1].value<c.value)?{kind:'mul',value:72}:null},
  short:{name:'三刻の指輪',desc:'自分の演算が1〜3枚なら×8。',effect:({count})=>count>0&&count<=3?{kind:'mul',value:8}:null},
  prism:{name:'反転の水晶',desc:'敵の除算を同じ値の乗算に反転。通常演算中に適用。'},
  key:{name:'除算封じの鍵',desc:'敵の除算を無効化。通常演算中に適用。'},
  chain:{name:'連鎖の砂時計',desc:'コンボ5以上のBURSTで×30。',effect:({combo})=>combo>=5?{kind:'mul',value:30}:null},
  furnace:{name:'炉心の契約',desc:'毎ターンのエナジー+1。ドロー−1。',energy:1,draw:-1},
  codex:{name:'貪読の書架',desc:'毎ターンのドロー+2。基礎値−35%。',draw:2,base:-35},
  rack:{name:'拡張の呪箱',desc:'演算枠+1。戦闘開始時にHPを5失う（最低HP1）。',slots:1,entry:5},
  spring:{name:'初動の砂漏れ',desc:'初ターンだけエナジー+2。初ターンのドロー−2。',firstEnergy:2,firstDraw:-2},
  mantle:{name:'護符の裏地',desc:'戦闘開始時に結界を張る。毎ターンのエナジー−1（最低1）。',ward:true,energy:-1},
  sum:{name:'千和の石版',desc:'有効な自分のパネルがすべて加算なら、1枚につき×60（最大×540）。',effect:({own})=>
    own.length&&own.every(c=>c.kind==='add')?{kind:'mul',value:own.length*60}:null},
  abacus:{name:'万算の算盤',desc:'有効な自分のパネルが3枚以上で、すべて加算なら演算結果を二乗。5枚以上なら三乗。',effect:({own})=>
    own.length>=3&&own.every(c=>c.kind==='add')?{kind:'pow',value:own.length>=5?3:2}:null},
  lattice:{name:'積算の六面晶',desc:'有効な自分のパネルが2枚以上で、すべて乗算なら×144。',effect:({own})=>
    own.length>=2&&own.every(c=>c.kind==='mul')?{kind:'mul',value:144}:null},
  mosaic:{name:'五紋の標本箱',desc:'違う演算を4種類以上使うと×360。',effect:({own})=>
    new Set(own.map(c=>c.kind)).size>=4?{kind:'mul',value:360}:null},
  ratio:{name:'比率の天球儀',desc:'割合パネルを2枚以上使うと、1枚につき×48。',effect:({own})=>{
    const n=own.filter(c=>c.kind==='pct').length;
    return n>=2?{kind:'mul',value:n*48}:null;
  }},
  reserve:{name:'空席の番人',desc:'演算枠−1。毎ターンのドロー+1。',slots:-1,draw:1},
  tithe:{name:'双刃の燭台',desc:'毎ターンのエナジー+1。戦闘開始時にHPを8失う（最低HP1）。',energy:1,entry:8},
  star:{name:'千星の象牙盤',desc:'指数を含むBURSTに×100。',effect:({cards})=>cards.some(c=>c.kind==='exp'&&!c.enemy)?{kind:'mul',value:100}:null}
};
export function evaluate({base=20,board=[],deb=[] ,owned=[],armor=1}) {
  const cards=[];
  for(let i=0;i<=board.length;i++) {
    cards.push(...deb.filter(c=>Math.min(c.at,board.length)===i));
    if(i<board.length) cards.push(board[i]);
  }
  let result=[BigInt(base),1n], sealed=false;
  const locks=new Set(deb.filter(c=>c.kind==='lock').map(c=>c.target));
  const steps=[];
  const factors=[];
  for(const c of cards) {
    let op=c;
    if(c.enemy && c.kind==='div') {
      if(owned.includes('prism')) op={...c,kind:'mul'};
      else if(owned.includes('key')) op=null;
    }
    if(c.kind==='seal') sealed=true;
    else if(sealed && !c.enemy) {
      sealed=false;
      op=null;
    }
    if(!c.enemy&&locks.has(c.kind)) op=null;
    if(op) result=apply(result,op);
    if(op && ['mul','pow','exp'].includes(op.kind)) factors.push(op);
    steps.push({card:c,op,result});
  }
  const normal=result, triggers=[];
  const activeCards=steps.map(({card,op})=>op?card:{kind:'sealed',enemy:true});
  const own=steps.filter(({card,op})=>op&&!card.enemy).map(({card})=>card);
  const count=own.length;
  for(const id of ['grimoire','tail','order','short','chain','star','sum','abacus','lattice','mosaic','ratio']) {
    if(!owned.includes(id)) continue;
    const op=relics[id].effect({cards:activeCards,count,combo:count,own});
    if(!op) continue;
    result=apply(result,op);
    factors.push(op);
    triggers.push({id,op,result});
  }
  return {normal,result,final:damage(apply(result,{kind:'div',value:armor})),steps,triggers,factors};
}
