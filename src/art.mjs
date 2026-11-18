export function paint(canvas,shape,act) {
  const ctx=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height;
  ctx.translate(w/2,h/2+5);
  const gold=['#cbb483','#83beb1','#df9c82','#d5acf0'][act-1];
  const rng=random('engraving-'+shape+'-'+act);
  const line=(points,color,width=1,fill)=>{
    ctx.beginPath();
    points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  };
  const circle=(r,color)=>{
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();
  };
  const glow=ctx.createRadialGradient(0,0,5,0,0,110);
  glow.addColorStop(0,gold+'42');glow.addColorStop(1,gold+'00');
  ctx.fillStyle=glow;ctx.fillRect(-150,-150,300,300);
  circle(76,gold+'75');circle(88,gold+'55');circle(91,gold+'55');
  for(let i=0;i<48;i++) {
    ctx.save();ctx.rotate(i*Math.PI/24);
    line([[0,-89],[0,-(i%4?84:78)]],gold+'85');
    ctx.restore();
  }
  for(let i=0;i<110;i++) {
    const x=(rng()-.5)*w,y=(rng()-.5)*h;
    ctx.fillStyle=gold+(rng()<.15?'ad':'35');
    ctx.fillRect(x,y,1+rng(),1+rng());
  }
  const profile=shape===2?
    [[0,-46],[15,-51],[36,-74],[31,-38],[57,-56],[48,-21],[36,-4],[47,13],[74,31],[58,67],[0,81]]:
    shape===1?[[0,-63],[20,-51],[35,-31],[33,3],[52,14],[76,48],[59,70],[0,77]]:
    [[0,-65],[14,-56],[37,-29],[44,7],[63,28],[74,64],[39,73],[0,77]];
  const mirror=points=>[...points,...points.slice(1,-1).reverse().map(([x,y])=>[-x,y])];
  line(mirror(profile),gold,1.6,'#161d19');
  for(const side of [-1,1]) {
    ctx.save();ctx.scale(side,1);
    line([[1,-52],[18,-39],[30,-10],[25,17],[59,39],[43,65],[14,70]],gold+'b0',1,'#323a2c');
    line([[29,5],[41,24],[60,41],[43,47],[31,65],[17,46]],gold+'a0',1,'#20251f');
    for(let i=0;i<13;i++) line([[28+i*2,30+i*1.4],[19+i*2,51+i*.75]],gold+'44');
    line([[3,-18],[23,-23],[19,-12],[5,-10]],gold,1,gold+'a8');
    ctx.restore();
  }
  line([[0,-43],[9,-22],[0,3],[-9,-22]],gold,1,'#101612');
  line(mirror([[0,16],[18,29],[14,51],[0,68]]),gold,1,'#202921');
  line([[0,24],[7,36],[0,49],[-7,36],[0,24]],gold,1,gold+'80');
}
