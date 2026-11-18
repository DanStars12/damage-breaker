export const rarity=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'];
const ranges={
  add:[[8,29],[30,99],[100,249],[250,749],[750,1600]],
  mul:[[2,4],[4,9],[10,28],[30,95],[100,175]],
  pct:[[20,50],[45,79],[75,124],[100,165],[150,240]],
  pow:[null,null,[2,2],[2,2],[3,3]],
  exp:[null,null,[2,2],[3,3],[4,5]]
};
export function random(seed) {
  let state=2166136261;
  for(const c of String(seed)) state=Math.imul(state^c.codePointAt(0),16777619);
  return ()=>{
    state=(state+0x6D2B79F5)|0;
    let t=Math.imul(state^(state>>>15),1|state);
    t^=t+Math.imul(t^(t>>>7),61|t);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
export function shuffle(items,rng) {
  const a=[...items];
  for(let i=a.length-1;i>0;i--) {
    const j=Math.floor(rng()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
export function card(kind,value,tier=0) {
  const cost=kind==='pow'?(value===3?4:3):kind==='exp'||tier>=3?2:1;
  return {kind,value,tier,cost};
}
export function generate(rng,act,boost=0) {
  const roll=rng()*100+boost+8*(act-1);
  const tier=roll>=105?4:roll>=88?3:roll>=67?2:roll>=38?1:0;
  const kinds=act>=2&&tier>=2?['add','mul','pct','pow','exp']:['add','mul','pct'];
  const kind=kinds[Math.floor(rng()*kinds.length)];
  const [lo,hi]=ranges[kind][tier];
  const anchors=[10,15,20,25,50,75,100,101,120,125,150,175,200,250,500,1000,1250]
    .filter(n=>n>=lo&&n<=hi);
  const value=rng()<0.35&&anchors.length?anchors[Math.floor(rng()*anchors.length)]:lo+Math.floor(rng()*(hi-lo+1));
  return card(kind,value,tier);
}
export function starter() {
  return [
    ...[10,12,15,20,25,30,45].map(v=>card('add',v)),
    ...[2,2,3,3].map(v=>card('mul',v)),
    ...[25,50].map(v=>card('pct',v)),
    card('clean',0),card('ward',0)
  ];
}
export function upgraded(c,mode,digit) {
  if(!['add','mul','pct'].includes(c.kind)||c.upgraded) return null;
  const adjust=c.value+Math.max(1,Math.floor(c.value/5));
  let value=mode==='power'?c.value*2:adjust;
  if(mode==='digit') {
    if(!Number.isInteger(digit)||digit<0||digit>9) return null;
    const delta=(digit-c.value%10+10)%10;
    if(delta===0) return null;
    value=c.value+delta;
  }
  return {...c,value,upgraded:true};
}
export function fused(a,b) {
  if(!a||!b||a.kind!==b.kind||!['add','mul','pct'].includes(a.kind)) return null;
  const value=a.kind==='mul'?a.value*b.value:a.value+b.value;
  if(!Number.isSafeInteger(value)||value>99999) return null;
  return {...card(a.kind,value,Math.max(a.tier,b.tier)),cost:Math.min(3,Math.max(a.cost,b.cost)+1)};
}
