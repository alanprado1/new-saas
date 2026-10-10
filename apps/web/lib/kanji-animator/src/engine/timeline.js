import { DEFAULT_ANIMATION } from '../styles/defaults.js';
/** Deterministic timeline. Inject a monotonic clock for tests or host scheduling. */
export class Timeline {
  constructor(strokeCount,animation={}, {now=()=>performance.now(),speed=1}={}) {
    if(!Number.isInteger(strokeCount) || strokeCount<1 || strokeCount>64) throw new TypeError('Invalid stroke count');
    this.count=strokeCount;this.animation={...DEFAULT_ANIMATION,...animation};
    for(const [key,value] of Object.entries(this.animation)) if(!Number.isFinite(value) || value<(key==='strokeDurationMs'?1:0) || value>60000) throw new TypeError(`Invalid ${key}`);
    this.now=now;this.speed=1;this.elapsed=0;this.status='idle';this.stopAt=Infinity;this.last=now();
    const a=this.animation;this.duration=a.outlineDelayMs+strokeCount*a.strokeDurationMs+(strokeCount-1)*a.strokeDelayMs;
    this.setSpeed(speed);
  }
  settle() {
    const time=this.now();
    if(this.status==='playing') {
      this.elapsed=Math.min(this.duration,this.stopAt,this.elapsed+Math.max(0,time-this.last)*this.speed);
      if(this.elapsed>=this.duration) this.status='completed';
      else if(this.elapsed>=this.stopAt) this.status='paused';
    }
    this.last=time;
  }
  play() {this.settle();if(this.status==='completed')this.elapsed=0;this.stopAt=Infinity;this.status='playing';this.last=this.now();return this.getState();}
  pause() {this.settle();if(this.status==='playing')this.status='paused';return this.getState();}
  resume() {this.settle();if(this.status!=='completed'){if(this.elapsed>=this.stopAt)this.stopAt=Infinity;this.status='playing';this.last=this.now();}return this.getState();}
  restart() {this.reset();return this.play();}
  reset() {this.elapsed=0;this.status='idle';this.stopAt=Infinity;this.last=this.now();return this.getState();}
  finish() {this.elapsed=this.duration;this.status='completed';this.stopAt=Infinity;return this.getState();}
  setSpeed(speed) {if(!Number.isFinite(speed) || speed<=0 || speed>20)throw new TypeError('Speed must be between 0 (exclusive) and 20');this.settle();this.speed=speed;return this.getState();}
  step() {
    const state=this.getState();if(state.status==='completed')return state;
    const a=this.animation,index=state.completedStrokes;
    const start=a.outlineDelayMs+index*(a.strokeDurationMs+a.strokeDelayMs);
    // Keep the first outline delay; subsequent steps skip only the inter-stroke gap.
    if(index>0 && this.elapsed<start)this.elapsed=start;
    this.stopAt=start+a.strokeDurationMs;this.status='playing';this.last=this.now();return this.getState();
  }
  getState() {
    this.settle();const a=this.animation,t=this.elapsed;
    const progress=Array.from({length:this.count},(_,i)=>Math.max(0,Math.min(1,(t-a.outlineDelayMs-i*(a.strokeDurationMs+a.strokeDelayMs))/a.strokeDurationMs)));
    const completedStrokes=progress.filter(p=>p===1).length;
    let phase='outline',currentStroke=0;
    if(t>=this.duration){phase='completed';currentStroke=this.count;}
    else if(t>=a.outlineDelayMs){currentStroke=completedStrokes+1;const start=a.outlineDelayMs+completedStrokes*(a.strokeDurationMs+a.strokeDelayMs);phase=t<start?'gap':'stroke';}
    return {status:this.status,phase,elapsedMs:t,durationMs:this.duration,speed:this.speed,strokeCount:this.count,completedStrokes,currentStroke,progress};
  }
}
