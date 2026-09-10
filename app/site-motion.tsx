'use client';

import {useEffect} from 'react';

const entrances = [
  '.site-shell .page-heading', '.site-shell .arena-navigation>a',
  '.site-shell .main>.armory-toolbar', '.site-shell .main>.progress-hero',
  '.site-shell .main>.profile-banner', '.site-shell .main>.leader-banner',
  '.site-shell .account-panel', '.site-shell .balance-card', '.site-shell .stat-card',
  '.site-shell .mode-card', '.site-shell .feature', '.site-shell .match-panel',
  '.site-shell .duel-browser>.duel-browser-heading', '.site-shell .room-main',
  '.site-shell .quick-duels article', '.site-shell .person-card',
  '.site-shell .challenge-card', '.site-shell .achievement-grid>article',
  '.site-shell .account-table tbody tr', '.site-shell .mode-stat-row',
  '.site-shell .platform-list-row', '.site-shell .conversation-person',
  '.site-shell .activity-chart i', '.site-shell progress',
].join(',');

/** Shared motion for existing and asynchronously loaded page content. */
export default function SiteMotion(){
  useEffect(()=>{
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    let teardown:()=>void=()=>{};
    const setup=()=>{
      teardown();
      if(preference.matches)return;
      document.documentElement.dataset.siteMotion='on';
      const seen=new WeakSet<Element>(),running=new Set<Animation>();
      const animate=(element:Element,frames:Keyframe[],options:KeyframeAnimationOptions)=>{
        const animation=element.animate(frames,options);running.add(animation);
        const done=()=>running.delete(animation);
        animation.addEventListener('finish',done,{once:true});animation.addEventListener('cancel',done,{once:true});
        return animation;
      };
      const reveal=new IntersectionObserver(entries=>{
        const visible=entries.filter(entry=>entry.isIntersecting);
        visible.forEach(({target},index)=>{
          reveal.unobserve(target);
          const chart=target.matches('progress,.activity-chart i');
          const row=target.matches('tr,.room-main,.platform-list-row,.conversation-person');
          if(chart){
            animate(target,[{clipPath:target.tagName==='PROGRESS'?'inset(0 100% 0 0)':'inset(100% 0 0 0)'},{clipPath:'inset(0 0 0 0)'}],{duration:850,delay:Math.min(index,5)*55,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'});
          }else{
            animate(target,[{opacity:0,transform:`translate${row?'X':'Y'}(${row?'14':'22'}px)`},{opacity:1,transform:'translate(0,0)'}],{duration:row?460:640,delay:Math.min(index,5)*55,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'});
          }
        });
      },{threshold:.08});
      const watch=(root:Element)=>{
        const targets=[...(root.matches(entrances)?[root]:[]),...root.querySelectorAll(entrances)];
        targets.forEach(target=>{if(!seen.has(target)){seen.add(target);target.setAttribute('data-motion-enter','');reveal.observe(target);}});
      };
      watch(document.body);
      const changes=new MutationObserver(records=>{
        for(const record of records){
          if(record.type==='childList'){
            record.addedNodes.forEach(node=>{if(node instanceof Element)watch(node);});
            record.removedNodes.forEach(node=>{if(node instanceof Element){reveal.unobserve(node);node.querySelectorAll('[data-motion-enter]').forEach(child=>reveal.unobserve(child));}});
          }else if(record.target instanceof Element&&record.target.matches('.site-shell [role=tab][aria-selected=true],.site-shell button[aria-pressed=true]')){
            animate(record.target,[{boxShadow:'0 0 0 0 #ff98596b'},{boxShadow:'0 0 0 8px #ff985900'}],{duration:450,easing:'ease-out'});
            if(record.target.matches('.armory-toolbar button')){
              document.querySelectorAll('.cosmetic-grid').forEach(grid=>animate(grid,[{opacity:.4,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,easing:'cubic-bezier(.16,1,.3,1)'}));
            }
            if(record.target.matches('.mode-card,.opponent-tabs button')){
              document.querySelectorAll('.feature-copy,.match-panel').forEach(panel=>animate(panel,[{opacity:.35,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,easing:'cubic-bezier(.16,1,.3,1)'}));
            }
          }
        }
      });
      changes.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-selected','aria-pressed']});
      const press=(event:PointerEvent)=>{
        if(!(event.target instanceof Element))return;
        const button=event.target.closest('.site-shell button:not(:disabled),.site-shell a.primary,.sc-dialog button:not(:disabled)');
        if(!button)return;
        const bounds=button.getBoundingClientRect(),ripple=document.createElement('span');
        ripple.className='site-click-ripple';ripple.setAttribute('aria-hidden','true');
        const size=Math.min(90,Math.max(bounds.width,bounds.height));
        Object.assign(ripple.style,{width:`${size}px`,height:`${size}px`,left:`${event.clientX-size/2}px`,top:`${event.clientY-size/2}px`});
        document.body.appendChild(ripple);
        const pulse=animate(ripple,[{opacity:.24,transform:'scale(.1)'},{opacity:0,transform:'scale(1)'}],{duration:440,easing:'ease-out'});
        pulse.addEventListener('finish',()=>ripple.remove(),{once:true});pulse.addEventListener('cancel',()=>ripple.remove(),{once:true});
      };
      document.addEventListener('pointerdown',press,{passive:true});
      teardown=()=>{
        changes.disconnect();reveal.disconnect();running.forEach(animation=>animation.cancel());running.clear();
        document.removeEventListener('pointerdown',press);delete document.documentElement.dataset.siteMotion;
        document.querySelectorAll('.site-click-ripple').forEach(element=>element.remove());
      };
    };
    setup();preference.addEventListener('change',setup);
    return()=>{preference.removeEventListener('change',setup);teardown();};
  },[]);
  return null;
}
