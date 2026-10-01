/* ============================================================
   Anurag Jha portfolio. Monochrome stage edition.
   - Two procedural 3D bots (Three.js), animated with GSAP
   - Hero intro, idle life, cursor look-at, scroll exit
   - Scroll reveals, metric count-up, horizontal project pan
   ============================================================ */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger.js";
import { SplitText } from "gsap/SplitText.js";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildRobot, blackPalette, chromePalette } from "./robot.js";
import { initCursor } from "./cursor.js";

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer  = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ============================================================
   STAGE: renderer + environment + rim lights
   ============================================================ */
function createStage(canvas, { fov = 30, z = 10, envIntensity = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = envIntensity;
  pmrem.dispose();

  // strong white light from behind gives the reference's halo-lit silhouette
  const rimA = new THREE.DirectionalLight(0xffffff, 5);
  rimA.position.set(-3, 4, -6);
  const rimB = new THREE.DirectionalLight(0xffffff, 2.4);
  rimB.position.set(4, 1, -5);
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(2, 2, 7);
  scene.add(rimA, rimB, key);

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(0, 0, z);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return true;
  };
  return { renderer, scene, camera, resize, render: () => renderer.render(scene, camera) };
}

/* ============================================================
   HERO BOT
   Layer stack, outermost first, so tweens never fight:
   stageG (responsive layout) > scrollG (scroll exit) >
   introG (load-in) > floatG (idle bob + body sway) > model
   ============================================================ */
const heroCanvas = document.getElementById("heroBot");
const nowCanvas  = document.getElementById("nowBot");
let hero = null, card = null;

try {
  const stage = createStage(heroCanvas, { envIntensity: 0.5 });
  const bot = buildRobot(blackPalette());

  const stageG = new THREE.Group(), scrollG = new THREE.Group(), introG = new THREE.Group(), floatG = new THREE.Group();
  stageG.add(scrollG); scrollG.add(introG); introG.add(floatG); floatG.add(bot.model);
  bot.model.rotation.y = -0.7;            // three-quarter profile, facing left like the reference
  stage.scene.add(stageG);

  const layout = () => {
    if (!stage.resize()) return;
    const mobile = heroCanvas.clientWidth < 900;
    const s = mobile ? Math.min(0.9, stage.camera.aspect * 1.45) : 1;
    stageG.scale.setScalar(s);
    stageG.position.y = mobile ? -1.05 : -1.95;
  };
  layout();
  // a soft light the cursor carries across the robot's glossy shell
  const cursorLight = new THREE.PointLight(0xffffff, 0, 14, 1.6);
  cursorLight.position.set(0, 0, 3.5);
  stage.scene.add(cursorLight);

  hero = { ...stage, bot, stageG, scrollG, introG, floatG, layout, cursorLight };
} catch (err) {
  console.warn("WebGL unavailable, hero bot skipped.", err);
}

/* ---- card bot: a chrome sibling, only on wide screens ---- */
if (hero && window.matchMedia("(min-width: 1101px)").matches) {
  try {
    const stage = createStage(nowCanvas, { fov: 30, z: 9.4 });
    const bot = buildRobot(chromePalette());
    const spin = new THREE.Group();
    spin.add(bot.model);
    bot.model.position.y = -0.3;
    bot.model.rotation.y = 0.5;
    stage.scene.add(spin);
    stage.resize();
    card = { ...stage, bot, spin };
  } catch (err) {
    console.warn("Card bot skipped.", err);
  }
}

/* ---- ambient cursor; it also steers the light over the hero bot ---- */
if (hero) {
  const lx = gsap.quickTo(hero.cursorLight.position, "x", { duration: 0.9, ease: "power3" });
  const ly = gsap.quickTo(hero.cursorLight.position, "y", { duration: 0.9, ease: "power3" });
  let lit = false;
  initCursor({
    onMove: (nx, ny) => {
      const halfH = Math.tan(THREE.MathUtils.degToRad(hero.camera.fov / 2)) * (hero.camera.position.z - 3.5);
      lx((nx * 2 - 1) * halfH * hero.camera.aspect);
      ly(-(ny * 2 - 1) * halfH);
      if (!lit) { lit = true; gsap.to(hero.cursorLight, { intensity: 9, duration: 1.2 }); }
    },
  });
} else {
  initCursor();
}

/* ---- render only while the hero is on screen ---- */
let heroVisible = true;
const renderBots = () => {
  if (!heroVisible) return;
  hero && hero.render();
  card && card.render();
};

if (hero) {
  ScrollTrigger.create({
    trigger: ".hero", start: "top bottom", end: "bottom top",
    onToggle: (self) => { heroVisible = self.isActive; },
  });
  let rz;
  window.addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(() => { hero.layout(); card && card.resize(); renderBots(); }, 120);
  });
}

