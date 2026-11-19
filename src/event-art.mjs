import {random} from './cards.mjs';

export const eventCanvasSize=[192,88];

// Each scene has a dedicated composition in the same four-color pixel-art style.
const eventScenes={
  gold:['302743','594365','9f7259','f2ce83',true,(p)=>{p.arch(92,51,59,49);p.table(82,67,58);p.scroll(93,55);p.lamp(48,58,2);p.lamp(142,62);}],
  health:['162f2e','31594b','649c72','d6fac3',true,(p)=>{p.arch(96,59,74,51);p.altar(96,66);p.star(96,39,11);p.pillar(53,63,28);p.pillar(138,63,28);}],
  card:['27203a','463b73','8c79c0','f6cfa7',true,(p)=>{p.arch(95,61,62,62);p.chest(95,62);p.gem(95,41,8);p.lamp(46,60);p.lamp(145,60);}],
  pact:['361e31','632b44','a75158','ffd18a',true,(p)=>{p.shelves(34,66,32);p.shelves(142,66,27);p.table(95,70,51);p.scroll(98,57);p.flame(72,54,10);p.flame(125,53,10);}],
  well:['142d3f','25536b','5096a1','c4f1d8',false,(p)=>{p.tree(34,70,36);p.tree(155,71,30);p.water(96,72,93);p.pillar(68,62,20);p.pillar(123,62,20);p.star(96,62,5);}],
  courier:['302b46','514971','8586a4','f9d795',false,(p)=>{p.house(42,64,36,27);p.house(152,66,29,35);p.scroll(98,60);p.bird(88,44,2);p.bird(121,33);}],
  duel:['301c39','55415e','9c698a','f8d4ad',true,(p)=>{p.arch(96,67,83,56);p.blade(76,63,1);p.blade(116,63,-1);p.star(96,42,8);}],
  caravan:['4b2c3e','8a5050','c08060','f9da97',false,(p)=>{p.moon(141,28,14);p.tent(57,67,45,26);p.tent(111,67,36,21);p.wheel(142,67,9);p.lamp(83,69);}],
  cache:['213b26','3b6548','658d72','fbd889',false,(p)=>{p.tree(39,76,48);p.tree(145,75,45);p.chest(94,69);p.thorns(74,71);p.thorns(119,72);}],
  archive:['232940','474556','81738d','edca91',true,(p)=>{p.shelves(22,69,34);p.shelves(136,71,35);p.arch(96,48,51,41);p.book(96,63,24);p.lamp(62,64);}],
  lantern:['152438','2b4161','54818e','ffe9ab',false,(p)=>{p.moon(34,22,9);p.water(100,78,190);p.tower(122,65,46);p.beam(121,25,1);p.rock(124,74,38,11);}],
  orchard:['2c254b','55446f','8a74ad','ffe3b8',false,(p)=>{p.tree(36,70,33);p.tree(151,72,36);p.tree(95,76,44);p.star(92,40,5);p.star(107,44,3);p.star(83,56,3);}],
  bell:['322943','654a5b','c08e78','fde4ac',false,(p)=>{p.tower(96,73,59);p.arch(96,48,31,26);p.bell(96,36);p.bird(57,31);p.bird(133,22);}],
  ferry:['213a47','406071','799d9b','f3d8a7',false,(p)=>{p.water(96,67,192);p.boat(92,64);p.lamp(112,59,2);p.pillar(158,69,18);p.pillar(165,69,12);}],
  ossuary:['242137','463755','7a6381','ffbfb1',true,(p)=>{p.arch(96,64,80,50);p.skull(96,56,2);p.skull(51,66);p.skull(139,66);p.flame(70,53,10);p.flame(121,53,10);}],
  bloom:['213e35','44776b','78ae9a','f4bfd0',true,(p)=>{p.arch(96,63,127,58);p.bloom(52,66,15);p.bloom(97,69,28);p.bloom(143,66,20);p.star(109,35,3);}],
  sundial:['433944','805c65','b38a7c','ffc777',false,(p)=>{p.moon(57,24,18);p.altar(107,71);p.dial(107,58);p.pillar(148,73,24);}],
  forge:['362330','622f41','b7574c','ffd185',true,(p)=>{p.arch(97,65,87,53);p.altar(96,71);p.flame(96,59,31);p.blade(139,70,-1);p.rock(54,74,26,9);}],
  observatory:['1c2642','384c77','727db0','c7f6ff',false,(p)=>{p.moon(48,24,15);p.dome(117,70);p.beam(112,34,-1);p.star(49,22,5);}],
  mine:['1d293f','384564','597c91','e1ffb6',true,(p)=>{p.arch(97,72,66,55);p.gem(32,65,13);p.gem(144,54,11);p.gem(166,65,9);p.cart(93,66);}],
  bridge:['23334c','465986','8288ad','f9edbc',false,(p)=>{p.water(97,76,190);p.bridge(96,63);p.bird(73,27,2);p.bird(120,36);p.gem(96,48,5);}],
  gate:['20343d','386474','6c9a9d','eed197',true,(p)=>{p.arch(96,61,88,52);p.portcullis(96,61);p.water(96,76,192);p.chest(132,70);}],
  kiln:['243b38','416c58','83aa7d','ffd392',true,(p)=>{p.arch(54,65,48,46);p.flame(55,65,13);p.shelves(122,67,45);p.vase(134,54,7);p.vase(155,54,5);}],
  loom:['282748','4c4b77','8587aa','fce2b2',true,(p)=>{p.arch(141,59,38,50);p.moon(141,28,8);p.loom(76,69);p.star(76,43,6);}],
  shrine:['263750','526782','939eae','ffe8ca',false,(p)=>{p.tree(160,73,39);p.torii(92,66);p.altar(94,72);p.bird(57,28,2);p.bird(137,35);}],
  mosaic:['393049','714767','bb7d84','fff0a1',true,(p)=>{p.arch(96,64,110,56);p.mosaic(96,38);p.pillar(57,72,35);p.pillar(135,72,35);}],
  coast:['1a384c','366c88','70a5ae','f5ebce',false,(p)=>{p.water(96,73,192);p.ribs(98,67);p.gem(124,67,6);p.rock(29,76,34,10);}],
  sand:['4a3041','985e54','d49c74','ffe69f',false,(p)=>{p.moon(42,27,15);p.tent(117,71,68,36);p.tent(58,73,36,22);p.vase(151,73,8);p.lamp(84,69);}],
  clock:['29263b','504557','8f767c','fbd39d',true,(p)=>{p.wheel(96,44,22);p.wheel(58,60,12);p.wheel(133,58,14);p.star(96,44,6);}],
  banquet:['352134','663b50','a77273','ffcb81',true,(p)=>{p.arch(96,59,114,55);p.table(95,72,102);p.vase(96,62,8);p.flame(57,59,13);p.flame(133,59,13);}],
  oracle:['211f3c','4b3c6e','8773b3','f9deae',true,p=>{p.arch(98,56,102,57);p.moon(127,28,10);p.table(86,70,55);p.book(86,59,27);p.star(86,33,11);p.lamp(59,64);}],
  cistern:['153342','2b5862','65949b','d3f1bd',true,p=>{p.arch(96,57,90,57);p.pillar(42,69,47);p.pillar(152,69,47);p.water(96,76,190);p.gem(87,58,6);p.gem(112,66,4);}],
  rookery:['372b41','66506c','9c7978','ffd58a',false,p=>{p.tower(98,74,60);p.tower(137,73,38);p.moon(42,22,13);p.bird(80,33,3);p.bird(125,29,2);p.scroll(96,65);}],
  hearth:['212c44','4d6481','9caabe','ffc67d',false,p=>{p.moon(155,20,10);p.tree(35,70,43);p.tree(159,78,41);p.rock(96,73,52,12);p.flame(96,63,17);}]
};

