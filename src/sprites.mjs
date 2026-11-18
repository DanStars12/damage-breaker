// Coordinates are authored on a 48×44 pixel grid. Each silhouette has its own equipment and palette.
const creatures=[
  {palette:['#514451','#a47266','#e9a97e'],head:'hood',body:'robe',gear:'lantern'},
  {palette:['#454659','#767b92','#e1ae86'],head:'helm',body:'plate',gear:'shield'},
  {palette:['#482e54','#945e9b','#edb478'],head:'crown',body:'plate',gear:'blade'},
  {palette:['#294354','#548d9b','#aef3df'],head:'veil',body:'robe',gear:'orb'},
  {palette:['#473935','#95754c','#f0d493'],head:'helm',body:'plate',gear:'book'},
  {palette:['#3f4c40','#8d9962','#f2d38a'],head:'mitre',body:'robe',gear:'scales'},
  {palette:['#3e3865','#806daa','#c5d9ff'],head:'mask',body:'robe',gear:'star'},
  {palette:['#3d3c66','#6a7ba9','#79e4e1'],head:'dragon',body:'plate',gear:'spear'},
  {palette:['#59335c','#a85689','#ffcc78'],head:'crown',body:'king',gear:'scepter'},
  {palette:['#392f58','#8a66bd','#f5caff'],head:'echo',body:'king',gear:'rings'},
  {palette:['#394e49','#67978a','#e6d99a'],head:'hood',body:'robe',gear:'book'}
];
const heads={
  hood:[[13,23],[15,14],[20,8],[25,7],[32,13],[35,23],[30,27],[18,27]],
  helm:[[14,23],[14,13],[19,9],[28,9],[33,12],[34,22],[29,27],[18,27]],
  crown:[[12,22],[12,9],[17,13],[19,6],[24,12],[30,5],[31,13],[36,8],[34,23],[28,27],[17,26]],
  veil:[[12,24],[16,12],[21,8],[27,8],[33,12],[39,28],[30,26],[18,26]],
  mitre:[[13,24],[15,11],[24,3],[32,11],[34,24],[29,28],[19,28]],
  mask:[[14,17],[19,10],[24,8],[30,10],[34,17],[31,24],[25,28],[18,25]],
  dragon:[[12,15],[10,6],[17,11],[21,8],[28,8],[32,10],[38,4],[35,15],[36,20],[29,28],[18,26]],
  echo:[[14,18],[20,9],[24,5],[28,9],[35,18],[29,26],[24,30],[18,25]]
};
export function paintSprite(canvas,id,elite=false) {
  const {palette:[shade,mid,light],head,body,gear}=creatures[id]||creatures[0];
  const c=canvas.getContext('2d');
  const dark='#1b1723';
  const fill=(color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const poly=(color,points)=>{
    c.fillStyle=color;c.beginPath();
    points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
    c.closePath();c.fill();
  };
  const gem=(x,y,r,color)=>poly(color,[[x,y-r],[x+r,y],[x,y+r],[x-r,y]]);
  fill('#151520',8,40,32,2);fill('#211e2b',12,39,24,4);
  if(elite){gem(24,21,20,'#8a64416b');gem(24,21,18,'#28233b');}
  const wide=body==='king'?4:0;
  poly(dark,[[24,20],[34,23],[41+wide,30],[42+wide,39],[33,41],[14,41],[5-wide,39],[7-wide,29],[16,23]]);
  poly(shade,[[24,22],[33,24],[39+wide,30],[39+wide,38],[30,39],[16,39],[8-wide,37],[10-wide,30],[17,25]]);
  if(body==='robe') {
    poly(mid,[[17,25],[23,28],[19,38],[11,37]]);
    poly(mid,[[30,25],[34,28],[36,37],[27,37],[25,30]]);
    fill(shade,23,29,2,10);
  } else {
    poly(mid,[[10-wide,29],[15,24],[21,27],[15,32],[8-wide,33]]);
    poly(mid,[[28,27],[33,24],[39+wide,27],[41+wide,33],[32,32]]);
    poly(mid,[[17,30],[30,30],[28,37],[19,37]]);
  }
  gem(24,31,3,light);
  poly(dark,heads[head]);
  const inset=heads[head].map(([x,y])=>[Math.round(24+(x-24)*.81),Math.round(17+(y-17)*.81)]);
  poly(mid,inset);
  poly(shade,[[16,18],[22,15],[26,15],[32,18],[30,23],[26,26],[21,25],[17,22]]);
  fill(dark,17,18,14,4);fill(light,18,18,4,1);fill(light,26,18,4,1);
  if(head==='crown'||head==='mitre') {gem(24,12,3,light);fill(shade,24,11,1,2);}
  if(head==='helm'||head==='dragon') fill(mid,23,18,2,5);
  switch(gear) {
    case 'lantern': fill(dark,4,23,2,13);fill(light,2,26,6,7);fill(mid,3,27,4,5);fill(light,4,29,2,2);break;
    case 'shield': poly(mid,[[34,27],[45,26],[46,34],[40,41],[34,36]]);gem(40,32,4,light);break;
    case 'blade': poly(light,[[4,33],[8,17],[12,14],[10,29],[7,36]]);fill(mid,4,34,7,2);break;
    case 'orb': gem(40,12,6,mid);gem(40,12,3,light);fill(light,39,22,2,12);break;
    case 'book': poly(dark,[[2,28],[12,27],[15,36],[5,38]]);poly(light,[[3,29],[12,28],[13,35],[6,36]]);fill(mid,7,31,4,2);break;
    case 'scales': fill(light,39,16,2,22);fill(light,34,20,12,1);fill(mid,33,24,5,2);fill(mid,43,24,5,2);break;
    case 'star': gem(41,13,6,light);gem(41,13,3,mid);gem(6,15,3,light);break;
    case 'spear': fill(mid,43,16,2,23);poly(light,[[42,18],[44,7],[47,15],[45,19]]);break;
    case 'scepter': fill(light,43,13,2,25);gem(44,10,4,light);gem(44,10,2,mid);break;
    case 'rings': for(const [x,y] of [[6,14],[41,14],[7,32],[41,32]]) {gem(x,y,5,light);gem(x,y,3,shade);} break;
  }
}
