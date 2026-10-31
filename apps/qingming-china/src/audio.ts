/** Original procedural ambience: no remote audio or autoplay. */
export class RiverAudio {
  private context?: AudioContext;
  private ambient?: GainNode;
  private source?: AudioBufferSourceNode;
  private effects = 0.4;
  async configure(on: boolean, ambience: number, effects: number) {
    this.effects = effects;
    if (!on) { await this.context?.suspend(); return; }
    if (!this.context) {
      this.context = new AudioContext();
      const length=this.context.sampleRate*4;
      const buffer=this.context.createBuffer(1,length,this.context.sampleRate);
      const channel=buffer.getChannelData(0);
      let last=0;
      for(let i=0;i<length;i++){last=(last+Math.random()*.04-.02)/1.02;channel[i]=last;}
      this.source=this.context.createBufferSource();this.source.buffer=buffer;this.source.loop=true;
      const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;
      this.ambient=this.context.createGain();this.source.connect(filter).connect(this.ambient).connect(this.context.destination);this.source.start();
    }
    this.ambient!.gain.value=ambience*.45;
    await this.context.resume();
  }
  ring() {
    const c=this.context;if(!c||c.state!=='running')return;
    [784,1176,1568].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(this.effects*.08/(i+1),c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+1.4);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+1.5);});
  }
  pause(){void this.context?.suspend();}
  dispose(){void this.context?.close();}
}
