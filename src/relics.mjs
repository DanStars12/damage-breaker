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
const effectCount=(own,kind)=>own.filter(c=>c.kind===kind).length;
const amplify=(condition,value)=>condition?{kind:'mul',value}:null;
Object.assign(relics,{
  chalk:{name:'黎明の白墨',desc:'基礎値に+5。',flatBase:5},
  brazier:{name:'暁火の香炉',desc:'基礎値+25%。初ターンのドロー−1。',base:25,firstDraw:-1},
  lens:{name:'遠見の単眼鏡',desc:'初ターンのドロー+1。',firstDraw:1},
  paper:{name:'折り紙の護符',desc:'初ターンだけエナジー+1。戦闘開始時にHPを4失う。',firstEnergy:1,entry:4},
  sealwax:{name:'封蝋の羽根',desc:'有効パネル4枚以上で、最後が加算なら×12。',effect:({own})=>amplify(own.length>=4&&own.at(-1)?.kind==='add',12)},
  quartette:{name:'四拍の鈴',desc:'有効パネルがちょうど4枚なら×12。',effect:({count})=>amplify(count===4,12)},
  compass:{name:'降階の針',desc:'隣り合う数字パネル3枚の値が厳密な降順なら×18。',effect:({cards})=>
    amplify(cards.some((c,i)=>i>=2&&cards.slice(i-2,i+1).every(numeric)&&cards[i-2].value>cards[i-1].value&&cards[i-1].value>c.value),18)},
  ember:{name:'灰炉の熾石',desc:'最初と最後の有効パネルが加算で、計3枚以上なら×18。',effect:({own})=>amplify(own.length>=3&&own[0].kind==='add'&&own.at(-1).kind==='add',18)},
  anvil:{name:'双刻の金床',desc:'強化済みパネルが2枚以上なら×32。',effect:({own})=>amplify(own.filter(c=>c.upgraded).length>=2,32)},
  helix:{name:'螺旋の錫杖',desc:'加算と乗算が各2枚以上なら×30。',effect:({own})=>amplify(effectCount(own,'add')>=2&&effectCount(own,'mul')>=2,30)},
  mirror:{name:'複写の鏡片',desc:'同じ演算・同じ値が隣接すると×16。',effect:({cards})=>
    amplify(cards.some((c,i)=>i>0&&numeric(c)&&numeric(cards[i-1])&&c.kind===cards[i-1].kind&&c.value===cards[i-1].value),16)},
  vigil:{name:'夜番の灯',desc:'HOLDを2回経たBURSTで、有効パネル3枚以上なら×26。',effect:({holds,count})=>amplify(holds===2&&count>=3,26)},
  pulse:{name:'真珠の振り子',desc:'割合と乗算が両方あり、有効パネル4枚以上なら×22。',effect:({own})=>
    amplify(own.length>=4&&effectCount(own,'pct')&&effectCount(own,'mul'),22)},
  comet:{name:'彗尾の箒',desc:'指数パネルが2枚以上なら×160。',effect:({own})=>amplify(effectCount(own,'exp')>=2,160)},
  crown:{name:'方陣の冠',desc:'累乗と割合が両方あるBURSTなら×65。',effect:({own})=>amplify(effectCount(own,'pow')&&effectCount(own,'pct'),65)},
  bell:{name:'破邪の鐘',desc:'敵の演算妨害が盤にあり、有効パネル3枚以上なら×28。',effect:({cards,count})=>
    amplify(count>=3&&cards.some(c=>c.enemy&&c.kind!=='sealed'),28)},
  rootGem:{name:'地脈の心核',desc:'基礎値に+15。戦闘開始時にHPを7失う。',flatBase:15,entry:7},
  lensGuard:{name:'日蝕の単眼鏡',desc:'戦闘開始時に結界。初ターンのドロー−1。',ward:true,firstDraw:-1},
  dam:{name:'山門の閂',desc:'有効な加算を4枚以上含むと×80。',effect:({own})=>amplify(effectCount(own,'add')>=4,80)},
  aurora:{name:'極光の王環',desc:'有効パネル6枚以上、演算3種類以上で×120。',effect:({own})=>
    amplify(own.length>=6&&new Set(own.map(c=>c.kind)).size>=3,120)}
});

