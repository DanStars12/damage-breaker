// Each voice is frequency, end frequency, start offset, duration, amplitude and waveform.
const cues={
  place:[[440,320,0,.085,.10,'triangle']],
  multiply:[[350,520,0,.10,.09,'triangle'],[690,690,.045,.10,.055,'sine']],
  mystic:[[520,800,0,.14,.10,'sine'],[1040,780,.045,.15,.055,'triangle']],
  move:[[360,480,0,.07,.07,'triangle']],
  undo:[[470,640,0,.11,.085,'sine'],[700,820,.055,.08,.05,'sine']],
  draw:[[390,490,0,.07,.055,'triangle'],[490,610,.050,.07,.05,'triangle'],[610,760,.098,.075,.05,'sine']],
  ward:[[510,510,0,.24,.11,'sine'],[765,770,.035,.22,.07,'sine']],
  clean:[[690,680,0,.12,.09,'sine'],[900,1000,.05,.16,.065,'sine']],
  relic:[[392,392,0,.22,.09,'triangle'],[587,587,.045,.22,.075,'sine'],[784,790,.09,.26,.075,'sine']],
  melee:[[160,55,0,.17,.17,'triangle'],[380,85,.025,.08,.065,'sawtooth']],
  double:[[160,55,0,.15,.15,'triangle'],[190,53,.22,.17,.165,'triangle']],
  hex:[[410,145,0,.27,.10,'triangle'],[405,166,.04,.29,.045,'sawtooth']],
  seal:[[180,205,0,.18,.09,'triangle'],[105,80,.11,.13,.15,'triangle']],
  drain:[[270,72,0,.34,.15,'triangle'],[311,79,.035,.28,.05,'sine']],
  triple:[[185,72,0,.115,.13,'triangle'],[218,61,.14,.13,.145,'triangle'],[245,52,.28,.17,.16,'triangle']],
  boss:[[73,58,0,.48,.15,'triangle'],[110,92,.10,.38,.13,'triangle'],[155,147,.22,.45,.095,'sine']],
  wave:[[360,92,0,.36,.125,'triangle'],[120,56,.12,.28,.13,'sine']],
  meteor:[[400,210,0,.13,.09,'triangle'],[139,48,.14,.30,.20,'triangle']],
  flare:[[165,90,0,.26,.13,'sawtooth'],[480,65,.09,.28,.09,'triangle']],
  eclipse:[[640,124,0,.17,.11,'sawtooth'],[220,54,.07,.28,.16,'triangle']],
  ascend:[[392,587,0,.19,.10,'sine'],[587,784,.10,.24,.08,'triangle'],[880,880,.22,.34,.08,'sine']],
  launch:[[160,640,0,.14,.07,'triangle']],
  hit:[[182,65,0,.17,.16,'triangle'],[495,330,.045,.11,.075,'sine']],
  barrier:[[590,735,0,.20,.13,'triangle'],[813,650,.050,.24,.07,'sine']],
  gate:[[250,60,0,.26,.17,'triangle'],[489,650,.055,.19,.08,'sine'],[733,920,.089,.23,.07,'triangle']],
  miss:[[230,190,0,.13,.045,'sine']],
  record:[[392,392,.09,.22,.08,'triangle'],[523,523,.155,.22,.08,'sine'],[784,784,.22,.28,.07,'triangle']],
  victory:[[330,330,.11,.18,.08,'triangle'],[440,440,.18,.18,.075,'sine'],[659,659,.26,.29,.085,'triangle']],
  infinity:[[147,60,0,.49,.135,'triangle'],[294,390,.06,.28,.10,'triangle'],[440,490,.11,.29,.085,'sine'],[587,680,.15,.33,.10,'sine'],[880,965,.22,.39,.08,'triangle']],
  gold:[[920,800,0,.13,.095,'sine'],[1280,1150,.065,.16,.085,'triangle']],
  forge:[[185,98,0,.18,.16,'triangle'],[1120,810,.013,.21,.06,'triangle']],
  remove:[[580,180,0,.24,.095,'triangle'],[390,60,.075,.23,.065,'sine']],
  fuse:[[280,370,0,.18,.08,'sine'],[370,520,.045,.21,.075,'triangle'],[520,780,.10,.24,.07,'sine']],
  page:[[180,250,0,.09,.042,'triangle'],[280,160,.03,.12,.05,'triangle']]
};
export function createSound(Context, settings) {
  let ctx, master;
  function unlock() {
    if(!Context||settings().mute) return;
    try {
      if(!ctx) {
        ctx=new Context();
        master=ctx.createGain();
        master.connect(ctx.destination);
      }
      if(ctx.state==='suspended') void ctx.resume().catch(()=>{});
    } catch {}
  }
  function refresh() {
    if(!master) return;
    const {mute,volume}=settings();
    master.gain.value=mute?0:(typeof volume==='number'?Math.min(1,Math.max(0,volume/100)):.55);
  }
  function play(id,{level=0,signal,fast=false}={}) {
    if(!master||settings().mute||signal?.aborted) return;
    refresh();
    const stretch=fast ? .64 : 1;
    const pitch=2**(Math.min(7,Math.max(0,level))/10);
    for(const [from,to,offset,length,strength,shape] of cues[id]??[]) {
      const voice=ctx.createOscillator(), body=ctx.createGain();
      const at=ctx.currentTime+offset*stretch, duration=length*stretch;
      voice.type=shape;
      voice.frequency.setValueAtTime(from*pitch,at);
      voice.frequency.exponentialRampToValueAtTime(to*pitch,at+duration);
      body.gain.setValueAtTime(.0001,at);
      body.gain.exponentialRampToValueAtTime(strength,at+.008);
      body.gain.exponentialRampToValueAtTime(.0001,at+duration);
      voice.connect(body);
      body.connect(master);
      const cancel=()=>voice.stop();
      signal?.addEventListener('abort',cancel,{once:true});
      voice.onended=()=>{
        signal?.removeEventListener('abort',cancel);
        voice.disconnect();
        body.disconnect();
      };
      voice.start(at);
      voice.stop(at+duration+.01);
    }
  }
  return {unlock,play,refresh};
}
