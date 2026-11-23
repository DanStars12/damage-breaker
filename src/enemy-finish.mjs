// Final authored 1px accents on the existing 88×64 sprite canvas.
// The original form silhouette and 52 unique faces are left unchanged.
export function paintEnemyFinish(ctx,{form,palette},{ink,shade,mid,light,glow}) {
  const px=(color,x,y,w=1,h=1)=>{
    ctx.fillStyle=color;
    ctx.fillRect(x,y,w,h);
  };
  const seam=(x,y,flip=false)=>{
    const dir=flip?-1:1;
    px(ink,x,y,5,1);
    px(light,x+dir,y-1,3,1);
    px(shade,x+dir,y+1,4,1);
    px(glow,x+2,y-2);
  };
  const rivet=(x,y)=>{
    px(ink,x-1,y-1,3,3);
    px(mid,x,y,2,2);
    px(glow,x,y);
  };
  const scale=(x,y)=>{
    px(shade,x,y,5,2);
    px(light,x+1,y,3,1);
    px(glow,x+1,y-1);
  };
  const shadow=shade,shimmer=glow;
  const metal=['golem','titan','colossus','idol','knight','lantern'];
  const draconic=['dragon','hydra','wyrm'];
  const beasts=['hound','boar','behemoth','leviathan'];
  const insects=['beetle','mantis','moth'];
  if(metal.includes(form)) {
    // Riveted shoulder plates, beveled edges and etched armor seams.
    seam(17,37);seam(63,37,true);
    for(const [x,y] of [[25,45],[63,45]]) rivet(x,y);
    px(mid,33,50,8,1);px(shimmer,34,49,5,1);
    px(ink,49,50,5,1);px(light,50,49,3,1);
    if(form==='golem'||form==='titan'||form==='colossus'||form==='idol') {
      for(let k=0;k<3;k++) {
        const x=29+7*k;
        px(shadow,x,53,4,2);px(light,x+1,53,2,1);
      }
      // Faceted rock at the lower left and right, below the face.
      px(ink,18,47,2,5);px(shimmer,19,46,3,1);
      px(ink,67,47,2,5);px(shimmer,65,46,3,1);
    }
    if(form==='lantern') {
      px(shimmer,12,44,2,2);px(light,10,46,6,1);
      px(shadow,72,48,4,2);px(shimmer,75,47,1,1);
    }
  } else if(draconic.includes(form)) {
    // Alternating scale highlights make the three dragon families read distinctly.
    for(let i=0;i<5;i++) scale(31+i*7,35+(i%2)*5);
    for(const [x,y] of [[20,38],[68,40]]) {
      px(shadow,x,y,7,2);px(light,x+1,y,4,1);px(shimmer,x+4,y-2,1,2);
    }
    if(form==='hydra') {
      px(light,19,42,5,1);px(shimmer,21,40,2,1);
      px(light,64,42,5,1);px(shimmer,65,40,2,1);
    } else if(form==='dragon') {
      for(const x of [15,23,65,73]) {px(light,x,25,3,1);px(shimmer,x+1,23);}
    } else {
      px(light,39,54,11,1);px(shimmer,46,52,2,1);
    }
  } else if(beasts.includes(form)) {
    // Layered fur or scales, visible claws and a sculpted back.
    for(let i=0;i<5;i++) {
      const x=30+i*8,y=34+(i%3)*2;
      px(shadow,x,y,6,2);px(light,x+1,y,3,1);
      px(shimmer,x+2,y-1);
    }
    for(const x of [21,28,59,68]) {
      px(ink,x,54,5,2);px(light,x+1,54,2,1);
      px(shimmer,x+2,53);
    }
    if(form==='leviathan') {
      for(const [x,y] of [[11,31],[17,23],[72,24],[77,30]]) {
        px(shimmer,x,y,2,1);px(light,x+1,y+1,2,1);
      }
    }
    if(form==='boar') {px(light,14,40,4,1);px(shimmer,15,39,1,1);}
  } else if(insects.includes(form)) {
    // Symmetric veining, carapace facets, and small segmented joints.
    for(const [x,y] of [[22,24],[64,24],[29,37],[57,37]]) {
      px(ink,x,y,4,2);px(light,x+1,y,3,1);px(shimmer,x+1,y-2);
    }
    for(let i=0;i<4;i++) {
      const y=33+i*5;
      px(shadow,40,y,8,1);px(light,42,y-1,4,1);
    }
    if(form==='moth') {
      for(const x of [13,24,62,74]) {px(shimmer,x,17,2,2);px(light,x+1,20,2,1);}
    }
    if(form==='mantis') {
      px(light,75,22,7,1);px(shimmer,80,20,1,2);
      px(light,7,29,5,1);px(shimmer,9,27,1,2);
    }
  } else if(['wisp','specter','eclipse'].includes(form)) {
    // Floating void fragments and very small runic accents.
    for(const [x,y] of [[26,42],[60,42],[33,49],[54,48]]) {
      px(ink,x,y,4,2);px(light,x+1,y,2,1);px(shimmer,x+1,y-2,1,1);
    }
    px(light,39,52,7,1);px(shimmer,42,50,2,1);
    if(form==='eclipse') {
      for(const x of [13,73]) {px(shimmer,x,31,2,1);px(light,x+1,33,2,1);}
    }
  } else if(form==='mushroom') {
    for(const [x,y] of [[29,28],[39,21],[52,30],[61,35]]) {
      px(shadow,x,y,5,2);px(light,x+1,y,3,1);px(shimmer,x+2,y-1);
    }
    px(shadow,36,52,13,1);px(light,39,51,7,1);
  } else if(form==='jelly') {
    for(const [x,y] of [[27,26],[36,20],[52,22],[60,30]]) {
      px(light,x,y,4,1);px(shimmer,x+1,y-1,2,1);
    }
    for(const x of [26,37,49,61]) {px(shimmer,x,48,2,2);}
  } else if(form==='mimic') {
    for(const x of [22,33,55,67]) rivet(x,38);
    px(ink,40,48,9,5);px(mid,42,48,5,3);px(shimmer,44,49,1,2);
    px(light,24,51,14,1);px(light,54,51,12,1);
  } else if(form==='harpy') {
    for(let i=0;i<4;i++) {
      const y=25+i*6;
      for(const x of [15,65]) {px(light,x,y,7,1);px(shimmer,x+2,y-1);}
    }
    px(light,40,52,8,1);
  } else if(form==='reaper') {
    for(let i=0;i<4;i++) {
      px(shadow,31+i*6,43+i*2,3,3);
      px(light,32+i*6,43+i*2,2,1);
    }
    px(shimmer,70,12,5,1);px(light,75,13,3,1);
  }
  // One-pixel glints are palette-dependent but deterministic; no runtime RNG or animation.
  const offset=palette%5;
  px(shimmer,7+offset*3,11+palette%3,2,1);
  px(mid,76-offset*2,51-palette%4,2,1);
}
