import React, { useState, useEffect, useRef } from 'react';

const ANCHOR_X=28, ANCHOR_Y_OFFSET=28;

interface RadialToolsProps {
  catPosRef: React.MutableRefObject<any>;
  onFed: () => void;
  onStroke: () => void;
}

export function RadialTools({catPosRef, onFed, onStroke}: RadialToolsProps) {
  const [open,setOpen]=useState(false);
  const anchorY=window.innerHeight-ANCHOR_Y_OFFSET;
  const [foodPos,setFoodPos]=useState<{x:number,y:number}|null>(null);
  const [brushPos,setBrushPos]=useState<{x:number,y:number}|null>(null);
  const [foodDragging,setFoodDragging]=useState(false);
  const [brushDragging,setBrushDragging]=useState(false);
  const [brushNear,setBrushNear]=useState(false);
  const [eaten,setEaten]=useState(false);
  const foodOff=useRef({x:0,y:0}),brushOff=useRef({x:0,y:0});
  const brushDist=useRef(0),brushLastX=useRef(0);

  useEffect(()=>{
    if(!foodDragging)return;
    const mv=(e: PointerEvent)=>setFoodPos({x:e.clientX-foodOff.current.x,y:e.clientY-foodOff.current.y});
    const up=(e: PointerEvent)=>{
      setFoodDragging(false);
      const c=catPosRef.current;
      if(Math.hypot(e.clientX-c.cx,e.clientY-c.cy)<110&&c.surface!=='air'){
        setEaten(true);onFed();setTimeout(()=>{setFoodPos(null);setEaten(false);},2800);
      }else setFoodPos(null);
    };
    window.addEventListener('pointermove',mv as EventListener);window.addEventListener('pointerup',up as EventListener);
    return()=>{window.removeEventListener('pointermove',mv as EventListener);window.removeEventListener('pointerup',up as EventListener);};
  },[foodDragging]);

  useEffect(()=>{
    if(!brushDragging)return;
    const mv=(e: PointerEvent)=>{
      setBrushPos({x:e.clientX-brushOff.current.x,y:e.clientY-brushOff.current.y});
      const c=catPosRef.current;
      const near=Math.hypot(e.clientX-c.cx,e.clientY-c.cy)<115&&c.surface==='floor';
      setBrushNear(near);
      if(near){brushDist.current+=Math.abs(e.clientX-brushLastX.current);if(brushDist.current>=42){brushDist.current=0;onStroke();}}
      brushLastX.current=e.clientX;
    };
    const up=()=>{setBrushDragging(false);setBrushNear(false);brushDist.current=0;setBrushPos(null);};
    window.addEventListener('pointermove',mv as EventListener);window.addEventListener('pointerup',up);
    return()=>{window.removeEventListener('pointermove',mv as EventListener);window.removeEventListener('pointerup',up);};
  },[brushDragging]);

  const tools=[{key:'food',label:'🐟',sub:'drag to feed',angle:-100,dist:72},{key:'brush',label:'🪮',sub:brushNear?'brush! ↔':'drag to groom',angle:-155,dist:72}];
  return(
    <>
      <style>{`@keyframes fanIn{0%{opacity:0;transform:scale(.3)}100%{opacity:1;transform:scale(1)}}.fan-item{animation:fanIn .22s cubic-bezier(.34,1.56,.64,1) forwards}`}</style>
      <button onClick={()=>setOpen(o=>!o)} style={{position:'fixed',left:ANCHOR_X-22,bottom:ANCHOR_Y_OFFSET-22,zIndex:76,width:44,height:44,borderRadius:'50%',background:open?'linear-gradient(135deg,#ec4899,#a855f7)':'rgba(0,0,0,.55)',border:'1.5px solid rgba(255,255,255,.15)',boxShadow:open?'0 0 18px rgba(168,85,247,.55)':'0 2px 8px rgba(0,0,0,.4)',cursor:'pointer',fontSize:20,transition:'all .2s',userSelect:'none',display:'flex',alignItems:'center',justifyContent:'center',transform:open?'rotate(45deg)':'rotate(0deg)'}}>🐾</button>
      {open&&tools.map((t,i)=>{
        const rad=t.angle*Math.PI/180,tx=ANCHOR_X+Math.cos(rad)*t.dist,ty=anchorY+Math.sin(rad)*t.dist;
        const isF=t.key==='food',isB=t.key==='brush',isDrag=isF?foodDragging:brushDragging,cur=isF?foodPos:brushPos,glow=isB&&brushNear;
        const dx=cur?cur.x:tx-22,dy=cur?cur.y:ty-22;
        if(isF&&eaten)return null;
        return(
          <div key={t.key} className={cur?'':'fan-item'} style={{animationDelay:`${i*.055}s`,position:'fixed',left:dx,top:dy,zIndex:78,cursor:isDrag?'grabbing':'grab',userSelect:'none',touchAction:'none',transition:cur?'none':'filter .15s',filter:glow?'drop-shadow(0 0 12px rgba(192,132,252,.95))':isDrag?'drop-shadow(0 4px 14px rgba(168,85,247,.6))':'drop-shadow(0 2px 6px rgba(0,0,0,.5))'}}
            onPointerDown={e=>{
              e.preventDefault();
              if(isF){foodOff.current={x:e.clientX-(cur?cur.x:tx-22),y:e.clientY-(cur?cur.y:ty-22)};setFoodDragging(true);setFoodPos({x:e.clientX-foodOff.current.x,y:e.clientY-foodOff.current.y});}
              else{brushLastX.current=e.clientX;brushDist.current=0;brushOff.current={x:e.clientX-(cur?cur.x:tx-22),y:e.clientY-(cur?cur.y:ty-22)};setBrushDragging(true);setBrushPos({x:e.clientX-brushOff.current.x,y:e.clientY-brushOff.current.y});}
            }}>
            <div style={{background:glow?'rgba(168,85,247,.25)':'rgba(0,0,0,.6)',border:`1.5px solid ${glow?'rgba(216,180,254,.6)':'rgba(255,255,255,.12)'}`,borderRadius:14,padding:'6px 10px',display:'flex',flexDirection:'column',alignItems:'center',gap:2,backdropFilter:'blur(8px)',minWidth:52}}>
              <span style={{fontSize:22,lineHeight:1}}>{t.label}</span>
              <span style={{fontSize:9,color:glow?'rgba(216,180,254,.95)':'rgba(255,255,255,.38)',whiteSpace:'nowrap'}}>{t.sub}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}
