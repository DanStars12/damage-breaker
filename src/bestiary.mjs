import {drawFace} from './faces.mjs';
// Original low-resolution sprites. Forms use distinct silhouettes, weapons and anatomy.
const beastPalettes=[
  [23,38],[204,38],[7,55],[37,67],[68,55],[253,42],
  [181,51],[301,37],[42,53],[78,46],[195,66],[17,61],
  [267,52],[226,59],[24,71],[321,52],[159,47],[286,67],
  [216,76],[53,57],[162,44],[347,61],[213,42],[191,57],
  [177,63],[285,46],[25,66],[311,73],[260,33],[43,78]
];
const paintOverrides={
  'mantis:8':[348,62],
  'moth:7':[249,29],
  'dragon:12':[321,57],
  'idol:13':[158,29]
};
export function paintEnemy(canvas,{form,palette}) {
  const c=canvas.getContext('2d');
  const [h,s]=paintOverrides[form+':'+palette]??beastPalettes[palette];
  const ink='#100e1b',shade=`hsl(${h} ${s}% 19%)`,mid=`hsl(${h} ${s}% 37%)`,light=`hsl(${h} ${s}% 64%)`;
  const glow=`hsl(${(h+24)%360} 88% 79%)`;
  const box=(color,x,y,w,d)=>{c.fillStyle=color;c.fillRect(x,y,w,d);};
  const poly=(color,pts)=>{
    c.fillStyle=color;c.beginPath();
    pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
    c.closePath();c.fill();
  };
  const gem=(color,x,y,r)=>poly(color,[[x,y-r],[x+r,y],[x,y+r],[x-r,y]]);
  const mirror=points=>points.map(([x,y])=>[88-x,y]);
  const pair=(color,points)=>{poly(color,points);poly(color,mirror(points));};
  const face=(x,y,scale=1)=>drawFace(c,form,palette,x,y,scale,{ink,shade,steel:mid,light});
  const ring=(x,y,r,color)=>{
    c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.ellipse(x,y,r,r*.7,0,0,Math.PI*2);c.stroke();
  };
  const core=(x,y,r)=>{gem(ink,x,y,r+2);gem(light,x,y,r);gem(glow,x,y,r/2);};
  const wing=[[44,30],[34,14],[22,8],[5,6],[11,13],[3,20],[15,28],[10,44],[24,37],[28,48],[40,37]];
  const armor=[[44,10],[58,16],[70,27],[77,48],[67,59],[21,59],[11,48],[19,27],[30,16]];
  c.clearRect(0,0,88,64);
  box('#120e1b9c',10,57,68,3);box('#201524',18,56,52,2);
  const big=['golem','hydra','wyrm','behemoth','mantis','idol','titan','leviathan','colossus','moth','dragon','eclipse'].includes(form);
  if(big) {ring(44,28,31,shade);ring(44,28,36,shade);}
  switch(form) {
    case 'hound':
    case 'behemoth':
    case 'leviathan': {
      const huge=form!=='hound', y=huge?20:30;
      poly(ink,[[7,41],[19,y+4],[30,y],[55,y+4],[72,y+10],[83,y+5],[77,y+19],[71,55],[61,58],[55,48],[33,46],[29,58],[17,58],[21,47]]);
      poly(mid,[[12,40],[25,y+4],[39,y+2],[59,y+8],[72,y+13],[78,y+10],[70,45],[61,53],[56,43],[27,43]]);
      poly(shade,[[22,44],[39,y+13],[63,y+12],[68,46],[63,52],[59,46],[33,46],[27,56],[20,56]]);
      if(form==='leviathan') pair(light,[[39,34],[21,7],[21,23],[9,18],[15,36],[33,39]]);
      if(palette===21) {
        pair(shade,[[43,40],[35,22],[27,15],[28,24],[20,21],[27,36]]);
        for(const [x,d] of [[40,4],[49,5],[60,4],[70,3]]) gem(glow,x,y+d+5,2);
      }
      if(palette===23) {
        poly(light,[[36,36],[48,24],[52,31],[63,26],[60,38],[76,31],[72,43],[51,44]]);
        box(glow,41,36,12,2);
      }
      if(form==='hound'&&palette===9) {
        poly(light,[[21,37],[28,25],[34,30],[40,21],[43,30],[51,26],[48,38],[38,43],[29,41]]);
        poly(shade,[[27,38],[35,30],[38,36],[46,30],[43,37],[34,42]]);
        for(const [x,y] of [[7,49],[43,50],[62,53],[76,49]]) box(light,x,y,8,1);
      }
      if(form==='hound'&&palette===16) {
        poly(light,[[46,34],[52,22],[53,34],[59,25],[60,36],[67,30],[72,40],[61,36]]);
        poly(shade,[[66,44],[75,31],[83,23],[80,35],[86,33],[76,44],[69,48]]);
        box(glow,82,24,3,1);box(light,78,50,4,1);
      }
      if(huge) for(let i=0;i<5;i++) gem(light,40+i*6,y+7+i,ridge(i));
      face(form==='behemoth'?26:23,y+8,huge?1.05:.84);
      break;
    }
    case 'beetle':
    case 'mantis':
    case 'moth': {
      if(form==='moth') {
        pair(ink,wing);pair(mid,[[44,31],[32,13],[9,9],[20,25],[16,38],[30,32],[34,42]]);
        pair(light,[[37,30],[17,14],[24,25],[21,34],[31,30]]);
        for(const x of [16,28,60,72]) core(x,24,3);
      } else for(let i=0;i<4;i++) {
        const y=26+i*7;
        pair(ink,[[39,y],[24,y-6],[form==='mantis'?6:15,y+6],[20,y+8],[29,y],[37,y+4]]);
        pair(light,[[33,y],[24,y-5],[16,y+5],[25,y+2]]);
      }
      poly(shade,[[44,21],[61,33],[57,48],[44,58],[31,48],[27,33]]);
      poly(mid,[[44,25],[56,32],[55,43],[44,50],[33,43],[32,32]]);
      if(form==='mantis') pair(light,[[48,40],[74,29],[84,15],[81,31],[66,43]]);
      if(palette===20) pair(ink,[[27,43],[14,43],[9,33],[3,18],[9,24],[16,36],[23,31],[23,39]]);
      if(palette===28) for(const x of [16,72]) {ring(x,25,7,light);gem(glow,x,25,2);}
      if(form==='beetle'&&palette===8) {
        for(const [x,y,r] of [[31,40,4],[55,41,5],[42,48,6]]) {
          gem(shade,x,y,r+1);gem(light,x,y,r);box(glow,x-1,y-1,2,2);
        }
      } else if(form==='beetle'&&palette===15) {
        pair(mid,[[36,37],[29,28],[17,22],[20,35],[32,47]]);
        pair(light,[[30,35],[20,25],[22,32],[28,40]]);
        gem(glow,44,46,6);gem(ink,44,46,3);
      } else {
        core(44,45,5);
      }
      face(44,25,form==='beetle'?.83:1.03);
      break;
    }
    case 'dragon':
    case 'hydra':
    case 'wyrm': {
      if(palette===18) {
        pair(ink,[[44,36],[31,25],[21,24],[4,9],[11,30],[6,27],[16,44],[13,43],[28,51],[40,44]]);
        pair(mid,[[40,36],[31,29],[23,28],[10,17],[17,33],[12,31],[25,44],[35,44]]);
        pair(light,[[34,36],[21,31],[15,24],[20,34],[29,41]]);
        poly(ink,[[34,34],[42,26],[51,28],[58,37],[55,45],[51,48],[52,57],[43,52],[38,57],[38,49],[32,44]]);
        poly(mid,[[38,35],[43,31],[52,32],[54,40],[48,45],[41,44],[35,40]]);
        face(48,27,.93);box(light,38,48,5,1);box(light,48,49,5,1);
        break;
      }
      if(form==='wyrm'&&palette===14) {
        pair(ink,[[42,39],[26,24],[10,14],[17,31],[9,44],[24,38],[35,50]]);
        pair(mid,[[35,42],[24,27],[14,18],[20,30],[15,39],[24,35]]);
      }
      if(form==='dragon') {pair(ink,wing);pair(shade,[[44,29],[29,13],[8,8],[21,23],[17,37],[32,33],[35,42]]);
        pair(mid,[[36,31],[29,17],[16,12],[24,24],[22,34],[31,29]]);
      }
      poly(ink,[[13,53],[21,39],[33,42],[35,22],[40,12],[51,12],[57,23],[58,40],[75,44],[80,53],[64,59],[25,59]]);
      poly(mid,[[16,52],[25,43],[39,44],[41,24],[46,18],[54,23],[55,42],[71,47],[74,52],[65,56],[25,56]]);
      for(let i=0;i<4;i++) box(light,41+i,24+i*5,11,2);
      if(form==='hydra') {
        pair(ink,[[37,48],[24,43],[17,30],[24,23],[30,29],[29,37],[40,43]]);
        pair(mid,[[35,46],[26,41],[20,30],[24,27],[27,30],[27,38]]);
        face(22,29,.64);face(66,29,.64);
      }
      core(46,42,5);
      face(45,form==='hydra'?(palette===25?19:18):21,form==='dragon'?1.08:1);
      break;
    }
    case 'wisp':
    case 'specter':
    case 'eclipse': {
      const abyss=form==='eclipse',r=abyss?23:14;
      if(form==='wisp'&&palette===3) {
        pair(mid,[[41,43],[25,33],[19,16],[15,29],[24,49],[36,54]]);
        pair(light,[[24,43],[17,31],[14,34],[21,46]]);
      } else if(form==='specter'&&palette===6) {
        ring(44,22,23,light);
        for(const [x,y] of [[19,26],[69,26],[27,49],[61,49]]) gem(glow,x,y,2);
      } else {
        for(let i=0;i<3;i++) ring(44,31,r+4+i*5,i===1?mid:shade);
      }
      poly(ink,[[44,30-r],[44+r,22],[55,44],[66,58],[48,52],[43,58],[35,50],[23,56],[33,40],[44-r,23]]);
      poly(mid,[[44,32-r],[42+r,24],[53,43],[58,52],[44,47],[30,52],[36,40],[46-r,26]]);
      face(44,30,abyss?1.06:.92);
      if(abyss) for(let i=0;i<8;i++) {const ang=i*Math.PI/4;gem(light,44+Math.cos(ang)*33,30+Math.sin(ang)*23,3);}
      break;
    }
    default: {
      const giant=big?1:.84;
      c.save();c.translate(44*(1-giant),58*(1-giant));c.scale(giant,giant);
      poly(ink,armor);
      poly(shade,[[44,14],[57,18],[66,28],[72,47],[64,55],[24,55],[15,47],[22,28],[31,18]]);
      pair(mid,[[44,27],[33,22],[22,30],[18,46],[29,43],[38,34]]);
      pair(light,[[37,23],[29,22],[22,31],[32,28]]);
      if(['titan','colossus','idol'].includes(form)) {
        pair(ink,[[32,23],[21,12],[8,19],[10,44],[4,46],[6,56],[21,57],[30,41]]);
        pair(mid,[[28,24],[21,17],[12,21],[14,43],[9,48],[10,52],[19,53],[26,38]]);
        pair(light,[[20,17],[13,22],[17,34],[20,29]]);
      }
      if(palette===29) {
        pair(light,[[25,28],[15,23],[10,11],[10,22],[4,20],[9,32],[18,36]]);
        box(glow,39,43,10,2);box(glow,42,46,4,1);
      }
      if(form==='colossus') for(let i=0;i<4;i++) box(light,28+i*8,46,4,4);
      if(form==='idol') for(let i=0;i<3;i++) core(26+i*18,40,5);
      else core(44,42,big?8:5);
      face(44,23,big?1.07:.9);
      if(form==='lantern'&&palette===0) {
        box(ink,18,27,3,23);core(17,43,8);
      }
      if(form==='lantern'&&palette===11) {
        box(light,19,24,2,28);box(ink,18,17,6,8);box(glow,19,18,4,5);
        poly(shade,[[61,51],[70,43],[81,46],[76,53]]);
        poly(light,[[61,49],[70,40],[81,43],[76,50]]);
      }
      if(form==='lantern'&&palette===17) {
        for(const [x,y] of [[17,29],[72,29],[14,46],[74,45]]) {
          box(light,x,y-4,1,6);gem(ink,x,y,4);gem(glow,x,y,2);
        }
      }
      if(form==='knight'&&palette===7) {
        poly(ink,[[58,35],[73,32],[81,37],[80,49],[70,58],[60,50]]);
        poly(mid,[[60,36],[73,34],[79,38],[78,48],[70,55],[62,49]]);
        gem(light,70,44,5);box(ink,68,42,4,5);
      } else if(form==='knight') {
        poly(light,[[59,55],[70,28],[76,19],[75,32],[64,56]]);box(mid,57,49,12,3);
        if(palette===13) poly(mid,[[32,28],[18,24],[8,34],[16,32],[10,44],[25,44]]);
      }
      c.restore();
    }
  }
  for(let i=0;i<(big?13:5);i++) {
    const x=(i*23+12+palette*3)%84,y=(i*11+8)%51;
    box(i%3?light:glow,x,y,1,1);
  }
}
function ridge(i){return i===2?4:2;}
