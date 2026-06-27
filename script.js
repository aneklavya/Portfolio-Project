/* ============================================================
   Anurag Jha — portfolio interactions
   - glowing circular cursor
   - GSAP hero sequence + scroll reveals
   - experience pipeline lighting
   - site-wide scroll spline (growing curve)
   ============================================================ */
(function(){
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine    = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ---------- Glowing cursor ---------- */
  if(fine && !reduced){
    const ring = document.getElementById('ring');
    const dot  = document.getElementById('dot');
    const xRing = gsap.quickTo(ring,'x',{duration:.45,ease:'power3'});
    const yRing = gsap.quickTo(ring,'y',{duration:.45,ease:'power3'});
    const xDot  = gsap.quickTo(dot,'x',{duration:.12,ease:'power3'});
    const yDot  = gsap.quickTo(dot,'y',{duration:.12,ease:'power3'});
    let entered=false;
    window.addEventListener('mousemove',e=>{
      if(!entered){ entered=true; ring.classList.remove('is-hidden'); dot.classList.remove('is-hidden'); }
      xRing(e.clientX); yRing(e.clientY); xDot(e.clientX); yDot(e.clientY);
    });
    document.addEventListener('mouseleave',()=>{ ring.classList.add('is-hidden'); dot.classList.add('is-hidden'); });
    document.querySelectorAll('a, button, [data-cursor]').forEach(el=>{
      el.addEventListener('mouseenter',()=>ring.classList.add('is-active'));
      el.addEventListener('mouseleave',()=>ring.classList.remove('is-active'));
    });
  } else {
    const r=document.getElementById('ring'), d=document.getElementById('dot');
    if(r) r.style.display='none';
    if(d) d.style.display='none';
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Nav scrolled state ---------- */
  const nav=document.getElementById('nav');
  ScrollTrigger.create({ start:'top -20', onUpdate:self=>{ nav.classList.toggle('scrolled', self.scroll()>20); }});

  /* ============================================================
     Site-wide scroll spline
     A smooth Catmull-Rom curve spanning the full document height.
     The drawn portion + glowing head track scroll progress.
     ============================================================ */
  const svg  = document.getElementById('scrollSpline');
  const track= document.getElementById('splineTrack');
  const draw = document.getElementById('splineDraw');
  const head = document.getElementById('splineHead');
  const halo = document.getElementById('splineHalo');
  let drawLen = 0;

  // Convert a set of points into a smooth path using Catmull-Rom -> cubic Bézier
  function smoothPath(pts){
    if(pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for(let i=0; i<pts.length-1; i++){
      const p0 = pts[i-1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i+1];
      const p3 = pts[i+2] || p2;
      const c1x = p1.x + (p2.x - p0.x)/6;
      const c1y = p1.y + (p2.y - p0.y)/6;
      const c2x = p2.x - (p3.x - p1.x)/6;
      const c2y = p2.y - (p3.y - p1.y)/6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  function buildSpline(){
    if(!svg || !track || !draw) return;
    const W = svg.clientWidth || 80;
    const H = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.height = H + 'px';

    const baseX = W * 0.45;          // resting x inside the gutter
    const amp   = W * 0.32;          // sideways swing of the curve
    const wave  = 460;               // vertical wavelength in px
    const step  = 70;                // sampling resolution
    const pts = [];
    for(let y=0; y<=H; y+=step){
      pts.push({ x: baseX + amp * Math.sin(y / wave * Math.PI * 2), y });
    }
    if(pts[pts.length-1].y < H) pts.push({ x: baseX + amp * Math.sin(H / wave * Math.PI * 2), y: H });

    const d = smoothPath(pts);
    track.setAttribute('d', d);
    draw.setAttribute('d', d);

    drawLen = draw.getTotalLength();
    draw.style.strokeDasharray = drawLen;
    draw.style.strokeDashoffset = reduced ? 0 : drawLen;

    if(reduced){
      const end = draw.getPointAtLength(drawLen);
      placeHead(end);
    }
  }

  function placeHead(pt){
    if(head){ head.setAttribute('cx', pt.x); head.setAttribute('cy', pt.y); }
    if(halo){ halo.setAttribute('cx', pt.x); halo.setAttribute('cy', pt.y); }
  }

  function updateSpline(progress){
    if(!draw || !drawLen) return;
    const p = Math.min(Math.max(progress, 0), 1);
    draw.style.strokeDashoffset = drawLen * (1 - p);
    const pt = draw.getPointAtLength(drawLen * p);
    placeHead(pt);
  }

  if(svg){
    buildSpline();
    if(!reduced){
      ScrollTrigger.create({
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.5,
        onUpdate: self => updateSpline(self.progress)
      });
      // rebuild on resize / layout change so the curve always spans the page
      let rt;
      window.addEventListener('resize', ()=>{ clearTimeout(rt); rt=setTimeout(()=>{ buildSpline(); ScrollTrigger.refresh(); }, 200); });
      ScrollTrigger.addEventListener('refreshInit', buildSpline);
    }
  }

  if(reduced) return;

  /* ---------- Hero load sequence ---------- */
  const tl=gsap.timeline({defaults:{ease:'power3.out'}});
  tl.set('h1 .reveal-line > span',{yPercent:110})
    .from('#eyebrow',{opacity:0,y:14,duration:.6})
    .to('h1 .reveal-line > span',{yPercent:0,duration:1,ease:'power4.out'},'-=.3')
    .from('#tag',{opacity:0,y:20,duration:.8},'-=.55')
    .from('#sub',{opacity:0,y:20,duration:.8},'-=.6')
    .from('#readout .cell',{opacity:0,y:24,duration:.6,stagger:.08},'-=.5')
    .from('nav .nav-inner',{opacity:0,y:-12,duration:.6},'-=.9');

  /* telemetry line draw */
  const tele=document.getElementById('telePath');
  if(tele){
    const len=tele.getTotalLength();
    gsap.set(tele,{strokeDasharray:len,strokeDashoffset:len});
    gsap.to(tele,{strokeDashoffset:0,duration:2.4,ease:'power2.inOut',delay:.4});
  }

  /* ---------- Section heads ---------- */
  gsap.utils.toArray('.sec-head').forEach(headEl=>{
    gsap.from(headEl.children,{opacity:0,y:18,duration:.7,stagger:.08,ease:'power3.out',
      scrollTrigger:{trigger:headEl,start:'top 85%'}});
    const rule=headEl.querySelector('.reveal-rule');
    if(rule){ gsap.from(rule,{scaleX:0,duration:1,ease:'power3.out',
      scrollTrigger:{trigger:headEl,start:'top 85%'}}); }
  });

  /* ---------- Generic reveals ---------- */
  gsap.utils.toArray('.reveal').forEach(el=>{
    gsap.to(el,{opacity:1,y:0,duration:.8,ease:'power3.out',
      scrollTrigger:{trigger:el,start:'top 88%'}});
  });

  /* ---------- Pipeline fill + node lighting ---------- */
  const pipeline=document.getElementById('pipeline');
  const fill=document.getElementById('plFill');
  if(pipeline && fill){
    gsap.to(fill,{ height:'100%', ease:'none',
      scrollTrigger:{ trigger:pipeline, start:'top 60%', end:'bottom 75%', scrub:.6 }});
    gsap.utils.toArray('.stage').forEach(stage=>{
      ScrollTrigger.create({ trigger:stage, start:'top 70%',
        onEnter:()=>stage.classList.add('lit'),
        onLeaveBack:()=>stage.classList.remove('lit') });
    });
  }

  /* ---------- Skill card cursor-follow glow ---------- */
  document.querySelectorAll('.skill-card').forEach(card=>{
    card.addEventListener('mousemove',e=>{
      const r=card.getBoundingClientRect();
      card.style.setProperty('--mx',((e.clientX-r.left)/r.width*100)+'%');
      card.style.setProperty('--my',((e.clientY-r.top)/r.height*100)+'%');
    });
  });
})();
