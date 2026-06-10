import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimalSprite, W, H, CX, CY, BUF, GRAV, WALK, CLIMB, FAST, VTERM, rand, ROT, getLv } from './AnimalSprite';

export interface PetStats {
  hunger: number;
  mood: number;
  clean: number;
  xp: number;
  level: number;
}

interface PetCompanionProps {
  enabled: boolean;
  name: string;
  animalType: 'cat' | 'bunny';
  actionsRef: React.MutableRefObject<any>;
  catPosRef: React.MutableRefObject<any>;
  onStats: (s: PetStats) => void;
  initialStats?: PetStats;
}

export function PetCompanion({enabled, name, animalType, actionsRef, catPosRef, onStats, initialStats}: PetCompanionProps) {
  const div=useRef<HTMLDivElement>(null), labelRef=useRef<HTMLDivElement>(null), raf=useRef<number|null>(null), pC=useRef('fall');
  const [poseVis,setPoseVis]=useState('fall');
  const [dirtyVis,setDirtyVis]=useState(0);
  const [hearts,setHearts]=useState<Array<{id:number,x:number,y:number}>>([]);
  const [sparkles,setSparkles]=useState<Array<{id:number,x:number,y:number,ch:string,sz:number}>>([]);
  const ptrStart=useRef<{x:number,y:number}|null>(null),dragActive=useRef(false),stTick=useRef(0);

  const s=useRef({
    cx:window.innerWidth*.5,cy:80,vx:rand(-1,1),vy:2,surface:'air',traverse:1,speed:WALK,pose:'fall',
    dragging:false,dragOX:0,dragOY:0,idleCD:rand(200,380),actTimer:0,
    hunger:initialStats?.hunger??82,mood:initialStats?.mood??78,clean:initialStats?.clean??90,xp:initialStats?.xp??0,
  });

  // Seed stats if initialStats changes (on load from DB)
  useEffect(()=>{
    if(!initialStats)return;
    const r=s.current;
    r.hunger=initialStats.hunger;r.mood=initialStats.mood;r.clean=initialStats.clean;r.xp=initialStats.xp;
  },[initialStats?.hunger,initialStats?.mood,initialStats?.clean,initialStats?.xp]);

  const addHearts=useCallback((x: number,y: number,count=5)=>{
    const nh=Array.from({length:count},(_,i)=>({id:Date.now()+i,x:x+rand(-28,28),y}));
    setHearts(h=>[...h,...nh]);setTimeout(()=>setHearts(h=>h.filter(t=>!nh.find(n=>n.id===t.id))),1400);
  },[]);
  const addSparkles=useCallback((x: number,y: number,count=6)=>{
    const ch=['✨','⭐','💫','🌟','💥'];
    const ns=Array.from({length:count},(_,i)=>({id:Date.now()+i,x:x+rand(-38,38),y:y+rand(-22,14),ch:ch[Math.floor(Math.random()*ch.length)],sz:rand(10,19)}));
    setSparkles(s=>[...s,...ns]);setTimeout(()=>setSparkles(s=>s.filter(t=>!ns.find(n=>n.id===t.id))),1100);
  },[]);

  useEffect(()=>{
    if(!actionsRef)return;
    actionsRef.current={
      pet:()=>{
        const r=s.current;if(r.surface==='air')return;
        const lv=getLv(r.xp),ep=lv>=6?'love':'happy';
        addHearts(r.cx,r.cy-CY-14,lv>=7?9:5);
        r.xp+=(getLv(r.xp)>=9?16:8);r.mood=Math.min(100,r.mood+22);
        r.pose=ep;r.actTimer=90;pC.current=ep;setPoseVis(ep);
      },
      fedByDrag:()=>{
        const r=s.current;r.hunger=Math.min(100,r.hunger+50);r.xp+=18;r.mood=Math.min(100,r.mood+10);
        r.pose='eat';r.actTimer=70;pC.current='eat';setPoseVis('eat');addHearts(r.cx,r.cy-CY-10,3);
      },
      brushStroke:()=>{
        const r=s.current,lv=getLv(r.xp);
        r.clean=Math.min(100,r.clean+9);r.xp+=5;r.mood=Math.min(100,r.mood+4);
        const dc=Math.min(6,Math.floor((100-r.clean)/16));setDirtyVis(dc);
        addSparkles(r.cx,r.cy-CY,lv>=7?11:6);
        if(r.surface==='floor'&&Math.random()<.42){r.pose='happy';r.actTimer=50;pC.current='happy';setPoseVis('happy');}
      },
    };
  },[actionsRef,addHearts,addSparkles]);

  useEffect(()=>{
    if(!enabled)return;
    const sync=(p: string)=>{if(p!==pC.current){pC.current=p;setPoseVis(p);}};
    const loop=()=>{
      const r=s.current;
      if(!r.dragging){
        const VW=window.innerWidth,VH=window.innerHeight;
        const FL=VH-CY,CE=CY,RW=VW-CY,LW=CY,lv=getLv(r.xp);
        r.hunger=Math.max(0,r.hunger-.0018);
        r.mood=Math.max(0,r.mood-.0008-(r.clean<30?.0005:0));
        r.clean=Math.max(0,r.clean-.0012);
        stTick.current++;
        if(stTick.current>=120){
          stTick.current=0;
          const dc=Math.min(6,Math.floor((100-r.clean)/16));setDirtyVis(dc);
          onStats({hunger:r.hunger,mood:r.mood,clean:r.clean,xp:r.xp,level:lv});
        }
        if(catPosRef)catPosRef.current={cx:r.cx,cy:r.cy,surface:r.surface};

        if(r.surface==='air'){
          r.vy=Math.min(r.vy+GRAV,VTERM);r.cx+=r.vx;r.cy+=r.vy;
          r.cx=Math.max(LW+BUF,Math.min(RW-BUF,r.cx));
          r.vy>7?sync('fall_fast'):sync('fall');
          if(r.cy>=FL){const imp=r.vy;r.cy=FL;r.vy=0;r.vx=0;r.surface='floor';r.speed=WALK;imp>8?(r.pose='thud',r.actTimer=32,sync('thud')):(r.pose='walk',sync('walk'),r.idleCD=rand(200,360));}
          else if(r.cy<=CE){r.cy=CE;r.vy=0;r.vx=0;r.surface='ceiling';r.speed=WALK;sync('walk');}
          else if(r.cx>=RW-BUF){r.cx=RW;r.vx=0;r.surface='wall_r';r.speed=CLIMB;r.cy=Math.max(CE+BUF,Math.min(FL-BUF,r.cy));r.traverse=r.vy<0?1:-1;sync('walk');}
          else if(r.cx<=LW+BUF){r.cx=LW;r.vx=0;r.surface='wall_l';r.speed=CLIMB;r.cy=Math.max(CE+BUF,Math.min(FL-BUF,r.cy));r.traverse=r.vy>0?1:-1;sync('walk');}
        }
        else if(r.surface==='floor'){
          r.cy=FL;
          if(r.pose==='walk'||r.pose==='zoom'){
            r.cx+=r.traverse*r.speed;
            if(r.cx>=RW){r.cx=RW;r.cy=FL-BUF;r.surface='wall_r';r.speed=CLIMB;sync('walk');}
            else if(r.cx<=LW){r.cx=LW;r.cy=FL-BUF;r.surface='wall_l';r.speed=CLIMB;sync('walk');}
            else{
              if(r.pose==='zoom'){r.actTimer--;if(r.actTimer<=0){r.pose='walk';r.speed=WALK;sync('walk');}}
              else{
                r.idleCD--;
                if(r.idleCD<=0){
                  r.idleCD=rand(160,420);
                  const t=Math.random(),sad=r.mood<35,chipper=r.mood>65;
                  if(t<.10)                     {r.pose='sit';r.actTimer=rand(80,180);sync('sit');}
                  else if(t<.19)                {r.pose='lick';r.actTimer=rand(55,110);sync('lick');}
                  else if(t<.29)                {r.pose='yawn';r.actTimer=rand(35,60);sync('yawn');}
                  else if(t<.42&&lv>=2)         {r.pose='stretch';r.actTimer=rand(50,85);sync('stretch');}
                  else if(t<.54)                {r.pose='groom';r.actTimer=rand(80,160);sync('groom');}
                  else if(t<.63)                {r.traverse*=-1;}
                  else if(t<.72&&lv>=3)         {r.pose='tailchase';r.actTimer=rand(55,110);sync('tailchase');}
                  else if(t<.80&&chipper&&lv>=5){r.pose='zoom';r.speed=FAST;r.actTimer=rand(25,55);sync('zoom');}
                  else if(t<.90&&lv>=8)         {r.pose='knead';r.actTimer=rand(80,160);sync('knead');}
                  else if(sad&&lv>=4)           {r.pose='sleep';r.actTimer=rand(200,380);sync('sleep');}
                }
              }
            }
          }else{r.actTimer--;if(r.actTimer<=0){r.pose='walk';r.speed=WALK;sync('walk');r.idleCD=rand(200,360);}}
        }
        else if(r.surface==='wall_r'){
          r.cy-=r.traverse*r.speed;r.cx=RW;
          if(r.cy<=CE){r.cy=CE;r.cx=RW-BUF;r.surface='ceiling';r.speed=WALK;sync('walk');}
          else if(r.cy>=FL){r.cy=FL;r.cx=RW-BUF;r.surface='floor';r.speed=WALK;sync('walk');r.idleCD=rand(200,360);}
        }
        else if(r.surface==='ceiling'){
          r.cx-=r.traverse*r.speed;r.cy=CE;
          if(r.cx<=LW){r.cx=LW;r.cy=CE+BUF;r.surface='wall_l';r.speed=CLIMB;sync('walk');}
          else if(r.cx>=RW){r.cx=RW;r.cy=CE+BUF;r.surface='wall_r';r.speed=CLIMB;sync('walk');}
          r.idleCD--;
          if(r.idleCD<=0){r.idleCD=rand(220,500);if(Math.random()<.14){r.surface='air';r.vy=1;r.vx=(Math.random()-.5)*3;sync('fall');}}
        }
        else if(r.surface==='wall_l'){
          r.cy+=r.traverse*r.speed;r.cx=LW;
          if(r.cy>=FL){r.cy=FL;r.cx=LW+BUF;r.surface='floor';r.speed=WALK;sync('walk');r.idleCD=rand(200,360);}
          else if(r.cy<=CE){r.cy=CE;r.cx=LW+BUF;r.surface='ceiling';r.speed=WALK;sync('walk');}
        }

        if(div.current){
          const rot=ROT[r.surface]??0,sx=r.surface==='air'?(r.vx>=0?-1:1):-r.traverse;
          div.current.style.left=`${r.cx-CX}px`;div.current.style.top=`${r.cy-CY}px`;
          div.current.style.transform=`rotate(${rot}deg) scaleX(${sx})`;
        }
        if(labelRef.current){
          labelRef.current.style.left=`${r.cx-40}px`;
          labelRef.current.style.top=`${r.cy-CY-26}px`;
        }
      }
      raf.current=requestAnimationFrame(loop);
    };
    raf.current=requestAnimationFrame(loop);
    return()=>{if(raf.current)cancelAnimationFrame(raf.current);};
  },[enabled,onStats,catPosRef]);

  useEffect(()=>{
    const onMove=(e: PointerEvent)=>{
      if(!ptrStart.current)return;
      const r=s.current,dx=e.clientX-ptrStart.current.x,dy=e.clientY-ptrStart.current.y;
      if(!dragActive.current&&dx*dx+dy*dy>36){
        dragActive.current=true;r.dragging=true;r.dragOX=ptrStart.current.x-r.cx;r.dragOY=ptrStart.current.y-r.cy;
        pC.current='drag';setPoseVis('drag');if(div.current)div.current.style.transform='rotate(0deg) scaleX(-1)';
      }
      if(dragActive.current){r.cx=e.clientX-r.dragOX;r.cy=e.clientY-r.dragOY;if(div.current){div.current.style.left=`${r.cx-CX}px`;div.current.style.top=`${r.cy-CY}px`;}}
    };
    const onUp=()=>{
      if(!ptrStart.current)return;
      const r=s.current;
      if(!dragActive.current&&r.surface!=='air'){
        const lv=getLv(r.xp),ep=lv>=6?'love':'happy';
        addHearts(r.cx,r.cy-CY-14,lv>=7?9:5);
        r.xp+=(lv>=9?16:8);r.mood=Math.min(100,r.mood+22);r.pose=ep;r.actTimer=90;pC.current=ep;setPoseVis(ep);
        onStats({hunger:r.hunger,mood:r.mood,clean:r.clean,xp:r.xp,level:lv});
      }else if(dragActive.current){r.dragging=false;r.surface='air';r.vy=rand(1,3);r.vx=(Math.random()-.5)*5;pC.current='fall';setPoseVis('fall');}
      dragActive.current=false;ptrStart.current=null;
    };
    window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);
    return()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);};
  },[addHearts,onStats]);

  if(!enabled)return null;
  return(<>
    <style>{`
      @keyframes ktailspin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes fh{0%{opacity:1;transform:translateY(0) scale(.8)}100%{opacity:0;transform:translateY(-58px) scale(1.6)}}
      @keyframes sp{0%{opacity:1;transform:scale(0) rotate(0deg)}50%{opacity:1;transform:scale(1.4) rotate(180deg)}100%{opacity:0;transform:scale(.4) rotate(360deg) translateY(-24px)}}
    `}</style>

    <div ref={labelRef} style={{position:'fixed',zIndex:79,width:80,textAlign:'center',pointerEvents:'none',background:'rgba(0,0,0,.45)',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,padding:'2px 8px',backdropFilter:'blur(6px)',fontSize:11,fontWeight:600,color:'rgba(255,255,255,.75)',whiteSpace:'nowrap',letterSpacing:'.3px'}}>
      {name}
    </div>

    {hearts.map(h=><div key={h.id} style={{position:'fixed',left:h.x,top:h.y,zIndex:90,fontSize:22,pointerEvents:'none',animation:'fh 1.3s ease-out forwards'}}>❤️</div>)}
    {sparkles.map(sp=><div key={sp.id} style={{position:'fixed',left:sp.x,top:sp.y,zIndex:90,fontSize:`${sp.sz}px`,pointerEvents:'none',animation:'sp 1.1s ease-out forwards'}}>{sp.ch}</div>)}

    <div ref={div} onPointerDown={e=>{e.preventDefault();ptrStart.current={x:e.clientX,y:e.clientY};dragActive.current=false;}}
      style={{position:'fixed',zIndex:80,width:`${W}px`,height:`${H}px`,touchAction:'none',cursor:'grab',willChange:'transform,left,top',transformOrigin:`${CX}px ${CY}px`,userSelect:'none'}}>
      <AnimalSprite pose={poseVis} dirty={dirtyVis} animalType={animalType}/>
    </div>
  </>);
}
