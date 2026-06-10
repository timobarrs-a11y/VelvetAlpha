import React from 'react';

export const W=88,H=76,CX=44,CY=38,BUF=8;
export const GRAV=0.38,WALK=1.9,CLIMB=1.5,FAST=4.8,VTERM=14;
export const rand=(a: number,b: number)=>a+Math.random()*(b-a);
export const ROT: Record<string,number>={floor:0,wall_r:-90,ceiling:180,wall_l:90,air:0};
export const LXP=[0,50,150,300,500,750,1100,1500,2000,2600];
export const LUNLOCK=['Walk & groom ✨','Stretch 🧘','Tail chase 🌀','Napping 😴','Zoomies ⚡','Heart eyes 💕','Sparkle burst ✨','Kneading 🐾','Bonus XP 🌟','❤️ Eternal love'];
export const getLv=(xp: number)=>Math.min(10,LXP.reduce((a,t,i)=>xp>=t?i+1:a,1));
export const xpPct=(xp: number,lv: number)=>lv>=10?100:Math.max(0,Math.round(((xp-LXP[lv-1])/(LXP[lv]-LXP[lv-1]))*100));
export const DIRT=[[8,-4],[-10,6],[14,8],[-4,12],[10,-10],[-14,0]];
export const BMOUTH: Record<string,string>={walk:'M 21.5 43 Q 24 45.5 26.5 43',zoom:'M 20 43 Q 24 47 28 43',sit:'M 20 43 Q 24 46.5 28 43',lick:'M 22 44 Q 24 41 26 44',groom:'M 23 43 Q 25 41 27 43',stretch:'M 19 44 Q 24 49 29 44',sleep:'M 22 43 Q 24 44 26 43',happy:'M 17 41 Q 24 49 31 41',love:'M 16 41 Q 24 50 32 41',tailchase:'M 18 42 Q 24 47 30 42',knead:'M 17 41 Q 24 49 31 41',fall:'M 22 44 Q 24 41.5 26 44',fall_fast:'M 20 46 Q 24 41 28 46',drag:'M 21 45 Q 24 41 27 45',thud:'M 20 47 Q 24 44 28 47',eat:'',yawn:''};

export interface FaceDef {
  eyes: string;
  ry: number;
  pry: number;
  m: string|null;
  flat: boolean;
  b: number;
  tongue?: boolean;
  yawn?: boolean;
  groom?: boolean;
  stretch?: boolean;
  sleep?: boolean;
  eat?: boolean;
  thud?: boolean;
}

export const FACE: Record<string,FaceDef>={
  walk:     {eyes:'normal',ry:5.2,pry:4.1,m:'M 27.5 43 Q 30 45.5 32.5 43',flat:false,b:.38},
  zoom:     {eyes:'normal',ry:4.2,pry:2.6,m:'M 26 43 Q 30 47 34 43',flat:false,b:.15},
  sit:      {eyes:'happy', ry:3.5,pry:2.5,m:'M 26 43 Q 30 46.5 34 43',flat:false,b:.55},
  lick:     {eyes:'squint',ry:2.0,pry:1.5,m:'M 28 44 Q 30 41 32 44',flat:false,b:.25,tongue:true},
  yawn:     {eyes:'squint',ry:1.5,pry:1.0,m:null,flat:false,b:.12,yawn:true},
  groom:    {eyes:'squint',ry:2.5,pry:1.6,m:'M 29 43 Q 31 41.5 33 43',flat:false,b:.3,groom:true},
  stretch:  {eyes:'happy', ry:3.0,pry:2.0,m:'M 25 44 Q 30 49 35 44',flat:false,b:.4,stretch:true},
  sleep:    {eyes:'sleep', ry:0,  pry:0,  m:'M 28 43 Q 30 44 32 43',flat:false,b:.45,sleep:true},
  happy:    {eyes:'uwu',   ry:0,  pry:0,  m:'M 23 41 Q 30 49 37 41',flat:false,b:.9},
  love:     {eyes:'hearts',ry:0,  pry:0,  m:'M 22 41 Q 30 50 38 41',flat:false,b:1.0},
  eat:      {eyes:'squint',ry:1.8,pry:1.2,m:null,flat:false,b:.4,eat:true},
  tailchase:{eyes:'uwu',   ry:3.2,pry:2.2,m:'M 24 42 Q 30 47 36 42',flat:false,b:.7},
  knead:    {eyes:'happy', ry:3.5,pry:2.5,m:'M 23 41 Q 30 49 37 41',flat:false,b:.65},
  fall:     {eyes:'normal',ry:5.8,pry:5.0,m:'M 28 44 Q 30 41.5 32 44',flat:false,b:0},
  fall_fast:{eyes:'wide',  ry:7.0,pry:6.4,m:'M 26 46 Q 30 41 34 46',flat:true,b:0},
  drag:     {eyes:'wide',  ry:7.2,pry:6.2,m:'M 27 45 Q 30 41 33 45',flat:true,b:0},
  thud:     {eyes:'x',     ry:0,  pry:0,  m:'M 26 47 Q 30 44 34 47',flat:true,b:0,thud:true},
};