/* ============================================================
   MOTION
   ============================================================ */
const title = new SplitText("#heroTitle", { type: "chars", mask: "chars" });
gsap.set([".hero-orbit", ".hero-halo"], { x: 0, y: 0, xPercent: -50, yPercent: -50 });
gsap.set("#nowCard", { y: 0, yPercent: -30 });

/* nav background after leaving the top (state, not motion, so it runs either way) */
ScrollTrigger.create({ start: 40, end: "max", toggleClass: { targets: "#nav", className: "is-scrolled" } });

if (reduceMotion) {
  // static, fully composed frame. No loops, no scrub, no pan.
  hero && hero.bot.ledMats.forEach((m) => (m.opacity = 0.8));
  renderBots();
  window.addEventListener("resize", () => setTimeout(renderBots, 160));
  document.querySelectorAll(".metric .num").forEach((n) => (n.textContent = n.dataset.to));
} else {
  initMotion();
}

function initMotion() {
  if (hero || card) gsap.ticker.add(renderBots);

  /* ---------- hero load-in: the bot powers on ---------- */
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  tl.from(".nav", { y: -24, opacity: 0, duration: 0.8 }, 0)
    .from(".hero-halo", { scale: 0.5, opacity: 0, duration: 2, ease: "expo.out" }, 0)
    .from(title.chars, { yPercent: 110, duration: 1.1, stagger: 0.045, ease: "expo.out" }, 0.15)
    .from(".hero-orbit", { scale: 0.82, rotate: -40, opacity: 0, duration: 2, ease: "expo.out" }, 0.3);

  if (hero) {
    const { introG, bot } = hero;
    tl.from(introG.position, { y: -4.5, duration: 2.2, ease: "expo.out" }, 0.2)
      .from(introG.rotation, { y: -1.1, duration: 2.6, ease: "expo.out" }, 0.2)
      // eye flickers on like a cold boot
      .fromTo(bot.eyeMat, { opacity: 0 }, {
        keyframes: [{ opacity: 0.9, duration: 0.06 }, { opacity: 0.1, duration: 0.1 }, { opacity: 1, duration: 0.08 }, { opacity: 0.3, duration: 0.06 }, { opacity: 1, duration: 0.3 }],
        ease: "none",
      }, 1.3)
      .fromTo(bot.ledMats, { opacity: 0 }, { opacity: 1, duration: 0.2, stagger: 0.06 }, 1.5);
  }
  if (card) tl.from(card.spin.position, { y: -3, duration: 1.6, ease: "expo.out" }, 1);

  tl.from("#heroSub", { y: 24, opacity: 0, duration: 0.9 }, 1.1)
    .from("#heroCta", { y: 18, opacity: 0, duration: 0.8 }, 1.25)
    .from("#nowCard", { x: 60, opacity: 0, duration: 1.1, ease: "expo.out" }, 1.1)
    .add(startIdle);

  /* ---------- idle life, started once the bot has landed ---------- */
  function startIdle() {
    gsap.to(".hero-orbit", { rotate: "+=360", duration: 140, repeat: -1, ease: "none" });
    if (!hero) return;
    const { floatG, bot } = hero;

    gsap.to(floatG.position, { y: 0.08, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut" });

    // blink: a quick double dip on the eye light every few seconds
    gsap.timeline({ repeat: -1, repeatDelay: 4.2 })
      .to(bot.eyeMat, { opacity: 0.12, duration: 0.07, ease: "none" })
      .to(bot.eyeMat, { opacity: 1, duration: 0.14, ease: "none" })
      .to(bot.eyeMat, { opacity: 0.12, duration: 0.07, ease: "none" }, "+=0.12")
      .to(bot.eyeMat, { opacity: 1, duration: 0.18, ease: "none" });

    // ear vents turn slowly, like a cooling fan idling
    gsap.to(bot.spinners.map((v) => v.rotation), { x: "+=" + Math.PI * 2, duration: 14, repeat: -1, ease: "none" });

    // ear lights chase in sequence
    gsap.to(bot.ledMats, { opacity: 0.15, duration: 0.7, ease: "sine.inOut", stagger: { each: 0.12, repeat: -1, yoyo: true } });

    if (card) {
      gsap.to(card.spin.rotation, { y: -1.1, duration: 6, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(card.bot.headPivot.rotation, { y: 0.4, x: 0.08, duration: 3.4, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(card.bot.ledMats, { opacity: 0.2, duration: 0.6, stagger: { each: 0.1, repeat: -1, yoyo: true } });
    }

    // head follows the cursor; the body sways a little behind it
    if (finePointer) {
      const headY = gsap.quickTo(bot.headPivot.rotation, "y", { duration: 1.1, ease: "power3" });
      const headX = gsap.quickTo(bot.headPivot.rotation, "x", { duration: 1.1, ease: "power3" });
      const bodyY = gsap.quickTo(floatG.rotation, "y", { duration: 1.8, ease: "power3" });
      window.addEventListener("pointermove", (e) => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        headY(nx * 0.45);
        headX(ny * 0.16);
        bodyY(nx * 0.1);
      }, { passive: true });
    }
  }

  /* ---------- hero exit: the bot turns to face you and sinks ---------- */
  const exit = gsap.timeline({
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 },
  });
  exit.to("#heroTitle", { yPercent: -70, opacity: 0, ease: "none" }, 0)
      .to(".hero-orbit", { scale: 1.25, opacity: 0, ease: "none" }, 0)
      .to(".hero-copy", { y: -60, opacity: 0, ease: "none" }, 0)
      .to("#nowCard", { x: 80, opacity: 0, ease: "none" }, 0);
  if (hero) {
    exit.to(hero.scrollG.rotation, { y: 0.75, ease: "none" }, 0)
        .to(hero.scrollG.position, { y: -1.4, ease: "none" }, 0);
  }

  /* ---------- marquee: one seamless loop ---------- */
  const marquee = document.getElementById("marquee");
  marquee.innerHTML += marquee.innerHTML;
  marquee.querySelectorAll("span").forEach((s, i, all) => { if (i >= all.length / 2) s.setAttribute("aria-hidden", "true"); });
  gsap.to(marquee, { xPercent: -50, duration: 38, repeat: -1, ease: "none" });

  /* ---------- about: the statement lights up as you read it ---------- */
  const lead = new SplitText("#aboutLead", { type: "words", wordsClass: "w" });
  gsap.fromTo(lead.words, { opacity: 0.16 }, {
    opacity: 1, stagger: 0.06, ease: "none",
    scrollTrigger: { trigger: "#aboutLead", start: "top 80%", end: "bottom 50%", scrub: true },
  });
  gsap.from(".facts > div", {
    y: 20, opacity: 0, duration: 0.8, stagger: 0.08, ease: "power3.out",
    scrollTrigger: { trigger: ".facts", start: "top 85%" },
  });

  /* ---------- metrics count up once ---------- */
  ScrollTrigger.create({
    trigger: "#metrics", start: "top 85%", once: true,
    onEnter: () => document.querySelectorAll(".metric .num").forEach((el, i) => {
      const o = { v: 0 };
      gsap.to(o, { v: +el.dataset.to, duration: 1.6, delay: i * 0.1, ease: "power3.out", snap: { v: 1 },
        onUpdate: () => (el.textContent = o.v) });
    }),
  });

  /* ---------- section titles + bento ---------- */
  gsap.utils.toArray(".sec-title").forEach((h) => {
    gsap.from(h, { y: 40, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: h, start: "top 88%" } });
  });
  ScrollTrigger.batch(".cell", {
    start: "top 90%", once: true,
    onEnter: (els) => gsap.from(els, { y: 50, opacity: 0, duration: 1, stagger: 0.08, ease: "expo.out" }),
  });

  /* ---------- experience: progress line tracks the roles ---------- */
  gsap.to("#workFill", {
    scaleY: 1, ease: "none",
    scrollTrigger: { trigger: ".roles", start: "top 60%", end: "bottom 60%", scrub: true },
  });
  gsap.utils.toArray(".role").forEach((r) => {
    gsap.from(r, { y: 40, opacity: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: r, start: "top 85%" } });
  });

  /* ---------- projects: vertical scroll pans the track sideways (desktop) ---------- */
  const mm = gsap.matchMedia();
  mm.add("(min-width: 901px)", () => {
    const track = document.getElementById("projTrack");
    const section = document.querySelector(".projects");
    section.classList.add("is-pan");
    const distance = () => track.scrollWidth - window.innerWidth;
    gsap.to(track, {
      x: () => -distance(), ease: "none",
      scrollTrigger: {
        trigger: ".projects", start: "top top", end: () => `+=${distance()}`,
        pin: true, scrub: 1, invalidateOnRefresh: true,
      },
    });
    return () => section.classList.remove("is-pan");
  });
  mm.add("(max-width: 900px)", () => {
    gsap.utils.toArray(".proj").forEach((p) => {
      gsap.from(p, { y: 40, opacity: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: p, start: "top 88%" } });
    });
  });

  /* ---------- contact ---------- */
  const ct = new SplitText("#contactTitle", { type: "words", mask: "words" });
  gsap.from(ct.words, {
    yPercent: 110, duration: 1, stagger: 0.05, ease: "expo.out",
    scrollTrigger: { trigger: "#contactTitle", start: "top 85%" },
  });

  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
}
