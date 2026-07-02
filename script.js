/* ============================================================
   Anurag Jha — portfolio interactions · glass edition
   - Three.js background: shining iridescent cube + glitter field
   - glowing circular cursor
   - GSAP hero sequence + scroll reveals
   - experience pipeline lighting
   ============================================================ */
(function(){
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine    = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ============================================================
     3D SCENE — the signature piece.
     A slowly tumbling metallic cube caged in two glowing
     wireframe shells, drifting through a field of glitter.
     ============================================================ */
  (function scene3d(){
    const canvas = document.getElementById('bg3d');
    if(!canvas || typeof THREE === 'undefined') return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 9);

    /* --- lights: three colored points give the "shine" as the cube turns --- */
    scene.add(new THREE.AmbientLight(0x1b2340, 1.1));
    const lCyan   = new THREE.PointLight(0x6ee7ff, 1.6, 60); lCyan.position.set(6, 5, 7);
    const lViolet = new THREE.PointLight(0xa78bfa, 1.4, 60); lViolet.position.set(-7, -4, 5);
    const lGold   = new THREE.PointLight(0xffd07a, 0.8, 50); lGold.position.set(0, 7, -4);
    scene.add(lCyan, lViolet, lGold);

    /* --- cube group --- */
    const cube = new THREE.Group();

    const core = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshStandardMaterial({
        color: 0x131c38,
        metalness: 0.9,
        roughness: 0.16,
        transparent: true,
        opacity: 0.95
      })
    );
    cube.add(core);

    // inner glowing edges hugging the core
    const edgeInner = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.46, 2.46, 2.46)),
      new THREE.LineBasicMaterial({ color: 0x6ee7ff, transparent: true, opacity: 0.85 })
    );
    cube.add(edgeInner);

    // outer glass cage, cyan
    const cageA = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(3.6, 3.6, 3.6)),
      new THREE.LineBasicMaterial({ color: 0x6ee7ff, transparent: true, opacity: 0.35 })
    );
    // second cage, violet, counter-rotating
    const cageB = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(4.8, 4.8, 4.8)),
      new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.18 })
    );
    cube.add(cageA, cageB);
    scene.add(cube);

    /* --- glitter: three point clouds twinkling out of phase --- */
    function makeGlitter(count, color, size, rMin, rMax){
      const pos = new Float32Array(count * 3);
      for(let i = 0; i < count; i++){
        // random point in a spherical shell so sparkles surround the scene
        const r = rMin + Math.random() * (rMax - rMin);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
        pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta) * 0.7; // squash vertically
        pos[i*3+2] = r * Math.cos(phi) * 0.6 - 2;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color, size,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });
      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      return pts;
    }
    const isSmall  = window.innerWidth < 700;
    const glitterA = makeGlitter(isSmall ? 140 : 260, 0xffffff, 0.05, 5, 16);
    const glitterB = makeGlitter(isSmall ?  90 : 170, 0x6ee7ff, 0.06, 4, 14);
    const glitterC = makeGlitter(isSmall ?  60 : 110, 0xffd07a, 0.05, 6, 15);

    /* --- layout: keep the cube off to the side on wide screens --- */
    let baseY = 0.2;
    function layout(){
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if(w < 700){ baseY = 1.2; cube.position.set(0, baseY, -2); cube.scale.setScalar(0.72); }
      else if(w < 1100){ baseY = 0.3; cube.position.set(1.6, baseY, -1); cube.scale.setScalar(0.85); }
      else { baseY = 0.2; cube.position.set(2.7, baseY, 0); cube.scale.setScalar(1); }
    }
    layout();
    let rzt;
    window.addEventListener('resize', ()=>{ clearTimeout(rzt); rzt = setTimeout(layout, 120); });

    /* --- interaction state --- */
    let mx = 0, my = 0;           // normalized mouse
    if(fine){
      window.addEventListener('mousemove', e=>{
        mx = (e.clientX / window.innerWidth)  * 2 - 1;
        my = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive:true });
    }

    if(reduced){
      // one calm static frame — no continuous motion
      cube.rotation.set(0.5, 0.7, 0.1);
      cageA.rotation.set(0.2, -0.4, 0.3);
      cageB.rotation.set(-0.3, 0.5, -0.2);
      renderer.render(scene, camera);
      return;
    }

    /* --- animation loop --- */
    const clock = new THREE.Clock();
    let paused = false;
    document.addEventListener('visibilitychange', ()=>{ paused = document.hidden; });

    function frame(){
      requestAnimationFrame(frame);
      if(paused) return;
      const t = clock.getElapsedTime();
      const scroll = window.scrollY || 0;

      // continuous tumble + a touch of scroll-driven spin
      cube.rotation.x = t * 0.22 + scroll * 0.0006;
      cube.rotation.y = t * 0.3  + scroll * 0.0009;
      cube.position.y += (baseY + Math.sin(t * 0.7) * 0.25 - cube.position.y) * 0.05;

      cageA.rotation.x = -t * 0.14; cageA.rotation.z = t * 0.1;
      cageB.rotation.y = -t * 0.1;  cageB.rotation.x = t * 0.07;

      // orbiting gold light = moving specular highlight, the "shine"
      lGold.position.x = Math.sin(t * 0.6) * 7;
      lGold.position.z = Math.cos(t * 0.6) * 7;

      // twinkle — clouds pulse out of phase and drift slowly
      glitterA.material.opacity = 0.45 + 0.35 * Math.sin(t * 1.7);
      glitterB.material.opacity = 0.4  + 0.4  * Math.sin(t * 2.3 + 2);
      glitterC.material.opacity = 0.35 + 0.4  * Math.sin(t * 1.3 + 4);
      glitterA.rotation.y = t * 0.015;
      glitterB.rotation.y = -t * 0.02;
      glitterC.rotation.x = t * 0.01;

      // gentle camera parallax toward the mouse
      camera.position.x += (mx * 0.6 - camera.position.x) * 0.04;
      camera.position.y += (-my * 0.4 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
    frame();
  })();

  /* ---------- Glowing cursor ---------- */
  if(fine && !reduced){
    const ring = document.getElementById('ring');
    const dot  = document.getElementById('dot');
    const xRing = gsap.quickTo(ring,'x',{duration:.45,ease:'power3'});
    const yRing = gsap.quickTo(ring,'y',{duration:.45,ease:'power3'});
    const xDot  = gsap.quickTo(dot,'x',{duration:.12,ease:'power3'});
    const yDot  = gsap.quickTo(dot,'y',{duration:.12,ease:'power3'});
    let hidden=true;
    const show=()=>{ if(!hidden) return; hidden=false; ring.classList.remove('is-hidden'); dot.classList.remove('is-hidden'); };
    const hide=()=>{ hidden=true; ring.classList.add('is-hidden'); dot.classList.add('is-hidden'); };
    ring.classList.add('is-hidden'); dot.classList.add('is-hidden');
    window.addEventListener('mousemove',e=>{
      show();
      xRing(e.clientX); yRing(e.clientY); xDot(e.clientX); yDot(e.clientY);
    });
    document.addEventListener('mouseenter',show);
    document.addEventListener('mouseleave',hide);
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

  /* ---------- Top scroll progress bar ---------- */
  const progress=document.getElementById('scrollProgress');
  if(progress){
    const setProgress=()=>{
      const h=document.documentElement;
      const max=(h.scrollHeight - h.clientHeight) || 1;
      progress.style.width=(Math.min(h.scrollTop/max,1)*100)+'%';
    };
    window.addEventListener('scroll',setProgress,{passive:true});
    setProgress();
  }

  /* ---------- Animated count-up on the metric readout ---------- */
  function countUp(el){
    const to=parseFloat(el.dataset.to||'0');
    if(reduced){ el.textContent=to; return; }
    const dur=1400, t0=performance.now();
    const tick=now=>{
      const p=Math.min((now-t0)/dur,1);
      const eased=1-Math.pow(1-p,3);
      el.textContent=Math.round(to*eased);
      if(p<1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const nums=document.querySelectorAll('.readout .num');
  if(reduced){
    nums.forEach(countUp);
    document.querySelectorAll('.skill-card').forEach(c=>c.classList.add('lit'));
    const tb=document.getElementById('termBody');
    if(tb){
      tb.innerHTML=[
        ['pfx','$ terraform apply -auto-approve'],
        ['ok','Apply complete. 14 added, 0 changed.'],
        ['pfx','$ kubectl rollout status deploy/api'],
        ['ok','deployment "api" successfully rolled out'],
        ['dim','[aiops] anomaly score 0.12 — nominal'],
        ['ok','[aiops] resolved in 8s. no page sent.'],
      ].map(([c,t])=>`<span class="ln ${c}">${t.replace(/</g,'&lt;')}</span>`).join('');
    }
    return; // no motion beyond this point
  }

  ScrollTrigger.create({ trigger:'#readout', start:'top 85%', once:true,
    onEnter:()=>nums.forEach(countUp) });

  /* ---------- Hero load sequence ---------- */
  const tl=gsap.timeline({defaults:{ease:'power3.out'}});
  tl.set('h1 .reveal-line > span',{yPercent:110})
    .from('#eyebrow',{opacity:0,y:14,duration:.6})
    .to('h1 .reveal-line > span',{yPercent:0,duration:1,ease:'power4.out'},'-=.3')
    .from('#tag',{opacity:0,y:20,duration:.8},'-=.55')
    .from('#sub',{opacity:0,y:20,duration:.8},'-=.6')
    .from('#heroCta .btn',{opacity:0,y:16,duration:.5,stagger:.08},'-=.5')
    .from('.terminal',{opacity:0,y:30,duration:.9,clearProps:'transform,opacity'},'-=.7')
    .from('#readout',{opacity:0,y:24,duration:.7},'-=.5')
    .from('nav .nav-inner',{opacity:0,y:-12,duration:.6},'-=.9');

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

  /* ---------- Skill card cursor-follow glow + level-bar reveal ---------- */
  document.querySelectorAll('.skill-card').forEach(card=>{
    card.addEventListener('mousemove',e=>{
      const r=card.getBoundingClientRect();
      card.style.setProperty('--mx',((e.clientX-r.left)/r.width*100)+'%');
      card.style.setProperty('--my',((e.clientY-r.top)/r.height*100)+'%');
    });
    ScrollTrigger.create({ trigger:card, start:'top 80%', once:true,
      onEnter:()=>card.classList.add('lit') });
  });

  /* ---------- Hero terminal: typed deploy log ---------- */
  const termBody=document.getElementById('termBody');
  if(termBody){
    const lines=[
      {t:'$ terraform apply -auto-approve', c:'pfx'},
      {t:'  aws_vpc.main: creating...', c:'dim'},
      {t:'  aws_ecs_service.api: 3 tasks healthy', c:'ok'},
      {t:'Apply complete. 14 added, 0 changed.', c:'ok'},
      {t:'$ kubectl rollout status deploy/api', c:'pfx'},
      {t:'  deployment "api" successfully rolled out', c:'ok'},
      {t:'[aiops] anomaly score 0.12 — nominal', c:'dim'},
      {t:'[aiops] latency spike detected → auto-scaling', c:'warn'},
      {t:'[aiops] resolved in 8s. no page sent.', c:'ok'},
      {t:'$ _', c:'pfx'},
    ];
    const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const cursorEl='<span class="term-cursor"></span>';
    let li=0, ci=0, started=false;
    function render(){
      let out='';
      for(let i=0;i<li;i++) out+=`<span class="ln ${lines[i].c}">${esc(lines[i].t)}</span>`;
      if(li<lines.length){
        out+=`<span class="ln ${lines[li].c}">${esc(lines[li].t.slice(0,ci))}${cursorEl}</span>`;
      }
      termBody.innerHTML=out;
    }
    function type(){
      if(li>=lines.length){
        setTimeout(()=>{ li=0; ci=0; type(); }, 4200);   // loop
        return;
      }
      const line=lines[li];
      if(ci<line.t.length){ ci++; render(); setTimeout(type, 18+Math.random()*26); }
      else { li++; ci=0; render(); setTimeout(type, line.c==='pfx'?420:260); }
    }
    function start(){ if(started) return; started=true; type(); }
    ScrollTrigger.create({ trigger:'.hero', start:'top 80%', once:true, onEnter:start });
    setTimeout(start, 1100);
  }
})();