interface EyeSetProps {
  f: FaceDef;
  ex1: number;
  ex2: number;
  ey: number;
  iris?: string;
  dark?: string;
}

function EyeSet({f, ex1, ex2, ey, iris='url(#ge)', dark='#18100a'}: EyeSetProps) {
  if(f.eyes==='hearts') return(
    <g>
      {[ex1,ex2].map((ex,i)=>(
        <g key={i} style={{transformOrigin:`${ex}px ${ey}px`,animation:`hpulse .65s ease-in-out ${i*.07}s infinite`}}>
          <path d={`M ${ex} ${ey+4} C ${ex-4} ${ey+2} ${ex-5.5} ${ey-1} ${ex-4.5} ${ey-3} C ${ex-3.5} ${ey-5} ${ex-1.5} ${ey-5} ${ex} ${ey-2.5} C ${ex+1.5} ${ey-5} ${ex+3.5} ${ey-5} ${ex+4.5} ${ey-3} C ${ex+5.5} ${ey-1} ${ex+4} ${ey+2} ${ex} ${ey+4} Z`} fill="#ff2255"/>
          <circle cx={ex-2} cy={ey-2.5} r="1.1" fill="white" opacity=".72"/>
        </g>
      ))}
    </g>);
  if(f.eyes==='happy') return(
    <g>
      <path d={`M ${ex1-5.5} ${ey+2} Q ${ex1} ${ey-5} ${ex1+5.5} ${ey+2}`} stroke={dark} strokeWidth="2.3" fill="none" strokeLinecap="round"/>
      <path d={`M ${ex2-5.5} ${ey+2} Q ${ex2} ${ey-5} ${ex2+5.5} ${ey+2}`} stroke={dark} strokeWidth="2.3" fill="none" strokeLinecap="round"/>
    </g>);
  if(f.eyes==='uwu') return(
    <g>
      <path d={`M ${ex1-6} ${ey+1} Q ${ex1} ${ey-6} ${ex1+6} ${ey+1}`} stroke={dark} strokeWidth="2.4" fill="none" strokeLinecap="round"/>
      <path d={`M ${ex2-6} ${ey+1} Q ${ex2} ${ey-6} ${ex2+6} ${ey+1}`} stroke={dark} strokeWidth="2.4" fill="none" strokeLinecap="round"/>
      <ellipse cx={ex1-6} cy={ey+4} rx="3" ry="1.7" fill="#f4a0b4" opacity=".65"/>
      <ellipse cx={ex2+6} cy={ey+4} rx="3" ry="1.7" fill="#f4a0b4" opacity=".65"/>
    </g>);
  if(f.eyes==='sleep') return(
    <g>
      <line x1={ex1-5} y1={ey} x2={ex1+5} y2={ey} stroke={dark} strokeWidth="2.3" strokeLinecap="round"/>
      <line x1={ex2-5} y1={ey} x2={ex2+5} y2={ey} stroke={dark} strokeWidth="2.3" strokeLinecap="round"/>
    </g>);
  if(f.eyes==='x') return(
    <g>
      <path d={`M ${ex1-5} ${ey-4.5} L ${ex1+5} ${ey+4.5} M ${ex1+5} ${ey-4.5} L ${ex1-5} ${ey+4.5}`} stroke={dark} strokeWidth="2.1" strokeLinecap="round"/>
      <path d={`M ${ex2-5} ${ey-4.5} L ${ex2+5} ${ey+4.5} M ${ex2+5} ${ey-4.5} L ${ex2-5} ${ey+4.5}`} stroke={dark} strokeWidth="2.1" strokeLinecap="round"/>
    </g>);
  if(f.eyes==='squint') return(
    <g>
      <ellipse cx={ex1} cy={ey} rx="5.6" ry={f.ry} fill="white"/>
      <ellipse cx={ex2} cy={ey} rx="5.6" ry={f.ry} fill="white"/>
      <ellipse cx={ex1} cy={ey+.5} rx="4.3" ry={Math.max(.35,f.ry-.8)} fill={iris}/>
      <ellipse cx={ex2} cy={ey+.5} rx="4.3" ry={Math.max(.35,f.ry-.8)} fill={iris}/>
      <ellipse cx={ex1} cy={ey+1} rx="1.7" ry={Math.max(.15,f.pry)} fill={dark}/>
      <ellipse cx={ex2} cy={ey+1} rx="1.7" ry={Math.max(.15,f.pry)} fill={dark}/>
    </g>);
  // normal / wide
  return(
    <g className="ceye">
      <ellipse cx={ex1} cy={ey} rx="5.6" ry={f.ry} fill="white"/>
      <ellipse cx={ex2} cy={ey} rx="5.6" ry={f.ry} fill="white"/>
      <ellipse cx={ex1} cy={ey+.5} rx="4.3" ry={Math.max(.45,f.ry-.7)} fill={iris}/>
      <ellipse cx={ex2} cy={ey+.5} rx="4.3" ry={Math.max(.45,f.ry-.7)} fill={iris}/>
      <ellipse cx={ex1} cy={ey+.9} rx="1.9" ry={f.pry} fill={dark}/>
      <ellipse cx={ex2} cy={ey+.9} rx="1.9" ry={f.pry} fill={dark}/>
      <circle cx={ex1+1.5} cy={ey-.8} r="1.3" fill="white"/>
      <circle cx={ex2+1.5} cy={ey-.8} r="1.3" fill="white"/>
      <circle cx={ex1-.5} cy={ey+2} r=".6" fill="white"/>
      <circle cx={ex2-.5} cy={ey+2} r=".6" fill="white"/>
      <path d={`M ${ex1-5.5} ${ey-3} Q ${ex1} ${ey-6} ${ex1+5.5} ${ey-3}`} stroke={dark} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      <path d={`M ${ex2-5.5} ${ey-3} Q ${ex2} ${ey-6} ${ex2+5.5} ${ey-3}`} stroke={dark} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
    </g>);
}

