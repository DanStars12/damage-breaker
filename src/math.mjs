import {operationNames} from './enemies.mjs';
export const CAP = 9999n * 10n ** 68n;
const abs = n => n < 0n ? -n : n;
function gcd(a,b) {
  while (b) [a,b] = [b,a%b];
  return abs(a);
}
function rational(n,d=1n) {
  const g = gcd(n,d);
  return [n/g,d/g];
}
export function apply([n,d], {kind,value}) {
  const v = BigInt(value);
  switch(kind) {
    case 'add': return rational(n+v*d,d);
    case 'sub': return rational(n-v*d,d);
    case 'mul': return rational(n*v,d);
    case 'div': return rational(n,d*v);
    case 'pct': return rational(n*(100n+v),d*100n);
    case 'pow': return [n**v,d**v];
    case 'exp': return rational(n*10n**v,d);
    default: return [n,d];
  }
}
export function damage([n,d]) {
  return n > 0n ? n/d : 0n;
}
const units = ['', '万','億','兆','京','垓','秭','穣','溝','澗','正','載','極','恒河沙','阿僧祇','那由他','不可思議','無量大数'];
export function format(n, scientific=false, cap=true) {
  if (cap && n>CAP) return '∞';
  const s = n.toString();
  if (n<0n) return '−'+format(-n,scientific,false);
  if (s.length<=4) return s;
  if (scientific || s.length>72) return s[0]+'.'+s.slice(1,5)+'e+'+(s.length-1);
  const groups=[];
  for(let end=s.length,i=0;end>0;end-=4,i++) {
    const part=Number(s.slice(Math.max(0,end-4),end));
    if(part) groups.unshift(part+units[i]);
  }
  return groups.join('');
}
export function label({kind,value,target}) {
  switch(kind) {
    case 'add': return '+'+value;
    case 'sub': return '−'+value;
    case 'mul': return '×'+value;
    case 'div': return '÷'+value;
    case 'pct': return (value>0?'+':'−')+Math.abs(value)+'%';
    case 'pow': return 'x'+superscript(value);
    case 'exp': return '×10'+superscript(value);
    case 'lock': return operationNames[target]+'封印';
    default: return {clean:'浄化',ward:'結界',seal:'封印'}[kind];
  }
}
function superscript(value) {
  return String(value).replace(/\d/g,d=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
}