const facilityScenes={
  rest:['192f38','3b5958','779680','f5c87e',false,p=>{p.moon(139,20,13);p.tree(25,74,56);p.tree(169,76,51);p.tent(73,71,62,34);p.rock(124,74,40,11);p.flame(124,63,15);p.lamp(93,69);}],
  shop:['362437','6b4650','b87a60','ffe098',true,p=>{p.arch(97,59,125,54);p.shelves(28,65,38);p.shelves(134,65,35);p.table(100,71,77);p.chest(106,60);p.vase(136,60,6);p.lamp(58,60,2);p.lamp(157,56);}]
};
export const facilityArtIds=Object.keys(facilityScenes);
export const eventArtIds=Object.keys(eventScenes);

export function paintEvent(canvas,id) {
  const scene=eventScenes[id]??facilityScenes[id];
  if(!scene) return false;
  const [night,mid,light,glow,interior,compose]=scene;
  const ctx=canvas.getContext('2d');
  const [width,height]=eventCanvasSize;
  const rng=random('event-art/'+id);
  const ink='#141723';
  const rect=(x,y,w,h,color)=>{
    ctx.fillStyle=color.startsWith('#')?color:'#'+color;
    ctx.fillRect(Math.round(x),Math.round(y),w,h);
  };
  const polygon=(points,color)=>{
    // Scan-convert at the canvas pixel grid for hard, unfiltered edges.
    const ys=points.map(([,y])=>y);
    for(let y=Math.floor(Math.min(...ys));y<Math.ceil(Math.max(...ys));y++) {
      const xs=[];
      const scan=y+.5;
      for(let i=0;i<points.length;i++) {
        const [x0,y0]=points[i], [x1,y1]=points[(i+1)%points.length];
        if((y0<=scan&&scan<y1)||(y1<=scan&&scan<y0)) xs.push(x0+(x1-x0)*(scan-y0)/(y1-y0));
      }
      xs.sort((a,b)=>a-b);
      for(let i=0;i+1<xs.length;i+=2) rect(Math.ceil(xs[i]),y,Math.max(0,Math.ceil(xs[i+1])-Math.ceil(xs[i])),1,color);
    }
  };
  const disc=(x,y,r,color)=>{
    for(let dy=-r;dy<=r;dy++) {
      const dx=Math.floor(Math.sqrt(r*r-dy*dy));
      rect(x-dx,y+dy,2*dx+1,1,color);
    }
  };
  const diamond=(x,y,r,color)=>polygon([[x,y-r],[x+r,y],[x,y+r],[x-r,y]],color);
  const line=(x,y,xx,yy,color,weight=1)=>{
    const n=Math.max(1,Math.abs(xx-x),Math.abs(yy-y));
    for(let i=0;i<=n;i++) rect(x+(xx-x)*i/n,y+(yy-y)*i/n,weight,weight,color);
  };

  const arch=(x,y,w,h)=>{
    const l=x-w/2,r=x+w/2,t=y-h;
    const outline=[[l,y],[l,t+13],[l+7,t+5],[x-9,t],[x+9,t],[r-7,t+5],[r,t+13],[r,y]];
    polygon(outline,light);
    polygon([[l+3,y],[l+3,t+14],[l+10,t+6],[x-8,t+3],[x+8,t+3],[r-10,t+6],[r-3,t+14],[r-3,y]],night);
    for(let n=t+18;n<y;n+=7) {rect(l,n,3,1,ink);rect(r-3,n,3,1,ink);}
  };
  const star=(x,y,r)=>{diamond(x,y,r,light);line(x-r,y,x+r,y,glow);line(x,y-r,x,y+r,glow);rect(x-1,y-1,3,3,glow);};
  const flame=(x,y,h)=>{
    polygon([[x-5,y],[x-8,y-5],[x-1,y-h],[x+1,y-h*.57],[x+5,y-h*.75],[x+8,y-4],[x+5,y]],light);
    polygon([[x-3,y],[x-3,y-4],[x+1,y-h*.55],[x+4,y-3],[x+2,y]],glow);
  };
  const pillar=(x,y,h)=>{rect(x-5,y-h,10,h,mid);rect(x-5,y-h,2,h,light);rect(x-8,y-h,16,3,light);rect(x-9,y-3,18,3,ink);};
  const wheel=(x,y,r)=>{
    disc(x,y,r,light);disc(x,y,r-3,night);
    for(let i=0;i<8;i++) {
      const angle=i*Math.PI/4,dx=Math.round(Math.cos(angle)*(r-1)),dy=Math.round(Math.sin(angle)*(r-1));
      line(x,y,x+dx,y+dy,light,2);
      rect(x+dx-1,y+dy-1,3,3,glow);
    }
    disc(x,y,3,glow);
  };
  const tree=(x,y,h)=>{
    line(x,y,x-2,y-h+11,ink,4);
    line(x,y-7,x+10,y-h/2,light,1);
    for(const [dx,dy,r] of [[-10,16,10],[0,9,12],[13,16,9],[-4,23,13]]) {
      const v=y-h+dy;
      disc(x+dx,v,r,mid);
      disc(x+dx-1,v-4,r-4,light);
    }
  };
  rect(0,0,width,height,night);
  for(let y=4;y<57;y+=5) rect(0,y,width,1,mid);
  for(let i=0;i<58;i++) {
    const x=rng()*width,y=rng()*64;
    rect(x,y,rng()>.8?2:1,1,i%9===0?glow:light);
  }
  if(interior) {
    arch(23,67,33,57);
    arch(168,67,33,57);
    rect(0,68,width,20,mid);
    for(let y=71;y<88;y+=5) line(0,y,width,y,night);
    for(let i=-4;i<=4;i++) line(96+i*12,69,96+i*35,88,night);
  } else {
    const hills=[[-2,63]];
    for(let x=0;x<width+32;x+=16) hills.push([x,33+Math.floor(rng()*27)]);
    hills.push([width,80],[0,80]);
    polygon(hills,mid);
    polygon([[0,66],[21,59],[66,64],[108,55],[149,61],[192,56],[192,88],[0,88]],ink);
    for(let i=0;i<24;i++) rect(rng()*width,70+rng()*17,2+Math.floor(rng()*9),1,mid);
  }
  const art={
    arch,star,flame,pillar,wheel,tree,
    table:(x,y,w)=>{rect(x-w/2,y-6,w,5,light);rect(x-w/2+4,y-1,4,10,ink);rect(x+w/2-8,y-1,4,10,ink);},
    scroll:(x,y)=>{polygon([[x-16,y+5],[x-13,y-8],[x+14,y-10],[x+17,y+3]],glow);line(x-10,y-3,x+9,y-5,mid);line(x-10,y,x+7,y-2,mid);diamond(x+10,y+1,3,light);},
    lamp:(x,y,s=1)=>{rect(x-3*s,y-10*s,6*s,10*s,ink);rect(x-2*s,y-8*s,4*s,6*s,glow);rect(x-4*s,y-11*s,8*s,2*s,light);},
    altar:(x,y)=>{rect(x-21,y-5,42,5,light);rect(x-14,y,28,5,mid);rect(x-25,y+5,50,3,light);},
    chest:(x,y)=>{rect(x-15,y-12,30,15,mid);rect(x-12,y-15,24,4,light);rect(x-15,y-8,30,2,glow);rect(x-2,y-9,4,5,glow);},
    gem:(x,y,r)=>{diamond(x,y,r,light);polygon([[x,y-r],[x+r,y],[x,y+2],[x-r,y]],glow);line(x,y-r+2,x,y+r-2,mid);},
    shelves:(x,y,w)=>{rect(x,y-40,w,40,ink);for(let dy=-33;dy<=0;dy+=11){rect(x,y+dy,w,2,light);for(let dx=3;dx<w-2;dx+=5)rect(x+dx,y+dy-6,3,6,(dx+dy)%3?mid:glow);}},
    water:(x,y,w)=>{rect(x-w/2,y-10,w,20,mid);for(let i=0;i<25;i++)rect(x-w/2+rng()*(w-13),y-9+rng()*19,3+Math.floor(rng()*11),1,i%6?light:glow);},
    house:(x,y,w,h)=>{rect(x-w/2,y-h,w,h,mid);polygon([[x-w/2-4,y-h],[x,y-h-14],[x+w/2+4,y-h]],light);rect(x-4,y-14,8,9,glow);},
    bird:(x,y,s=1)=>{line(x-6*s,y-3*s,x,y,glow,s);line(x,y,x+5*s,y-4*s,glow,s);},
    blade:(x,y,d)=>{line(x,y,x+28*d,y-32,glow,3);line(x-5*d,y-12,x+14*d,y+2,light,3);},
    moon:(x,y,r)=>{disc(x,y,r,glow);disc(x+4,y-3,Math.max(1,r-4),light);},
    tent:(x,y,w,h)=>{polygon([[x-w/2,y],[x,y-h],[x+w/2,y]],light);polygon([[x-5,y],[x+1,y-h+4],[x+13,y]],mid);line(x-w/2,y,x+w/2,y,glow);},
    thorns:(x,y)=>{for(let i=0;i<6;i++)line(x+i*3,y,x+i*2-5,y-12+(i%3)*3,light,2);},
    book:(x,y,w)=>{polygon([[x-w,y-6],[x-4,y-11],[x,y-6],[x+4,y-11],[x+w,y-6],[x+w,y+5],[x,y+7],[x-w,y+5]],glow);line(x,y-6,x,y+6,mid);},
    tower:(x,y,h)=>{polygon([[x-13,y],[x-8,y-h],[x+8,y-h],[x+13,y]],light);rect(x-4,y-h-2,8,8,glow);rect(x-10,y-h-5,20,3,mid);line(x-10,y-16,x+10,y-16,mid,3);},
    beam:(x,y,d)=>{polygon([[x,y],[x+67*d,y-10],[x+67*d,y+10]],light);polygon([[x,y],[x+62*d,y-3],[x+62*d,y+2]],glow);},
    rock:(x,y,w,h)=>polygon([[x-w/2,y],[x-w/3,y-h],[x+w/3,y-h],[x+w/2,y]],night),
    bell:(x,y)=>{disc(x,y,8,light);rect(x-10,y+3,20,3,glow);rect(x-1,y+6,3,4,glow);},
    boat:(x,y)=>{polygon([[x-31,y-6],[x+31,y-6],[x+20,y+5],[x-21,y+5]],ink);line(x-28,y-6,x+27,y-6,glow);line(x+10,y-7,x+33,y-22,light,2);},
    skull:(x,y,s=1)=>{disc(x,y-3*s,6*s,light);rect(x-4*s,y,8*s,4*s,glow);rect(x-4*s,y-4*s,3*s,2*s,ink);rect(x+s,y-4*s,3*s,2*s,ink);},
    bloom:(x,y,h)=>{line(x,y,x,y-h,light,2);disc(x-5,y-h,4,light);disc(x+5,y-h,4,light);disc(x,y-h-5,4,glow);disc(x,y-h,3,mid);},
    dial:(x,y)=>{polygon([[x-18,y],[x+16,y],[x,y-17]],light);line(x-18,y,x+15,y,glow,3);line(x,y-16,x-1,y-2,ink);},
    dome:(x,y)=>{disc(x,y-8,26,light);rect(x-29,y-7,58,12,mid);line(x-19,y-25,x+15,y-25,glow,3);rect(x+8,y-9,9,11,ink);},
    cart:(x,y)=>{rect(x-15,y-10,30,11,light);wheel(x-9,y+1,5);wheel(x+9,y+1,5);},
    bridge:(x,y)=>{rect(x-64,y-10,128,11,light);for(const dx of [-41,0,41])arch(x+dx,y+15,36,15);line(x-64,y-10,x+64,y-10,glow,2);},
    portcullis:(x,y)=>{for(let dx=-30;dx<=30;dx+=10) line(x+dx,y-33,x+dx,y,light,2);rect(x-30,y-16,61,3,light);},
    vase:(x,y,r)=>{disc(x,y-4,r,light);rect(x-3,y-r-8,6,5,glow);rect(x-r+1,y+1,r*2-2,2,mid);},
    loom:(x,y)=>{rect(x-24,y-41,4,42,light);rect(x+21,y-41,4,42,light);rect(x-25,y-42,51,4,glow);for(let k=-19;k<20;k+=5)line(x+k,y-37,x+k,y-9,light);rect(x-21,y-20,42,8,mid);},
    torii:(x,y)=>{rect(x-18,y-33,4,34,light);rect(x+13,y-33,4,34,light);rect(x-26,y-31,52,4,glow);rect(x-30,y-39,60,4,light);},
    mosaic:(x,y)=>{diamond(x,y,24,mid);for(let dx=-15;dx<=15;dx+=6)for(let dy=-15;dy<=15;dy+=6)if(Math.abs(dx)+Math.abs(dy)<24)diamond(x+dx,y+dy,4,(dx+dy)%12?glow:light);},
    ribs:(x,y)=>{for(let dx=-32;dx<=32;dx+=8){const h=29-Math.floor(Math.abs(dx)/4);line(x+dx,y,x+dx-5,y-h,light,3);line(x+dx-5,y-h,x+dx+1,y-h-5,glow,2);}}
  };
  compose(art);
  return true;
}
