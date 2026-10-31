(()=>{
 const F=window.__fb;
 const {sleep,clean,vtext,waitFor,canon,groupPath,profilePath,TIME,SPON,ACT,trunc,scrollerOf,num}=F;
 const main=()=>document.querySelector('[role=main]');
 const tab=s=>String(s==null?'':s).replace(/[\t\r\n]+/g,' ');
 const abs=h=>{try{const u=new URL(h,location.href);return u.pathname+u.search}catch(e){return h}};
 // canonical path; keeps the query only where it identifies the target (profile.php?id=, permalink.php?story_fbid=&id=, photo?fbid=)
 const stripQ=h=>{const c=canon(h);return c.includes('?')?c:(c.replace(/\/$/,'')||'/');};
 // scroll the page until `collect()` yields n rows or growth stalls
 const gather=async(n,collect,ms=25000,sc=null)=>{
  const t0=Date.now();let last=0,stall=0;const map=new Map();
  while(Date.now()-t0<ms){
   for(const r of collect())if(!map.has(r.k))map.set(r.k,r);
   if(map.size>=n)break;
   if(map.size===last){if(++stall>=14)break;}else{stall=0;last=map.size;}
   const el=typeof sc==='function'?sc():sc;
   if(el)el.scrollTop+=el.clientHeight*0.8;else window.scrollBy(0,innerHeight*0.8);
   await sleep(220);
  }
  return [...map.values()].slice(0,n);
 };
 F.search=async(n)=>{
  const feed=await waitFor(()=>document.querySelector('[role=main] [role=feed] [role=article]')&&document.querySelector('[role=main] [role=feed]'),12000);
  if(!feed){const m=main();return {rows:[],note:m&&/không tìm thấy|no results|aucun résultat/i.test(m.innerText)?'no results':'no results loaded'};}
  const rows=await gather(n,()=>[...feed.querySelectorAll('[role=article]')].filter(a=>F.visible(a)).map(a=>{
   const links=[...a.querySelectorAll('a[href]')];
   const l=links.find(x=>/\/posts\/|pfbid|\/permalink|\/videos\/|\/reel\/|fbid=/.test(x.getAttribute('href')))||links[0];
   if(!l)return null;
   const all=vtext(a);
   const img=l.querySelector('img');
   const name=all[0]||clean((img&&img.alt)||'');
   const btn=new Set([...a.querySelectorAll('[role=button]')].map(b=>clean(b.innerText)));
   const info=all.slice(1).filter(c=>c!==name&&!btn.has(c)&&c!=='·');
   const url=stripQ(l.href);
   return {k:url,v:[name,{r:'u',v:url},trunc(info.join(' · '),160)]};
  }).filter(Boolean));
  return {rows:rows.map(r=>r.v)};
 };
 // people search narrowed by the page's own Friends filter chip; when the
 // chip is not offered, fall back to plain people results and say so
 F.searchFriends=async(n)=>{
  const chip=await waitFor(()=>[...document.querySelectorAll('[role=main] [role=button],[role=main] [role=switch],[role=main] [role=checkbox]')].find(b=>/^(Friends|Bạn bè|Amis)$/i.test(clean(b.innerText||b.getAttribute('aria-label')||''))),10000);
  let note;
  if(chip){chip.click();await sleep(1800);}else note='friends filter not offered by facebook here; showing all people';
  const r=await F.search(n);
  if(note&&!r.err)r.note=r.note?r.note+'; '+note:note;
  return r;
 };
 // marketplace search: listing cards link to /marketplace/item/<id>; the
 // card text is title, price and location in no guaranteed order, so the
 // price is the chunk that looks like money
 F.marketSearch=async(n)=>{
  const ok=await waitFor(()=>document.querySelector('[role=main] a[href*="/marketplace/item/"]'),12000);
  if(!ok)return {rows:[],note:'no listings loaded'};
  await sleep(500);
  const rows=await gather(n,()=>{
   const byPath=new Map();
   for(const a of document.querySelectorAll('[role=main] a[href*="/marketplace/item/"]')){
    const p=stripQ(a.getAttribute('href'));
    const chunks=vtext(a).map(clean).filter(Boolean);
    if(!chunks.length)continue;
    const price=chunks.find(c=>/^[$€£¥]|^(Free|Miễn phí)$/i.test(c))||'';
    const rest=chunks.filter(c=>c!==price);
    if(!byPath.has(p))byPath.set(p,{title:rest[0]||'',price,loc:rest.slice(1).join(' · ')});
   }
   return [...byPath.entries()].map(([p,g])=>({k:p,v:[g.title,{r:'u',v:p},trunc([g.price,g.loc].filter(Boolean).join(' · '),120)]}));
  });
  return {rows:rows.map(r=>r.v)};
 };
 F.friends=async(n)=>{
  const ok=await waitFor(()=>document.querySelector('[role=main] a[href*="friends_mutual"]')||document.querySelector('[role=main] [role=tablist]'),12000);
  if(!ok)return {rows:[],note:'no friends visible'};
  await sleep(600);
  const rows=await gather(n,()=>{
   const out=[];
   for(const m of document.querySelectorAll('[role=main] a[href*="friends_mutual"]')){
    const base=stripQ(m.href.replace(/\/friends_mutual.*/,''));
    const link=[...document.querySelectorAll('[role=main] a[href]')].find(a=>a!==m&&clean(a.innerText)&&stripQ(a.href)===base);
    if(!link)continue;
    out.push({k:base,v:[clean(link.innerText),{r:'u',v:base},clean(m.innerText)]});
   }
   return out;
  });
  return {rows:rows.map(r=>r.v)};
 };
 F.groups=async(n)=>{
  const ok=await waitFor(()=>document.querySelector('[role=main] a[href*="/groups/"]'),12000);
  if(!ok)return {rows:[],note:'no groups visible'};
  await sleep(600);
  const rows=await gather(n,()=>{
   const byPath=new Map();
   for(const a of document.querySelectorAll('[role=main] a[href]')){
    const p=groupPath(a.getAttribute('href'));if(!p)continue;
    const chunks=vtext(a).map(clean).filter(Boolean);
    if(!chunks.length)continue;
    const cur=byPath.get(p)||{name:chunks[0],info:[]};
    for(const c of chunks.slice(1))if(c!==cur.name&&!cur.info.includes(c))cur.info.push(c);
    byPath.set(p,cur);
   }
   return [...byPath.entries()].map(([p,g])=>({k:p,v:[g.name,p,trunc(g.info.join(' · '),120)]}));
  });
  return {rows:rows.map(r=>r.v)};
 };
 F.groupMembers=async(n)=>{
  const ok=await waitFor(()=>document.querySelector('[role=main] a[href]'),12000);
  if(!ok)return {rows:[],note:'no members visible'};
  await sleep(600);
  const rows=await gather(n,()=>{
   const byPath=new Map();
   for(const a of document.querySelectorAll('[role=main] a[href]')){
    const p=profilePath(a.getAttribute('href'));if(!p)continue;
    const nm=clean(a.innerText||'');if(!nm||nm.length>80)continue;
    const block=a.closest('[role=listitem]')||a.closest('[role=article]')||(a.parentElement&&a.parentElement.parentElement);
    const chunks=(block?vtext(block):[nm]).map(clean).filter(Boolean);
    const cur=byPath.get(p)||{name:nm,info:[]};
    for(const c of chunks)if(c!==nm&&c!==cur.name&&!cur.info.includes(c)&&!/^(Add friend|Message|Follow|Friends|See all)$/i.test(c))cur.info.push(c);
    byPath.set(p,cur);
   }
   return [...byPath.entries()].map(([p,m])=>({k:p,v:[m.name,{r:'u',v:p},trunc(m.info.join(' · '),120)]}));
  });
  return {rows:rows.map(r=>r.v)};
 };
 F.notifs=async(n)=>{
  const ok=await waitFor(()=>document.querySelector('[role=main] [role=list] [role=listitem] a[href]')||document.querySelector('[role=list] [role=listitem] a[href]'),12000);
  if(!ok)return {rows:[],note:'no notifications'};
  await sleep(500);
  const sc=document;
  const rows=await gather(n,()=>[...document.querySelectorAll('[role=list] [role=listitem]')].map(li=>{
   const a=li.querySelector('a[href]');if(!a)return null;
   const unread=!![...a.querySelectorAll('[role=button]')].length;
   const ch=vtext(a);
   const ti=ch.findIndex(c=>TIME.test(c));
   const time=ti>=0?ch[ti]:'';
   const body=ch.filter((c,i)=>i!==ti&&!/^(Chưa đọc|Unread|Non lu)$/i.test(c)).join(' ').replace(/ ([:,.!?])/g,'$1');
   const h=abs(a.href);
   return {k:h+body,v:[time,unread?'!':'-',trunc(body,140),{r:'p',v:h}]};
  }).filter(Boolean));
  return {rows:rows.map(r=>r.v)};
 };
 F.profile=async(n)=>{
  const m=await waitFor(()=>{const m=main();return m&&m.querySelector('[role=tablist]')&&m},15000);
  if(!m)return {err:'profile not found / not accessible'};
  await sleep(700);
  const lines=[];
  const big=[...m.querySelectorAll('h1,h2,span,div')].filter(e=>e.children.length<=3&&/\S/.test(e.innerText||'')&&e.innerText.length<70&&parseFloat(getComputedStyle(e).fontSize)>=26).sort((a,b)=>parseFloat(getComputedStyle(b).fontSize)-parseFloat(getComputedStyle(a).fontSize))[0];
  const name=clean(big?big.innerText:document.title.replace(/^\(\d+\)\s*/,'').replace(/\s*\|.*$/,''));
  lines.push('name\t'+tab(name));
  lines.push('url\t'+stripQ(location.href));
  const fr=[...m.querySelectorAll('a[href*="friends"]')].find(a=>/\d/.test(a.innerText));
  if(fr)lines.push('friends\t'+tab(clean(fr.innerText)));
  const fo=[...m.querySelectorAll('a[href*="followers"],a[href*="following"]')].filter(a=>/\d/.test(a.innerText)).map(a=>clean(a.innerText));
  if(fo.length)lines.push('follow\t'+tab(fo.join(' / ')));
  for(const l of m.querySelectorAll('[role=list]')){
   if(l.closest('[role=tablist]')||l.closest('[role=feed]'))continue;
   const items=[...l.children].map(c=>clean(vtext(c).join(' '))).filter(Boolean);
   if(!items.length||items.length>12)continue;
   const lab=l.getAttribute('aria-label')||'';
   lines.push(tab(lab?trunc(lab,24):'info')+'\t'+tab(items.join(' | ')));
  }
  const tl=m.querySelector('[role=tablist]');
  const btns=[...m.querySelectorAll('[role=button]')].filter(b=>!b.closest('[role=tablist],[role=feed],[role=list]')&&tl&&(tl.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_PRECEDING)&&/\S/.test(b.innerText)&&b.innerText.length<22&&!b.querySelector('img')&&clean(b.innerText)!==name&&!/\d/.test(b.innerText)).map(b=>clean(b.innerText));
  const bio=[...m.querySelectorAll('[data-pagelet*=ProfileTilesFeed],[data-pagelet*=Intro]')].map(e=>clean(vtext(e).join(' | '))).filter(Boolean);
  if(bio.length)lines.push('intro\t'+tab(trunc(bio[0],400)));
  lines.push('actions\t'+tab([...new Set(btns)].slice(0,12).join(' | ')));
  return {lines};
 };
 F.postView=async(n)=>{
  const find=()=>{for(const d of document.querySelectorAll('[role=dialog]'))if(d.querySelector('[data-ad-rendering-role=profile_name]'))return d;const m=main();return m&&m.querySelector('[data-ad-rendering-role=profile_name]')&&m;};
  const root=await waitFor(find,15000);
  if(!root)return {err:'post not found'};
  await sleep(800);
  const g=r=>root.querySelector('[data-ad-rendering-role='+r+']');
    const ch=vtext(g('profile_name').parentElement.parentElement.parentElement);
  const ti=ch.findIndex((c,i)=>i<12&&TIME.test(c));
  const head=ch.slice(0,ti<0?1:ti).filter(c=>c!=='·');
  const msg=g('story_message');
  const lines=[];
  lines.push('by\t'+tab(head.join(' / '))+(ti>=0?'\t'+tab(ch[ti]):''));
  lines.push('stats\t'+num(g('like_button'))+'/'+num(g('comment_button'))+'/'+num(g('share_button'))+'\t(react/comment/share)');
  if(msg)lines.push('text\t'+tab(F.postText(msg).replace(/\n/g,' ⏎ ')));
  const media=[...root.querySelectorAll('a[href*="/photo"] img,a[href*="/photo"],video')].length;
  if(media)lines.push('media\t'+media);
  const scEl=()=>{const a=root.querySelector('[role=article][aria-label]');return (a&&scrollerOf(a))||scrollerOf(root)||null;};
  const com=await gather(n,()=>[...root.querySelectorAll('[role=article][aria-label]')].map(a=>{
   const c=vtext(a).filter(x=>x!=='·');
   const ti=c.findIndex((x,i)=>i<6&&TIME.test(x));
   const end=c.findIndex((x,i)=>i>(ti<0?0:ti)&&ACT.test(x));
   const body=c.slice(ti<0?1:ti+1,end<0?c.length:end).filter(x=>!/^(của tác giả|Author|Auteur|Top fan|Người hâm mộ.*)$/i.test(x)).join(' ');
   const lab=a.getAttribute('aria-label')||'';
   const nested=!!a.parentElement.closest('[role=article][aria-label]');
   const ref=[...a.querySelectorAll('a[href]')].map(x=>profilePath(x.getAttribute('href'))).find(Boolean)||'';
   return {k:lab+body,ref,v:[(nested?'  ↳':'')+c[0],ti>=0?c[ti]:'',trunc(body,300)]};
  }),20000,scEl);
  for(const c of com){if(c.ref)lines.push('cu\t'+tab(c.ref));lines.push('c\t'+c.v.map(tab).join('\t'));}
  return {lines};
 };
})();
