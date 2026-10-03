/* ============================================================
   Ambient cursor (fine pointers only, off under reduced motion)
   - dot: exact position, inverts over light surfaces
   - ring: lags behind, swells over interactive elements
   - glow: wide soft light that drifts after the pointer
   - dust: faint particles shed while moving
   - ripple: expanding ring on click
   ============================================================ */
import { gsap } from "gsap";

export function initCursor({ onMove } = {}) {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || reduce) return;

  const make = (cls, tag = "div") => {
    const el = document.createElement(tag);
    el.className = cls;
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    return el;
  };
  const glow = make("cursor-glow");
  const dust = make("cursor-dust", "canvas");
  const ring = make("cursor-ring");
  const dot = make("cursor-dot");
  document.documentElement.classList.add("has-cursor");

  const centre = { xPercent: -50, yPercent: -50 };
  gsap.set([glow, ring, dot], { ...centre, x: -200, y: -200 });

  const dotX = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power3" });
  const dotY = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power3" });
  const ringX = gsap.quickTo(ring, "x", { duration: 0.42, ease: "power3" });
  const ringY = gsap.quickTo(ring, "y", { duration: 0.42, ease: "power3" });
  const glowX = gsap.quickTo(glow, "x", { duration: 1.4, ease: "power2" });
  const glowY = gsap.quickTo(glow, "y", { duration: 1.4, ease: "power2" });

  /* ---------- dust particles ---------- */
  const ctx = dust.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const sizeDust = () => {
    dust.width = innerWidth * dpr;
    dust.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  sizeDust();
  window.addEventListener("resize", sizeDust);

  const motes = [];
  let lx = null, ly = null;
  const spawn = (x, y, speed) => {
    const n = Math.min(3, 1 + Math.floor(speed / 18));
    for (let i = 0; i < n && motes.length < 90; i++) {
      motes.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.15 - Math.random() * 0.35,     // drift upward, like dust in a light beam
        r: 0.6 + Math.random() * 1.3,
        life: 1,
        decay: 0.012 + Math.random() * 0.016,
      });
    }
  };
  gsap.ticker.add(() => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      m.x += m.vx; m.y += m.vy; m.life -= m.decay;
      if (m.life <= 0) { motes.splice(i, 1); continue; }
      ctx.globalAlpha = m.life * 0.55;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fillStyle = "#f2f2f0";
      ctx.fill();
    }
  });

  /* ---------- pointer ---------- */
  let shown = false;
  const show = (on) => {
    if (on === shown) return;
    shown = on;
    gsap.to([dot, ring, glow], { opacity: on ? 1 : 0, duration: 0.3, overwrite: "auto" });
  };

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const { clientX: x, clientY: y } = e;
    show(true);
    dotX(x); dotY(y); ringX(x); ringY(y); glowX(x); glowY(y);
    if (lx !== null) {
      const speed = Math.hypot(x - lx, y - ly);
      if (speed > 2) spawn(x, y, speed);
    }
    lx = x; ly = y;
    onMove && onMove(x / innerWidth, y / innerHeight);
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { show(false); lx = ly = null; });

  /* ---------- hover states ---------- */
  const interactive = "a, button, [role='button'], .cell, .proj";
  const chrome = ".nav, .foot";          // chrome sits behind the text, so the ring must not blur it
  const ringRest = { scale: 1, backgroundColor: "rgba(242,242,240,0)", borderColor: "rgba(242,242,240,0.35)" };
  const clearText = (on) => {
    gsap.to(ring, {
      "--ring-blur": on ? 0 : 1.5,
      "--ring-glare": on ? "0 0 22px rgba(255,255,255,.22)" : "0 0 0 rgba(255,255,255,0)",
      borderColor: on ? "rgba(242,242,240,.85)" : ringRest.borderColor,
      backgroundColor: on ? "rgba(255,255,255,.05)" : ringRest.backgroundColor,
      duration: 0.4, ease: "expo.out", overwrite: "auto",
    });
    gsap.to(glow, {
      "--glow-core": on ? 0.15 : 0.075,
      "--glow-mid": on ? 0.06 : 0.025,
      duration: 0.5, ease: "expo.out", overwrite: "auto",
    });
  };
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest(interactive);
    if (!t) return;
    const big = t.matches(".cell, .proj");
    const inChrome = !!t.closest(chrome);
    gsap.to(ring, {
      scale: inChrome ? 1.6 : big ? 1.6 : 2.1,
      backgroundColor: inChrome ? "rgba(255,255,255,.05)" : "rgba(242,242,240,0.08)",
      borderColor: inChrome ? "rgba(242,242,240,.85)" : "rgba(242,242,240,0.6)",
      duration: 0.4, ease: "expo.out", overwrite: "auto",
    });
    gsap.to(dot, { scale: inChrome ? 0.5 : big ? 1 : 0.4, duration: 0.3 });
    clearText(inChrome);
  });
  document.addEventListener("pointerout", (e) => {
    const t = e.target.closest(interactive);
    if (!t || t.contains(e.relatedTarget)) return;
    gsap.to(ring, { ...ringRest, duration: 0.5, ease: "expo.out", overwrite: "auto" });
    gsap.to(dot, { scale: 1, duration: 0.3 });
    clearText(false);
  });

  /* ---------- click ripple ---------- */
  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    gsap.to(ring, { scale: "-=0.3", duration: 0.12, yoyo: true, repeat: 1 });
    const rip = make("cursor-ripple");
    gsap.set(rip, { ...centre, x: e.clientX, y: e.clientY });
    gsap.fromTo(rip, { scale: 0.2, opacity: 0.7 }, {
      scale: 3.2, opacity: 0, duration: 0.8, ease: "expo.out", onComplete: () => rip.remove(),
    });
    for (let i = 0; i < 10; i++) spawn(e.clientX, e.clientY, 40);
  });
}