interface CatProps { pose: string; dirty?: number; }

function Cat({pose, dirty=0}: CatProps) {
  const f=FACE[pose]||FACE.walk;
  const mv=pose==='walk'||pose==='zoom', knd=pose==='knead';
  const sp=pose==='zoom'?'0.17s':'0.41s',tp=pose==='fall_fast'?'0.12s':pose==='zoom'?'0.21s':pose==='sleep'?'4.5s':'0.93s';
  const ta=pose==='drag'||pose==='fall_fast'?24:pose==='sleep'?3:pose==='sit'?7:13;
  const wc=pose==='thud'?'c-thud':pose==='fall_fast'?'c-vstretch':'';
  return(
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{overflow:'visible',filter:'drop-shadow(0 5px 18px rgba(0,0,0,.3))'}}>
      <defs>
        <style>{`
          @keyframes kt{0%,100%{transform:rotate(-${ta}deg)}50%{transform:rotate(${ta}deg)}}
          @keyframes kb{0%,100%{transform:translateY(0)}50%{transform:translateY(-3.5px)}}
          @keyframes ka{0%,100%{transform:rotate(-22deg)}50%{transform:rotate(22deg)}}
          @keyframes kc{0%{transform:rotate(22deg)}50%{transform:rotate(-22deg)}100%{transform:rotate(22deg)}}
          @keyframes kbr{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.04)}}
          @keyframes kblnk{0%,87%,100%{transform:scaleY(1)}92%{transform:scaleY(0.05)}95%{transform:scaleY(1)}}
          @keyframes squash{0%{transform:scaleY(.42) scaleX(1.48) translateY(7px)}35%{transform:scaleY(1.2) scaleX(.88)}65%{transform:scaleY(.96) scaleX(1.02)}100%{transform:scaleY(1) scaleX(1)}}
          @keyframes vstretch{0%,100%{transform:scaleY(1.26) scaleX(.82)}50%{transform:scaleY(1.3) scaleX(.79)}}
          @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
          @keyframes zzz{0%{opacity:0;transform:translateY(0) scale(.6)}30%{opacity:.9}80%{opacity:.2;transform:translateY(-18px) scale(1.1)}100%{opacity:0;transform:translateY(-26px) scale(1.2)}}
          @keyframes hpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}
          @keyframes kknl{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-7px) rotate(-18deg)}}
          @keyframes kknr{0%,100%{transform:translateY(0) rotate(0deg)}25%{transform:translateY(-7px) rotate(-18deg)}75%,100%{transform:translateY(0) rotate(0deg)}}
          .ct{transform-origin:62px 55px;animation:kt ${tp} ease-in-out infinite}
          .cw{transform-origin:44px 40px;animation:${mv?`kb ${sp} ease-in-out infinite`:'none'}}
          .la{transform-origin:26px 63px;animation:${mv?`ka ${sp} linear infinite`:'none'}}
          .lb{transform-origin:34px 63px;animation:${mv?`kc ${sp} linear infinite`:'none'}}
          .lc{transform-origin:54px 63px;animation:${mv?`kc ${sp} linear infinite`:'none'}}
          .ld{transform-origin:62px 63px;animation:${mv?`ka ${sp} linear infinite`:'none'}}
          .cbdy{transform-origin:48px 56px;animation:kbr 3.5s ease-in-out infinite}
          .ceye{transform-origin:29px 35px;animation:kblnk 4.2s ease-in-out infinite}
          .la-k{transform-origin:26px 63px;animation:kknl .38s ease-in-out infinite}
          .lb-k{transform-origin:34px 63px;animation:kknr .38s ease-in-out .19s infinite}
          .c-thud{transform-origin:44px 64px;animation:squash .48s ease-out forwards}
          .c-vstretch{transform-origin:44px 50px;animation:vstretch .26s ease-in-out infinite}
          .cpurr{transform-origin:28px 34px;animation:kbr .28s ease-in-out infinite}
          .sl{transform-origin:8px 14px;animation:spin .44s linear infinite}
          .sr{transform-origin:52px 10px;animation:spin .36s linear infinite reverse}
          .z1{animation:zzz 2.1s ease-out infinite}.z2{animation:zzz 2.1s ease-out .7s infinite}.z3{animation:zzz 2.1s ease-out 1.4s infinite}
        `}</style>
        <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f9c882"/><stop offset="100%" stopColor="#e8a24a"/></linearGradient>
        <linearGradient id="gh" x1="0" y1="0" x2=".35" y2="1"><stop offset="0%" stopColor="#fbd89e"/><stop offset="100%" stopColor="#e09846"/></linearGradient>
        <radialGradient id="gb" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fef4e4"/><stop offset="100%" stopColor="#f5dcaa"/></radialGradient>
        <radialGradient id="ge" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#9ccc65"/><stop offset="100%" stopColor="#558b2f"/></radialGradient>
      </defs>

      {pose==='sleep'&&<><text x="50" y="22" fontSize="10" fontWeight="bold" fill="#93c5fd" className="z1">z</text><text x="58" y="13" fontSize="13" fontWeight="bold" fill="#93c5fd" className="z2">z</text><text x="67" y="3" fontSize="16" fontWeight="bold" fill="#93c5fd" className="z3">Z</text></>}
      {pose==='eat'&&<><circle cx="50" cy="28" r="2.5" fill="#4a9eff" opacity=".85"><animate attributeName="cy" values="28;14" dur=".65s" repeatCount="indefinite"/><animate attributeName="opacity" values=".85;0" dur=".65s" repeatCount="indefinite"/></circle><circle cx="55" cy="24" r="1.8" fill="#7ab8f5" opacity=".7"><animate attributeName="cy" values="24;12" dur=".5s" begin=".15s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur=".5s" begin=".15s" repeatCount="indefinite"/></circle></>}

      <g className={wc}>
        <g className="ct">
          <path d="M 63 53 Q 80 40 75 21 Q 71 9 63 12" stroke="#c0801e" strokeWidth="9" fill="none" strokeLinecap="round"/>
          <path d="M 63 53 Q 80 40 75 21 Q 71 9 63 12" stroke="#f0b850" strokeWidth="5.5" fill="none" strokeLinecap="round"/>
          <circle cx="63" cy="12" r="7" fill="#fde9b0"/><circle cx="63" cy="12" r="4" fill="#f5c870"/>
        </g>
        <g className="cw">
          <g className="lc"><rect x="51" y="62" width="9.5" height="15" rx="4.5" fill="#cc8828"/><ellipse cx="55.8" cy="77" rx="6.5" ry="2.8" fill="#b47020"/></g>
          <g className="ld"><rect x="60" y="60" width="9.5" height="16" rx="4.5" fill="#d49228"/><ellipse cx="64.8" cy="76" rx="6.5" ry="2.8" fill="#bf7e1c"/></g>
          <g className="cbdy">
            <ellipse cx="48" cy="56" rx="30" ry="20" fill="url(#gf)"/>
            <ellipse cx="44" cy="60" rx="18" ry="12.5" fill="url(#gb)"/>
            <path d="M 37 44 Q 47 48 57 44" stroke="#c07820" strokeWidth="2" fill="none" opacity=".48"/>
            <path d="M 35 49.5 Q 47 54 59 49.5" stroke="#c07820" strokeWidth="1.6" fill="none" opacity=".36"/>
            {DIRT.slice(0,dirty).map((d,i)=><circle key={i} cx={48+d[0]} cy={56+d[1]} r={3.2} fill="#3a1800" opacity={.32}/>)}
          </g>
          {pose==='stretch'?(
            <><rect x="6" y="70" width="9" height="11" rx="4.5" fill="#e8a242" transform="rotate(-15,6,70)"/><ellipse cx="9" cy="80" rx="5" ry="2" fill="#cf8e2e"/><rect x="17" y="71" width="9" height="11" rx="4.5" fill="#dba03e" transform="rotate(-9,17,71)"/><ellipse cx="20" cy="81" rx="5" ry="2" fill="#c88c2a"/></>
          ):pose==='groom'?(
            <><g className="la"><rect x="22" y="62" width="9.5" height="16" rx="4.5" fill="#e8a242"/><ellipse cx="26.8" cy="78" rx="6.5" ry="2.8" fill="#cf8e2e"/></g><g transform="rotate(-68,34,62)"><rect x="31" y="61" width="9.5" height="15" rx="4.5" fill="#dba03e"/></g></>
          ):(
            <><g className={knd?'la-k':'la'}><rect x="22" y="62" width="9.5" height="16" rx="4.5" fill="#e8a242"/><ellipse cx="26.8" cy="78" rx="6.5" ry="2.8" fill="#cf8e2e"/></g><g className={knd?'lb-k':'lb'}><rect x="31" y="61" width="9.5" height="16" rx="4.5" fill="#dba03e"/><ellipse cx="35.8" cy="77" rx="6.5" ry="2.8" fill="#c88c2a"/></g></>
          )}
        </g>
        <g className={pose==='happy'||pose==='love'?'cpurr':''}>
          <circle cx="28" cy="34" r="22" fill="url(#gh)"/>
          {f.flat?(<><polygon points="7,26 14,13 23,23" fill="#d49240"/><polygon points="33,23 42,13 49,26" fill="#d49240"/></>):(<><polygon points="9,23 16,5 27,22" fill="#d49240"/><polygon points="12,21 16,7 25,21" fill="#f0a0b0" opacity=".7"/><polygon points="29,22 37,5 44,23" fill="#d49240"/><polygon points="31,21 37,7 42,21" fill="#f0a0b0" opacity=".7"/></>)}
          <path d="M 19 17.5 Q 23 14 27 17.5" stroke="#b07020" strokeWidth="1.6" fill="none" opacity=".48"/>
          <path d="M 27 15 Q 31 11.5 35 15" stroke="#b07020" strokeWidth="1.5" fill="none" opacity=".40"/>
          <EyeSet f={f} ex1={23} ex2={35} ey={35} iris="url(#ge)"/>
          <polygon points="27.5,41 30,38 32.5,41 30,43.5" fill="#e8829a"/>
          {f.yawn?(<><ellipse cx="30" cy="45" rx="5.2" ry="6.8" fill="#7a1a1a" opacity=".9"/><ellipse cx="30" cy="45" rx="3.5" ry="5" fill="#b03050" opacity=".8"/><path d="M 26 40 Q 30 38 34 40" stroke="#5a3618" strokeWidth="1.2" fill="none"/></>):f.eat?(<ellipse cx="30" cy="44" rx="3.8" ry="3.8" fill="#7a1a1a" opacity=".9"/>):f.m?(<path d={f.m} stroke="#6b3828" strokeWidth="1.4" fill="none" strokeLinecap="round"/>):null}
          {f.tongue&&<ellipse cx="30" cy="44.5" rx="2.8" ry="1.6" fill="#f06090" opacity=".85"/>}
          {pose==='groom'&&<ellipse cx="21" cy="36" rx="2.8" ry="1.6" fill="#f06090" opacity=".7"/>}
          {f.b>0&&<><ellipse cx="14.5" cy="41" rx="4" ry="2.3" fill="#f4a0b4" opacity={f.b}/><ellipse cx="41.5" cy="41" rx="4" ry="2.3" fill="#f4a0b4" opacity={f.b}/></>}
          <line x1="3" y1="38.5" x2="18" y2="40.5" stroke="#c8a060" strokeWidth="1.1" opacity=".55"/>
          <line x1="2" y1="42" x2="17" y2="42" stroke="#c8a060" strokeWidth="1.1" opacity=".55"/>
          <line x1="3" y1="45.5" x2="18" y2="43.5" stroke="#c8a060" strokeWidth="1.1" opacity=".55"/>
          <line x1="38" y1="40.5" x2="53" y2="38.5" stroke="#c8a060" strokeWidth="1.1" opacity=".55"/>
          <line x1="39" y1="42" x2="54" y2="42" stroke="#c8a060" strokeWidth="1.1" opacity=".55"/>
          <line x1="38" y1="43.5" x2="53" y2="45.5" stroke="#c8a060" strokeWidth="1.1" opacity=".55"/>
          {f.thud&&<><g className="sl"><polygon points="8,10 9.5,13.5 13,13.5 10.5,15.8 11.5,19.2 8,17 4.5,19.2 5.5,15.8 3,13.5 6.5,13.5" fill="#ffd700"/></g><g className="sr"><polygon points="52,6 53.2,9 56.5,9 54,11 55,14.2 52,12.5 49,14.2 50,11 47.5,9 50.8,9" fill="#ffd700"/></g></>}
        </g>
      </g>
    </svg>
  );
}