Object.assign(relics,{
  keystone:{name:'守門の楔',desc:'戦闘開始時に防御+6。',openingGuard:6},
  lanternHeart:{name:'星灯の心臓',desc:'戦闘勝利時の回復+2。',victoryRecovery:2},
  twinScribes:{name:'複筆の羽根',desc:'有効な演算が加算1枚、乗算1枚のとき×12。',effect:({own})=>
    amplify(own.length===2&&effectCount(own,'add')===1&&effectCount(own,'mul')===1,12)},
  balanceStone:{name:'双皿の錘',desc:'最初と最後の有効パネルが割合で、計3枚以上なら×24。',effect:({own})=>
    amplify(own.length>=3&&own[0].kind==='pct'&&own.at(-1).kind==='pct',24)},
  violetSeal:{name:'紫刻の封印',desc:'累乗を1枚だけ使い、有効パネルが4枚以上なら×40。',effect:({own})=>
    amplify(own.length>=4&&effectCount(own,'pow')===1,40)},
  lodestone:{name:'磁極の星盤',desc:'有効な乗算のうち偶数の値が3枚以上なら×40。',effect:({own})=>
    amplify(own.filter(c=>c.kind==='mul'&&c.value%2===0).length>=3,40)},
  spiralKey:{name:'螺旋門の鍵',desc:'指数を含む4種類以上の有効な演算で×90。',effect:({own})=>
    amplify(effectCount(own,'exp')>0&&new Set(own.map(c=>c.kind)).size>=4,90)},
  nightCrown:{name:'夜天の三連環',desc:'有効な加算・乗算・割合が各2枚以上なら×160。',effect:({own})=>
    amplify(['add','mul','pct'].every(kind=>effectCount(own,kind)>=2),160)}
});
Object.assign(relics,{
  breach:{name:'鏡砕きの槌',desc:'有効な演算4枚以上で、敵バリアを1撃で最大2層削る。',barrierBreak:4},
  refuge:{name:'双護の留め金',desc:'戦闘開始時に結界1層と防御3。',ward:true,openingGuard:3},
  echoQuill:{name:'余白の双筆',desc:'同じ値の異なる演算が隣接すると×25。',effect:({cards})=>
    amplify(cards.some((card,i)=>i>0&&numeric(card)&&numeric(cards[i-1])&&card.kind!==cards[i-1].kind&&card.value===cards[i-1].value),25)},
  holdCrest:{name:'待刻の角笛',desc:'2回HOLDし、有効な演算が5枚以上なら×46。',effect:({holds,own})=>
    amplify(holds===2&&own.length>=5,46)},
  runeSundial:{name:'星位の日時針',desc:'最初が指数、最後が割合の有効な演算4枚以上で×54。',effect:({own})=>
    amplify(own.length>=4&&own[0].kind==='exp'&&own.at(-1).kind==='pct',54)},
  braid:{name:'三色の織鍵',desc:'加算→割合→乗算がこの順で隣接すると×35。',effect:({cards})=>
    amplify(cards.some((card,i)=>i>=2&&cards.slice(i-2,i+1).every(numeric)&&cards[i-2].kind==='add'&&cards[i-1].kind==='pct'&&card.kind==='mul'),35)}
});
export const relicRanks=[
  {name:'コモン',shop:15,drop:10},
  {name:'レア',shop:13,drop:14},
  {name:'エピック',shop:8,drop:16},
  {name:'レジェンド',shop:3,drop:10}
];
const rankedRelics=[
  ['short','key','reserve','chalk','lens','paper','sealwax','quartette','compass','mirror','ember','keystone','twinScribes','echoQuill'],
  ['tail','order','chain','furnace','rack','spring','mantle','ratio','brazier','anvil','helix','vigil','pulse','bell','lensGuard','lanternHeart','balanceStone','refuge','holdCrest','braid'],
  ['prism','codex','sum','lattice','tithe','star','mosaic','comet','crown','rootGem','dam','violetSeal','lodestone','spiralKey','breach','runeSundial'],
  ['grimoire','abacus','aurora','nightCrown']
];
for(const [rank,ids] of rankedRelics.entries()) for(const id of ids) relics[id].rank=rank;
const originalRelics=new Set(Object.keys(relics).slice(0,20));
export function drawRelic(rng,owned,act,{shop=false}={}) {
  const available=Object.keys(relics).filter(id=>!owned.includes(id));
  const eligible=available.filter(id=>(act>=2||!['comet','crown','violetSeal','spiralKey'].includes(id))&&(!shop||relics[id].rank<3||act>=3));
  const added=eligible.filter(id=>!originalRelics.has(id));
  const original=eligible.filter(id=>originalRelics.has(id));
  const pool=added.length&&rng()<.24?added:original.length?original:eligible;
  if(!pool.length) return null;
  const weighted=pool.map(id=>{
    const rank=relicRanks[relics[id].rank];
    return {id,weight:shop?rank.shop:rank.drop};
  });
  let pick=rng()*weighted.reduce((total,entry)=>total+entry.weight,0);
  return weighted.find(entry=>(pick-=entry.weight)<0).id;
}

const effectOrder=['grimoire','tail','order','short','chain','star','sum','abacus','lattice','mosaic','ratio',
  ...Object.keys(relics).slice(20).filter(id=>relics[id].effect)];

export function cleanseDebuffs(deb,boardLength,count) {
  const first=deb.map((_,index)=>index).sort((a,b)=>Math.min(deb[a].at,boardLength)-Math.min(deb[b].at,boardLength));
  const cleared=new Set(first.slice(0,count));
  return deb.filter((_,index)=>!cleared.has(index));
}
export function evaluate({base=20,board=[],deb=[] ,owned=[],armor=1,holds=0}) {
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
  for(const id of effectOrder) {
    if(!owned.includes(id)) continue;
    const op=relics[id].effect({cards:activeCards,count,combo:count,own,holds});
    if(!op) continue;
    result=apply(result,op);
    factors.push(op);
    triggers.push({id,op,result});
  }
  return {normal,result,final:damage(apply(result,{kind:'div',value:armor})),steps,triggers,factors};
}
