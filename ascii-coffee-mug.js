(function(){
'use strict';
const W=58,H=31,STEP=4,GLYPHS=' .,:;+=*#~',TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const normalize=(x,y,z)=>{let l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l]};
const LIGHT=normalize(-0.55,0.8,0.95);
const POINTS=[];
function add(x,y,z,nx,ny,nz,material){POINTS.push({x,y,z,nx,ny,nz,material})}
// Tapered ceramic cup: 40 radial divisions, 22 vertical levels.
for(let i=0;i<=22;i++){const u=i/22,y=-0.70+1.36*u,r=0.59+0.19*u;
  for(let j=0;j<64;j++){const a=TAU*j/64,c=Math.cos(a),s=Math.sin(a);
    const n=normalize(c,-0.19/1.36,s);
    add(r*c,y,r*s,...n,'body')
  }
}
// Thin rim torus, centered at the open lip.
for(let j=0;j<104;j++){const a=TAU*j/104,c=Math.cos(a),s=Math.sin(a);
  for(let k=0;k<9;k++){const b=TAU*k/9,cb=Math.cos(b),sb=Math.sin(b);
    const r=0.782+0.055*cb;
    add(r*c,0.66+0.055*sb,r*s,c*cb,sb,s*cb,'rim')
  }
}
// Coffee surface: dark disk just below the rim; tiny ripple handled by dither.
for(let ring=0;ring<=15;ring++){const rr=0.731*ring/15;
  const count=Math.max(8,Math.round(20+ring*6));
  for(let j=0;j<count;j++){const a=TAU*j/count;
    add(rr*Math.cos(a),0.635,rr*Math.sin(a),0,1,0,'coffee')
  }
}
// C-shaped handle: a swept partial torus in mug-local x/y plane.
for(let j=0;j<=80;j++){const a=-1.72+3.44*j/80,c=Math.cos(a),s=Math.sin(a);
  const cx=0.96+0.49*c,cy=-0.035+0.50*s;
  const tx=-s,ty=c;
  for(let k=0;k<11;k++){const b=TAU*k/11,cb=Math.cos(b),sb=Math.sin(b);
    // Cross section lies in the local XY normal and Z directions.
    add(cx+0.10*c*cb,cy+0.10*s*cb,0.10*sb,c*cb,s*cb,sb,'handle')
  }
}
class AsciiCoffeeMug extends HTMLElement {
  static get observedAttributes(){return ['mug-tint','screen-bg']}
  constructor(){super();this.attachShadow({mode:'open'});this.shadowRoot.innerHTML=
    '<style>:host{display:block;width:100%;max-width:232px;aspect-ratio:232/124}canvas{display:block;width:100%;height:100%;border-radius:10px;background:#0c0d0e}</style>'+
    '<canvas role="img" aria-label="A revolving three-dimensional ASCII coffee mug with curling steam"></canvas>';
    this.canvas=this.shadowRoot.querySelector('canvas');this.ctx=this.canvas.getContext('2d');
    this.visible=true;this.running=false;this.raf=0;this.last=0;this.angle=0;this.frame=0;
    this.onVisibility=()=>{if(document.hidden)this.stop();else this.resume()};
    this.onMotion=()=>{if(this.media.matches){this.stop();this.paint()}else this.resume()};
  }
  connectedCallback(){
    this.media=window.matchMedia('(prefers-reduced-motion: reduce)');
    this.media.addEventListener?.('change',this.onMotion);
    document.addEventListener('visibilitychange',this.onVisibility);
    this.observer=new IntersectionObserver(entries=>{this.visible=!!entries[0]?.isIntersecting;if(this.visible)this.resume();else this.stop()});
    this.observer.observe(this);
    this.resize();this.paint();this.resume();
  }
  disconnectedCallback(){this.stop();this.observer?.disconnect();this.media?.removeEventListener?.('change',this.onMotion);document.removeEventListener('visibilitychange',this.onVisibility)}
  attributeChangedCallback(){if(this.isConnected)this.paint()}
  resize(){const dpr=Math.min(3,window.devicePixelRatio||1);this.canvas.width=Math.round(W*STEP*dpr);this.canvas.height=Math.round(H*STEP*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0)}
  resume(){if(!this.isConnected||!this.visible||document.hidden||this.media?.matches){this.paint();return}if(!this.running){this.running=true;this.last=0;this.raf=requestAnimationFrame(t=>this.tick(t))}}
  stop(){this.running=false;if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.last=0}
  tick(t){if(!this.running)return;if(!this.last)this.last=t;
    const dt=Math.min(0.08,(t-this.last)/1000);if(dt<1/30){this.raf=requestAnimationFrame(t=>this.tick(t));return}
    this.last=t;this.angle+=0.55*dt;this.frame++;this.paint();this.raf=requestAnimationFrame(t=>this.tick(t))
  }
  paint(){
    const c=this.ctx;if(!c)return;
    const bg=this.getAttribute('screen-bg')||'#0d1014',tint=this.getAttribute('mug-tint')||'#ffad5c';
    c.fillStyle=bg;c.fillRect(0,0,232,124);
    const glyphs=new Array(W*H).fill(' '),depth=new Float32Array(W*H);depth.fill(-Infinity);
    const materials=new Array(W*H).fill('body'),levels=new Float32Array(W*H);
    const ca=Math.cos(this.angle),sa=Math.sin(this.angle),ct=Math.cos(.36),st=Math.sin(.36);
    for(const p of POINTS){
      // Rotate geometry and normals around vertical Y, then pitch the camera down.
      const x=p.x*ca+p.z*sa,z=-p.x*sa+p.z*ca;
      const nx=p.nx*ca+p.nz*sa,nz=-p.nx*sa+p.nz*ca;
      const yc=p.y*ct-z*st,zc=p.y*st+z*ct;
      const ny=p.ny*ct-nz*st,nnz=p.ny*st+nz*ct;
      const persp=3.5/(4.2-zc);
      const sx=Math.round(28.4+x*13.3*persp),sy=Math.round(19.6-yc*13.0*persp);
      if(sx<0||sy<0||sx>=W||sy>=H)continue;
      const cell=sy*W+sx;if(zc<=depth[cell])continue;
      const brightness=clamp((nx*LIGHT[0]+ny*LIGHT[1]+nnz*LIGHT[2]+.25)*.73,0,1);
      const materialScale=p.material==='coffee'?.40:p.material==='rim'?1.1:p.material==='handle'?.95:.83;
      const noise=(Math.sin(cell*12.9898+this.frame*.27)*43758.5453)%1;
      const value=clamp(brightness*materialScale+(noise-Math.floor(noise)-.5)*.065,0,.999);
      glyphs[cell]=GLYPHS[Math.floor(value*GLYPHS.length)];
      depth[cell]=zc;materials[cell]=p.material;levels[cell]=value;
    }
    // Steam is three separate rising wave strands and never writes over solids.
    for(let s=0;s<3;s++)for(let j=0;j<12;j++){
      const rise=j/11,sy=Math.floor(12-j*.98);
      const sx=Math.round(25+s*4+Math.sin(rise*7+this.angle*.8+s*1.75)*1.8+Math.sin(rise*12+this.frame*.045+s)*.65);
      if(sx<0||sx>=W||sy<0||sy>=H)continue;
      const cell=sy*W+sx;if(glyphs[cell]!==' ')continue;
      glyphs[cell]=['.',';',':','~'][((j+s)%4)];materials[cell]='steam';levels[cell]=.42+rise*.18;
    }
    // Retro LCD scanlines, subtly visible through character screen.
    c.fillStyle='rgba(255,207,142,.025)';
    for(let y=1;y<124;y+=4)c.fillRect(0,y,232,.55);
    c.textBaseline='top';c.font='7.4px monospace';c.textAlign='left';
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const i=y*W+x,g=glyphs[i];if(g===' ')continue;
      c.globalAlpha=materials[i]==='coffee'?.55:materials[i]==='steam'?.36:.78;
      c.fillStyle=materials[i]==='rim'?'#fff1d5':materials[i]==='coffee'?'#8a5d3a':tint;
      c.shadowColor=materials[i]==='steam'?'#edceab':tint;c.shadowBlur=materials[i]==='rim'?3:1.3;
      c.fillText(g,x*STEP,y*STEP-.5);
    }
    c.shadowBlur=0;c.globalAlpha=1;
  }
}
if(!customElements.get('ascii-coffee-mug'))customElements.define('ascii-coffee-mug',AsciiCoffeeMug);
})();