interface BunnyProps { pose: string; dirty?: number; }

function Bunny({pose, dirty=0}: BunnyProps) {
  const f=FACE[pose]||FACE.walk;
  const mv=pose==='walk'||pose==='zoom', knd=pose==='knead';
  const sp=pose==='zoom'?'0.17s':'0.34s';
  const wc=pose==='thud'?'c-thud':pose==='fall_fast'?'c-vstretch':'';
  return(
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{overflow:'visible',filter:'drop-shadow(0 5px 20px rgba(0,0,0,.28))'}}>
      <defs>
        <style>{`
          @keyframes bkt{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
          @keyframes kb{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
          @keyframes ka{0%,100%{transform:rotate(-22deg)}50%{transform:rotate(22deg)}}
          @keyframes kc{0%{transform:rotate(22deg)}50%{transform:rotate(-22deg)}100%{transform:rotate(22deg)}}
          @keyframes kbr{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.04)}}
          @keyframes kblnk{0%,87%,100%{transform:scaleY(1)}92%{transform:scaleY(0.05)}95%{transform:scaleY(1)}}
          @keyframes squash{0%{transform:scaleY(.38) scaleX(1.55) translateY(9px)}35%{transform:scaleY(1.25) scaleX(.85)}65%{transform:scaleY(.97) scaleX(1.02)}100%{transform:scaleY(1) scaleX(1)}}
          @keyframes vstretch{0%,100%{transform:scaleY(1.3) scaleX(.8)}50%{transform:scaleY(1.34) scaleX(.77)}}
          @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
          @keyframes zzz{0%{opacity:0;transform:translateY(0) scale(.6)}30%{opacity:.9}80%{opacity:.2;transform:translateY(-18px) scale(1.1)}100%{opacity:0;transform:translateY(-26px) scale(1.2)}}
          @keyframes hpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}
          @keyframes kknl{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-7px) rotate(-18deg)}}
          @keyframes kknr{0%,100%{transform:translateY(0)}25%{transform:translateY(-7px) rotate(-18deg)}75%,100%{transform:translateY(0)}}
          @keyframes bearfl{0%,100%{transform:rotate(-2deg) scaleX(.97)}50%{transform:rotate(2deg) scaleX(1)}}
          .ct{transform-origin:62px 52px;animation:bkt 2.4s ease-in-out infinite}
          .cw{transform-origin:44px 40px;animation:${mv?`kb ${sp} ease-in-out infinite`:'none'}}
          .la{transform-origin:24px 64px;animation:${mv?`ka ${sp} linear infinite`:'none'}}
          .lb{transform-origin:32px 64px;animation:${mv?`kc ${sp} linear infinite`:'none'}}
          .lc{transform-origin:52px 63px;animation:${mv?`kc ${sp} linear infinite`:'none'}}
          .ld{transform-origin:60px 63px;animation:${mv?`ka ${sp} linear infinite`:'none'}}
          .cbdy{transform-origin:46px 57px;animation:kbr 3.2s ease-in-out infinite}
          .ceye{transform-origin:24px 33px;animation:kblnk 3.8s ease-in-out infinite}
          .la-k{transform-origin:24px 64px;animation:kknl .38s ease-in-out infinite}
          .lb-k{transform-origin:32px 64px;animation:kknr .38s ease-in-out .19s infinite}
          .c-thud{transform-origin:44px 65px;animation:squash .48s ease-out forwards}
          .c-vstretch{transform-origin:44px 50px;animation:vstretch .26s ease-in-out infinite}
          .cpurr{transform-origin:24px 33px;animation:kbr .28s ease-in-out infinite}
          .bear{transform-origin:24px 24px;animation:bearfl 3.8s ease-in-out infinite}
          .sl{transform-origin:8px 14px;animation:spin .44s linear infinite}
          .sr{transform-origin:52px 10px;animation:spin .36s linear infinite reverse}
          .z1{animation:zzz 2.1s ease-out infinite}.z2{animation:zzz 2.1s ease-out .7s infinite}.z3{animation:zzz 2.1s ease-out 1.4s infinite}
        `}</style>
        <linearGradient id="bf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eee8f8"/><stop offset="100%" stopColor="#d4c5e8"/></linearGradient>
        <linearGradient id="bh" x1="0" y1="0" x2=".3" y2="1"><stop offset="0%" stopColor="#f2ecfa"/><stop offset="100%" stopColor="#ddd0ee"/></linearGradient>
        <radialGradient id="bb" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#f8f4ff"/><stop offset="100%" stopColor="#e8e0f4"/></radialGradient>
        <radialGradient id="btail" cx="35%" cy="30%" r="70%"><stop offset="0%" stopColor="white"/><stop offset="100%" stopColor="#ece4f8"/></radialGradient>
      </defs>

      {pose==='sleep'&&<><text x="50" y="22" fontSize="10" fontWeight="bold" fill="#93c5fd" className="z1">z</text><text x="58" y="13" fontSize="13" fontWeight="bold" fill="#93c5fd" className="z2">z</text><text x="67" y="3" fontSize="16" fontWeight="bold" fill="#93c5fd" className="z3">Z</text></>}
      {pose==='eat'&&<><circle cx="48" cy="26" r="2.2" fill="#a78bfa" opacity=".8"><animate attributeName="cy" values="26;12" dur=".6s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0" dur=".6s" repeatCount="indefinite"/></circle><circle cx="53" cy="22" r="1.6" fill="#c4b5fd" opacity=".7"><animate attributeName="cy" values="22;10" dur=".48s" begin=".18s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur=".48s" begin=".18s" repeatCount="indefinite"/></circle></>}

      <g className={wc}>
        <g className="ct">
          <circle cx="68" cy="53" r="9.5" fill="url(#btail)"/>
          <circle cx="67" cy="52" r="6" fill="white" opacity=".6"/>
        </g>

        <g className="cw">
          <g className="lc"><rect x="49" y="63" width="10" height="14" rx="5" fill="#c4b4d8"/><ellipse cx="54" cy="77" rx="6" ry="2.5" fill="#b0a0c8"/></g>
          <g className="ld"><rect x="59" y="61" width="10" height="15" rx="5" fill="#cbbade"/><ellipse cx="64" cy="76" rx="6" ry="2.5" fill="#b8a6d0"/></g>
          <g className="cbdy">
            <ellipse cx="46" cy="57" rx="25" ry="17" fill="url(#bf)"/>
            <ellipse cx="44" cy="61" rx="17" ry="12" fill="url(#bb)"/>
            <path d="M 33 47 Q 46 52 59 47" stroke="#c4b4d8" strokeWidth="1.5" fill="none" opacity=".45"/>
            {DIRT.slice(0,dirty).map((d,i)=><circle key={i} cx={46+d[0]} cy={57+d[1]} r={3.2} fill="#3a1800" opacity={.28}/>)}
          </g>
          {pose==='stretch'?(
            <><rect x="5" y="70" width="9" height="11" rx="4.5" fill="#d4c4e8" transform="rotate(-12,5,70)"/><ellipse cx="8" cy="80" rx="5" ry="2" fill="#c0b0d8"/><rect x="15" y="71" width="9" height="11" rx="4.5" fill="#c8b8dc" transform="rotate(-7,15,71)"/><ellipse cx="18" cy="81" rx="5" ry="2" fill="#b8a8d0"/></>
          ):pose==='groom'?(
            <><g className="la"><rect x="20" y="63" width="9.5" height="15" rx="4.5" fill="#d4c4e8"/><ellipse cx="24.8" cy="78" rx="6" ry="2.5" fill="#c0b0d8"/></g><g transform="rotate(-65,32,63)"><rect x="29" y="62" width="9.5" height="14" rx="4.5" fill="#cbbade"/></g></>
          ):(
            <><g className={knd?'la-k':'la'}><rect x="20" y="63" width="9.5" height="15" rx="4.5" fill="#d4c4e8"/><ellipse cx="24.8" cy="78" rx="6" ry="2.5" fill="#c0b0d8"/></g><g className={knd?'lb-k':'lb'}><rect x="29" y="62" width="9.5" height="15" rx="4.5" fill="#cbbade"/><ellipse cx="33.8" cy="77" rx="6" ry="2.5" fill="#b8a6d0"/></g></>
          )}
        </g>

        <g className={pose==='happy'||pose==='love'?'cpurr':''}>
          <g className="bear">
            <path d="M 13 24 Q 10 -2 19 -5 Q 28 -2 25 24 Z" fill="url(#bh)"/>
            <path d="M 15.5 22 Q 13.5 2 19 0 Q 24.5 2 22.5 22 Z" fill="#f4a0b4" opacity=".75"/>
            <path d="M 25 24 Q 22 -2 31 -5 Q 40 -2 37 24 Z" fill="url(#bh)"/>
            <path d="M 27.5 22 Q 25.5 2 31 0 Q 36.5 2 34.5 22 Z" fill="#f4a0b4" opacity=".75"/>
          </g>
          <circle cx="24" cy="33" r="20" fill="url(#bh)"/>
          <EyeSet f={f} ex1={17} ex2={30} ey={32} iris="#1a0a08" dark="#1a0a08"/>
          <ellipse cx="23.5" cy="40" rx="2.2" ry="1.5" fill="#e8829a"/>
          {f.yawn?(
            <><ellipse cx="23.5" cy="44" rx="4.5" ry="6" fill="#7a1a1a" opacity=".88"/><ellipse cx="23.5" cy="44" rx="3" ry="4.5" fill="#b03050" opacity=".8"/></>
          ):f.eat?(
            <ellipse cx="23.5" cy="43" rx="3.2" ry="3.2" fill="#7a1a1a" opacity=".9"/>
          ):(BMOUTH[pose]?(
            <path d={BMOUTH[pose]} stroke="#9b6b6b" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
          ):null)}
          {f.tongue&&<ellipse cx="23.5" cy="43.5" rx="2.5" ry="1.5" fill="#f06090" opacity=".85"/>}
          {pose==='groom'&&<ellipse cx="15" cy="35" rx="2.5" ry="1.5" fill="#f06090" opacity=".68"/>}
          {f.b>0&&<><ellipse cx="10" cy="40" rx="3.5" ry="2" fill="#f4a0b4" opacity={f.b*.75}/><ellipse cx="36" cy="40" rx="3.5" ry="2" fill="#f4a0b4" opacity={f.b*.75}/></>}
          <line x1="1" y1="39" x2="14" y2="40.5" stroke="#c8c0d8" strokeWidth="1" opacity=".5"/>
          <line x1="1" y1="41.5" x2="14" y2="41.5" stroke="#c8c0d8" strokeWidth="1" opacity=".5"/>
          <line x1="1" y1="44" x2="14" y2="43" stroke="#c8c0d8" strokeWidth="1" opacity=".5"/>
          <line x1="34" y1="40.5" x2="47" y2="39" stroke="#c8c0d8" strokeWidth="1" opacity=".5"/>
          <line x1="34" y1="41.5" x2="47" y2="41.5" stroke="#c8c0d8" strokeWidth="1" opacity=".5"/>
          <line x1="34" y1="43" x2="47" y2="44" stroke="#c8c0d8" strokeWidth="1" opacity=".5"/>
          {f.thud&&<><g className="sl"><polygon points="8,10 9.5,13.5 13,13.5 10.5,15.8 11.5,19.2 8,17 4.5,19.2 5.5,15.8 3,13.5 6.5,13.5" fill="#ffd700"/></g><g className="sr"><polygon points="52,6 53.2,9 56.5,9 54,11 55,14.2 52,12.5 49,14.2 50,11 47.5,9 50.8,9" fill="#ffd700"/></g></>}
        </g>
      </g>
    </svg>
  );
}

interface AnimalSpriteProps {
  pose: string;
  dirty: number;
  animalType: 'cat' | 'bunny';
}

export function AnimalSprite({pose, dirty, animalType}: AnimalSpriteProps) {
  return(
    <div style={{animation:pose==='tailchase'?'ktailspin .82s linear infinite':'none',transformOrigin:'center center'}}>
      {animalType==='bunny'?<Bunny pose={pose} dirty={dirty}/>:<Cat pose={pose} dirty={dirty}/>}
    </div>
  );
}
