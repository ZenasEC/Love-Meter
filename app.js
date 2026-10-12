/* ==========================================================================
   LOVE METER — behaviour
   1 utils        2 love score     3 drifting hearts  4 cursor dot
   5 music        6 cover          7 the heart        8 ledger
   9 letter      10 prints        11 tickets + fortune 12 reveal + spy
   ========================================================================== */
(() => {
  "use strict";

  /* ---------------------------------------------------------------- 1 utils */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } },
    set(k, v)  { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  };
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE_POINTER = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let booted = false; // flipped at the very end, so the rAF loop can trust the heart refs

  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  /* ----------------------------------------------------------- 2 love score */
  /* Deterministic AND symmetric: names are normalised and sorted before
     hashing, so "Alex + Sam" always equals "Sam + Alex". Fixed contract —
     changing it changes every couple's existing result. */
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const normalize = (s) =>
    s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

  /* Curated verdicts — a short list of pairs whose number is fixed by hand
     rather than left to the hash. Keys are the two normalised names, sorted
     and joined with "+", so they stay symmetric like everything else. */
  const CURATED = new Map([
    ["kimkim+maria", 99],   // Kim Kim & Maria
    ["cole+yanto",   86],   // Yanto & Cole
    ["chloe+yanto",  86],   // Yanto & Chloe
    ["jovita+zenas", 16],   // Zenas & Jovita
    ["ficia+keven",  62],   // Keven & Ficia
  ]);

  function loveScore(a, b) {
    const [x, y] = [normalize(a), normalize(b)].sort();
    const key = `${x}+${y}`;
    if (CURATED.has(key)) return CURATED.get(key);
    const rnd = mulberry32(xmur3(key)());
    return clamp(Math.round(((rnd() + rnd()) / 2) * 100), 1, 100);
  }

  const BREAK_AT = 30; // below this the heart breaks
  const TIERS = [
    { max: 29,  key: "the heart cracked", stamp: false,
      msg: "Even the meter flinched. A cracked heart is still a heart that worked — those are usually the ones worth keeping." },
    { max: 49,  key: "a small spark", stamp: false,
      msg: "A small spark, still deciding whether to catch. Give it somewhere warm to land." },
    { max: 69,  key: "a steady flame", stamp: false,
      msg: "A steady, unglamorous flame. The kind that actually keeps a house warm." },
    { max: 89,  key: "good timing", stamp: false,
      msg: "Two people whose timing, mostly, works. That is far rarer than it sounds." },
    { max: 100, key: "soulmates", stamp: true,
      msg: "The arithmetic gives up here and simply says: soulmates. Go be insufferable together." },
  ];
  const tierFor = (s) => TIERS.find((t) => s <= t.max);

  /* ------------------------------------------------- 3 background hearts */
  const canvas = $("#drift");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;
  const drift = [];
  let specks = [];

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = canvas.width = innerWidth * DPR;
    H = canvas.height = innerHeight * DPR;
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
  }
  addEventListener("resize", resize);
  resize();

  function heartPath(c, s) {
    c.beginPath();
    c.moveTo(0, s * 0.92);
    c.bezierCurveTo(-s * 1.15, s * 0.06, -s * 0.64, -s * 0.92, 0, -s * 0.3);
    c.bezierCurveTo(s * 0.64, -s * 0.92, s * 1.15, s * 0.06, 0, s * 0.92);
    c.closePath();
  }
  function newHeart(anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 60 * DPR,
      s: (10 + Math.random() * 22) * DPR,
      vy: (0.22 + Math.random() * 0.45) * DPR,
      sway: Math.random() * Math.PI * 2,
      alpha: 0.06 + Math.random() * 0.08,
      rot: (Math.random() - 0.5) * 0.5,
      col: Math.random() < 0.75 ? "200, 57, 92" : "176, 42, 76",
    };
  }
  for (let i = 0; i < 11; i++) drift.push(newHeart(true));

  function spraySpecks(x, y, n, rgb = "200, 57, 92") {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = (1.5 + Math.random() * 6) * DPR;
      specks.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 2.5 * DPR,
        r: (1 + Math.random() * 2.6) * DPR,
        life: 0, max: 70 + Math.random() * 70, col: rgb,
      });
    }
  }

  function loop(now) {
    ctx.clearRect(0, 0, W, H);

    if (booted) beatFrame(now);

    if (!REDUCED && drift.length < 18 && Math.random() < 0.022) drift.push(newHeart(false));
    if (REDUCED && drift.length > 4) drift.length = 4;

    ctx.lineWidth = 1.4 * DPR;
    drift.forEach((h) => {
      h.sway += 0.006;
      h.y -= h.vy;
      h.x += Math.sin(h.sway) * 0.4 * DPR;
      if (h.y < -70 * DPR) { h.y = H + 40 * DPR; h.x = Math.random() * W; }
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot + Math.sin(h.sway) * 0.07);
      ctx.globalAlpha = h.alpha;
      ctx.strokeStyle = `rgb(${h.col})`;
      heartPath(ctx, h.s);
      ctx.stroke();
      ctx.restore();
    });

    for (let i = specks.length - 1; i >= 0; i--) {
      const p = specks[i];
      p.life++;
      p.x += p.vx; p.y += p.vy; p.vy += 0.14 * DPR;
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max) * 0.55;
      ctx.fillStyle = `rgb(${p.col})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      if (p.life >= p.max) specks.splice(i, 1);
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* --------------------------------------------------------- 4 cursor dot */
  if (FINE_POINTER && !REDUCED) {
    let last = 0;
    addEventListener("mousemove", (e) => {
      const now = performance.now();
      if (now - last < 110) return;
      last = now;
      const d = document.createElement("span");
      d.className = "trail";
      d.style.left = e.clientX - 3 + "px";
      d.style.top = e.clientY - 3 + "px";
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 860);
    }, { passive: true });
  }

  /* ------------------------------------------------------------- 5 music */
  /* The one shipped track is our own generated, royalty-free music-box waltz
     (see tools/make_cupid_loop.py). If it can't load we fall back to the
     synthesized WebAudio waltz below, so the page always has its tune. */
  const audio = $("#cupid");
  // Primary: whatever the <audio> element points at (assets/cupid-loop.wav).
  // If that fails, the synthesized WebAudio waltz below takes over.
  const SOURCES = [audio.getAttribute("src")].filter(Boolean);
  let sourceIdx = 0;
  const soundBtn = $("#soundBtn");
  const soundVol = $("#soundVol");
  const volume = $("#volume");
  let usingFallback = false;

  const savedVol = store.get("lm:vol", 0.55);
  audio.volume = savedVol;
  volume.value = savedVol;
  volume.addEventListener("input", () => {
    store.set("lm:vol", +volume.value);
    if (usingFallback) FALLBACK.setVolume(+volume.value);
    else audio.volume = +volume.value;
  });

  function setSoundUI(on) {
    soundBtn.setAttribute("aria-pressed", String(on));
    soundBtn.textContent = on ? "waltz — on" : "waltz — off";
  }
  function useFallback() {
    usingFallback = true;
    FALLBACK.setVolume(+volume.value);
    FALLBACK.start();
    setSoundUI(true);
  }
  function playMusic() {
    if (usingFallback) { FALLBACK.start(); setSoundUI(true); return; }
    audio.play().then(() => setSoundUI(true)).catch(useFallback);
  }
  function pauseMusic() {
    if (usingFallback) FALLBACK.stop(); else audio.pause();
    setSoundUI(false);
  }
  soundBtn.addEventListener("click", () => {
    (soundBtn.getAttribute("aria-pressed") === "true") ? pauseMusic() : playMusic();
  });
  audio.addEventListener("error", () => {
    sourceIdx++;
    if (sourceIdx < SOURCES.length) {
      audio.src = SOURCES[sourceIdx];
      audio.load();
      if (soundBtn.getAttribute("aria-pressed") === "true") audio.play().catch(useFallback);
    } else {
      useFallback();
    }
  });

  /* Synthesized music-box fallback (same waltz as tools/make_cupid_loop.py). */
  const FALLBACK = (() => {
    let actx = null, master = null, timer = null, playing = false;
    const BEAT = 60 / 108, BAR = 3 * BEAT, LOOP = 16 * BAR;
    const CH = { C: [60, 64, 67, 48], G: [59, 62, 67, 43], Am: [57, 60, 64, 45], F: [57, 60, 65, 41] };
    const PROG = ["C", "G", "Am", "F", "C", "G", "F", "G", "C", "G", "Am", "F", "F", "G", "C", "C"];
    const MEL = [[0,0,76,1.5],[0,1.5,79,1.5],[1,0,74,1],[1,1,76,1],[1,2,74,1],[2,0,72,1.5],[2,1.5,76,1.5],
                 [3,0,69,1],[3,1,72,1],[3,2,77,1],[4,0,76,1],[4,1,79,1],[4,2,84,1],[5,0,74,1.5],[5,1.5,71,1.5],
                 [6,0,69,1],[6,1,72,1],[6,2,69,1],[7,0,71,1],[7,1,74,1],[7,2,79,1],[8,0,76,1.5],[8,1.5,79,1.5],
                 [9,0,74,1],[9,1,71,1],[9,2,74,1],[10,0,72,1.5],[10,1.5,69,1.5],[11,0,69,1],[11,1,72,1],[11,2,77,1],
                 [12,0,69,1],[12,1,77,2],[13,0,71,1],[13,1,79,2],[14,0,76,1],[14,1,84,2],[15,0,79,3]];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

    function voice(t, midi, dur, vol) {
      const g = actx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, 1.4));
      g.connect(master);
      [[1, 1], [2, .45], [3, .22], [4, .1]].forEach(([m, amp]) => {
        const o = actx.createOscillator();
        o.type = "sine";
        o.frequency.value = hz(midi) * m;
        const og = actx.createGain(); og.gain.value = amp;
        o.connect(og).connect(g);
        o.start(t); o.stop(t + Math.max(dur, 1.4) + 0.05);
      });
    }
    function schedule() {
      const t0 = actx.currentTime + 0.08;
      for (let bar = 0; bar < 16; bar++) {
        const tones = CH[PROG[bar]];
        const bt = t0 + bar * BAR;
        voice(bt, tones[3], 2, 0.16);
        voice(bt + BEAT * 1.5, tones[1] + 12, 0.8, 0.05);
        voice(bt + BEAT * 2.5, tones[2] + 12, 0.8, 0.04);
      }
      MEL.forEach(([bar, beat, midi, dur]) => voice(t0 + bar * BAR + beat * BEAT, midi, dur * BEAT, 0.22));
      timer = setTimeout(schedule, LOOP * 1000 - 120);
    }
    return {
      setVolume(v) { if (master) master.gain.value = v * 0.5; },
      start() {
        if (playing) return;
        playing = true;
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        actx.resume();
        master = master || actx.createGain();
        master.gain.value = (+volume.value) * 0.5;
        master.connect(actx.destination);
        schedule();
      },
      stop() { playing = false; clearTimeout(timer); if (actx) actx.suspend(); },
    };
  })();

  /* ------------------------------------------------------------- 6 cover */
  const cover = $("#cover");
  const heartEl = $("#heart");
  const heartSvg = heartEl.querySelector(".heart__svg");

  // the cover shows a smaller copy of the same heart
  const coverHeart = $("[data-cover-heart]");
  if (coverHeart && heartSvg) coverHeart.appendChild(heartSvg.cloneNode(true));

  // a rose blush behind everything
  const blush = document.createElement("div");
  blush.className = "blush";
  blush.setAttribute("aria-hidden", "true");
  document.body.prepend(blush);

  function openCover(withMusic) {
    cover.classList.add("is-open");
    document.body.classList.remove("is-locked");
    soundVol.hidden = false;
    if (withMusic) playMusic();
  }
  $("#enterBtn").addEventListener("click", () => openCover(true));
  $("#skipBtn").addEventListener("click", () => openCover(false));

  /* -------------------------------------------------------- 7 the heart */
  const form = $("#loveForm");
  const nameA = $("#nameA");
  const nameB = $("#nameB");
  const formError = $("#formError");
  const result = $("#result");
  const meterBar = $("#meterBar");
  const meterFill = $("#meterFill");
  const scoreNum = $("#scoreNum");
  const scoreMsg = $("#scoreMsg");
  const pairLabel = $("#pairLabel");
  const heartCaption = $("#heartCaption");
  const stamp = $("#stamp");
  const shareBtn = $("#shareBtn");

  nameA.value = store.get("lm:a", "");
  nameB.value = store.get("lm:b", "");

  /* -------------------------------------------------------- 7 the heart *
   * One clock drives everything that has to land on the thump: the beat's
   * scale, the glow flash, the two pulse rings and the sparks. (CSS
   * animations and rAF both pause in a background tab, so a single rAF
   * timeline keeps these in step instead of four drifting ones.) */
  const glowEl = heartEl.querySelector(".heart__glow");
  const echoEls = $$(".heart__echo", heartEl);

  const IDLE = { period: 1900, amp: .07, heat: .32 };   // resting heartbeat
  const LUB = .10;                                       // where the strong thump sits in the cycle
  const beat = { start: performance.now(), period: IDLE.period, amp: IDLE.amp, heat: IDLE.heat, broken: false, hit: -1 };

  /** one hit: quick rise into the peak, slower decay, wrapping around the cycle */
  function spike(p, c, rise, fall) {
    let d = p - c;
    d = ((d + .5) % 1 + 1) % 1 - .5;
    if (d < -rise || d > fall) return 0;
    return d < 0 ? Math.cos((-d / rise) * (Math.PI / 2)) : Math.exp(-3.2 * (d / fall));
  }
  const envelope = (p) => Math.min(1, spike(p, LUB, .05, .15) + spike(p, .30, .04, .11) * .55);

  function beatFrame(now = performance.now()) {
    if (beat.broken || REDUCED) return;
    const p = (((now - beat.start) % beat.period) + beat.period) % beat.period / beat.period;
    const e = envelope(p);

    heartSvg.style.transform = `scale(${(1 + beat.amp * e).toFixed(4)})`;
    glowEl.style.opacity = (e * (.35 + beat.heat * .5)).toFixed(3);
    glowEl.style.transform = `scale(${(1 + e * .14).toFixed(3)})`;

    // two rings, the second trailing the first
    for (let i = 0; i < echoEls.length; i++) {
      const life = Math.min(((((p - (i ? .28 : LUB)) % 1) + 1) % 1) / .55, 1);
      echoEls[i].style.transform = `scale(${(1 + life * .55).toFixed(3)})`;
      echoEls[i].style.opacity = ((1 - life) * .5 * (.45 + beat.heat * .55)).toFixed(3);
    }

    // a thump just landed → throw sparks
    const hit = Math.floor((now - beat.start - LUB * beat.period) / beat.period);
    if (hit > beat.hit) {
      beat.hit = hit;
      sparkBurst(2 + Math.round(beat.heat * 7));
    }
  }

  /** a handful of tiny hearts flung outwards from behind the heart */
  function sparkBurst(n) {
    const w = heartEl.clientWidth || 240;
    const c = w / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = w * (.20 + Math.random() * .12);
      const dist = w * (.16 + Math.random() * .34);
      const el = document.createElement("span");
      el.className = "spark";
      el.setAttribute("aria-hidden", "true");
      el.style.left = (c + Math.cos(a) * r0).toFixed(1) + "px";
      el.style.top = (c + Math.sin(a) * r0).toFixed(1) + "px";
      el.style.setProperty("--tx", (Math.cos(a) * dist).toFixed(1) + "px");
      el.style.setProperty("--ty", (Math.sin(a) * dist).toFixed(1) + "px");
      el.style.setProperty("--sc", (.55 + Math.random() * .9).toFixed(2));
      if (i % 3 === 0) el.style.background = "var(--rose-soft)";
      heartEl.appendChild(el);
      setTimeout(() => el.remove(), 860);
    }
  }

  /** restart the clock at a given tempo / strength */
  function armBeat(period, amp, heat) {
    beat.period = period;
    beat.amp = amp;
    beat.heat = heat;
    beat.broken = false;
    beat.start = performance.now();
    beat.hit = -1;
    heartEl.style.setProperty("--heat", heat.toFixed(2));
    if (REDUCED) { // no motion: leave the heart still, lit only by its heat
      heartSvg.style.transform = "";
      glowEl.style.opacity = "0";
      echoEls.forEach((el) => (el.style.opacity = "0"));
    }
  }

  /** Beat faster the higher the score; stop entirely when the heart breaks. */
  function setHeart(score) {
    heartEl.classList.remove("is-broken");
    heartEl.classList.add("is-read");
    result.classList.add("is-live");

    if (score < BREAK_AT) {
      heartEl.classList.add("is-broken");
      meterBar.classList.add("is-broken");
      beat.broken = true;
      beat.heat = .12;
      heartEl.style.setProperty("--heat", ".12");
      heartSvg.style.transform = "translateY(6px) rotate(-2deg)";
      glowEl.style.opacity = "0";
      echoEls.forEach((el) => (el.style.opacity = "0"));
      return;
    }
    meterBar.classList.remove("is-broken");

    const t = clamp((score - BREAK_AT) / (100 - BREAK_AT), 0, 1); // 0..1
    armBeat(
      1150 - t * 720, // 1.15s → 0.43s per beat
      .09 + t * .11,  // a harder thump as it gets hotter
      .25 + t * .75   // and a hotter glow
    );
  }

  function resetHeart() {
    heartEl.classList.remove("is-read", "is-broken");
    meterBar.classList.remove("is-broken");
    armBeat(IDLE.period, IDLE.amp, IDLE.heat);
    heartSvg.style.transform = "";
    meterFill.style.width = "0%";
    scoreNum.textContent = "0";
    result.classList.remove("is-live");
    stamp.classList.remove("show");
    heartCaption.textContent = "0 – 100, kept honest";
  }

  function showError(msg, field) {
    formError.textContent = msg;
    formError.hidden = false;
    if (field) field.focus();
  }

  function countUp(el, to, dur = 1900) {
    const t0 = performance.now();
    const tick = (now) => {
      const p = clamp((now - t0) / dur, 0, 1);
      el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * to);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const a = nameA.value.trim();
    const b = nameB.value.trim();
    formError.hidden = true;

    if (!a || !b) {
      showError("Two names, please — both fields need something in them.", !a ? nameA : nameB);
      return;
    }
    store.set("lm:a", a);
    store.set("lm:b", b);

    const score = loveScore(a, b);
    const tier = tierFor(score);

    logReading(a, b, score);

    pairLabel.textContent = `${a} & ${b}`;
    scoreMsg.textContent = tier.msg;
    heartCaption.textContent = tier.key;
    meterBar.setAttribute("aria-valuenow", String(score));
    scoreNum.textContent = "0";

    // dial the heart in, then run the meter up to it
    setHeart(score);

    meterFill.style.transition = "none";
    meterFill.style.width = "0%";
    void meterFill.offsetWidth;
    meterFill.style.transition = "";
    requestAnimationFrame(() => {
      meterFill.style.width = score + "%";
      countUp(scoreNum, score);
    });

    stamp.classList.remove("show");
    if (tier.stamp && !REDUCED) {
      void stamp.offsetWidth;
      setTimeout(() => stamp.classList.add("show"), 1000);
      setTimeout(() => {
        const r = heartEl.getBoundingClientRect();
        spraySpecks(r.left + r.width / 2, r.top + r.height * 0.45, 80, "200, 57, 92");
      }, 1200);
    }
    if (score < BREAK_AT && !REDUCED) {
      const r = heartEl.getBoundingClientRect();
      setTimeout(() => spraySpecks(r.left + r.width / 2, r.top + r.height * 0.6, 46, "150, 144, 138"), 350);
    }

    heartEl.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
  });

  $("#retryBtn").addEventListener("click", () => {
    nameA.value = ""; nameB.value = "";
    store.set("lm:a", ""); store.set("lm:b", "");
    formError.hidden = true;
    resetHeart();
    nameA.focus();
    heartEl.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
  });

  shareBtn.addEventListener("click", async () => {
    const a = nameA.value.trim(), b = nameB.value.trim();
    if (!a || !b) return;
    const s = loveScore(a, b);
    const text = `${a} + ${b} = ${s}% — read on the Love Meter`;
    try {
      if (navigator.share) { await navigator.share({ title: "Love Meter", text, url: location.href }); return; }
      await navigator.clipboard.writeText(text);
      toast("Copied to the clipboard.");
    } catch {
      toast("Couldn't copy — your browser blocked it.");
    }
  });

  /* ------------------------------------------------------------ 8 ledger */
  const startDate = $("#startDate");
  const clock = $("#clock");
  const ledgerEmpty = $("#ledgerEmpty");
  const nextAnniv = $("#nextAnniv");
  startDate.value = store.get("lm:start", "");

  function updateLedger() {
    if (!startDate.value) { clock.hidden = true; ledgerEmpty.hidden = false; return; }
    const start = new Date(startDate.value + "T00:00:00");
    if (isNaN(start)) return;

    clock.hidden = false;
    ledgerEmpty.hidden = true;

    const total = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
    $("#dDays").textContent  = Math.floor(total / 86400).toLocaleString();
    $("#dHours").textContent = String(Math.floor(total % 86400 / 3600)).padStart(2, "0");
    $("#dMins").textContent  = String(Math.floor(total % 3600 / 60)).padStart(2, "0");
    $("#dSecs").textContent  = String(total % 60).padStart(2, "0");

    const now = new Date();
    let next = new Date(now.getFullYear(), start.getMonth(), start.getDate());
    if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next.setFullYear(now.getFullYear() + 1);
    const days = Math.ceil((next - now) / 86400000);
    nextAnniv.hidden = false;
    nextAnniv.textContent = days === 0
      ? "Today is the day. Happy anniversary."
      : `The next anniversary is ${days} day${days === 1 ? "" : "s"} away.`;
  }
  startDate.addEventListener("change", () => { store.set("lm:start", startDate.value); updateLedger(); });
  updateLedger();
  setInterval(updateLedger, 1000);

  /* ------------------------------------------------------------ 9 letter */
  const fromName = $("#fromName");
  const toName = $("#toName");
  const letterOut = $("#letterOut");
  let tone = "sweet";

  fromName.value = store.get("lm:from", "");
  toName.value = store.get("lm:to", "");

  const TEMPLATES = {
    sweet: (f, t) => `My dearest ${t},\n\nFrom the day you arrived, ordinary afternoons started keeping their receipts — the walk home, the second cup of tea, the way you hum without noticing. I have collected all of it.\n\nI don't need grand promises. I need you, exactly as you are, on an ordinary Tuesday.\n\nYours,\n${f}`,
    deep: (f, t) => `Dear ${t},\n\nSome things are too large for words, so forgive me if these lines come up short. You changed the shape of my days — quietly, completely, without ever asking to.\n\nWhen I think of home now, I no longer picture a room. I picture you, mid-sentence, mid-laugh.\n\nWith all of me,\n${f}`,
    funny: (f, t) => `Hey ${t},\n\nThe odds of us finding each other were absurdly small. Statistics is clearly on my side, and I intend to gloat about it for the rest of my life.\n\nYou are the only person I would split my fries with. That is the highest honour I am legally able to bestow.\n\nYours, slightly obsessed,\n${f}`,
    sorry: (f, t) => `My ${t},\n\nI'm sorry. Not the small kind — the kind that sits with me until I put it right.\n\nYou matter more to me than being right, and I would rather lose an argument than lose the way you smile at me after one. Can we start again, together?\n\nI am yours,\n${f}`,
  };

  let typeTimer = null;
  function renderLetter(useTypewriter = true) {
    const f = fromName.value.trim() || "Me";
    const t = toName.value.trim() || "You";
    const text = TEMPLATES[tone](f, t);
    clearTimeout(typeTimer);
    letterOut.classList.remove("is-typing");
    if (!useTypewriter || REDUCED) { letterOut.textContent = text; return; }
    letterOut.textContent = "";
    letterOut.classList.add("is-typing");
    let i = 0;
    const step = () => {
      letterOut.textContent = text.slice(0, ++i);
      if (i < text.length) typeTimer = setTimeout(step, text[i - 1] === "\n" ? 85 : 15);
      else letterOut.classList.remove("is-typing");
    };
    step();
  }
  $$("#toneChips .tab").forEach((tab) => tab.addEventListener("click", () => {
    $$("#toneChips .tab").forEach((t) => t.setAttribute("aria-selected", "false"));
    tab.setAttribute("aria-selected", "true");
    tone = tab.dataset.tone;
    renderLetter(true);
  }));
  [fromName, toName].forEach((el) => el.addEventListener("input", () => {
    store.set("lm:from", fromName.value);
    store.set("lm:to", toName.value);
    renderLetter(true);
  }));
  renderLetter(false);

  $("#copyLetter").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(letterOut.textContent); toast("Letter copied."); }
    catch { toast("Couldn't copy — your browser blocked it."); }
  });
  $("#downloadLetter").addEventListener("click", () => {
    const blob = new Blob([letterOut.textContent], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "love-letter.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ------------------------------------------------------------ 10 prints */
  const photoInput = $("#photoInput");
  const grid = $("#galleryGrid");
  const galleryEmpty = $("#galleryEmpty");
  let photos = store.get("lm:photos", []);

  function savePhotos() {
    if (store.set("lm:photos", photos) === false)
      toast("This browser's storage is full — try smaller photos.");
  }
  function renderGallery() {
    grid.innerHTML = "";
    galleryEmpty.hidden = photos.length > 0;
    photos.forEach((p) => {
      const fig = document.createElement("figure");
      fig.className = "print";
      fig.innerHTML = `
        <button class="del" title="Remove" aria-label="Remove this print">×</button>
        <img src="${p.src}" alt="A memory print" loading="lazy" />
        <figcaption class="cap" contenteditable="true" spellcheck="false">${p.cap || "our moment"}</figcaption>`;
      fig.querySelector(".del").addEventListener("click", () => {
        photos = photos.filter((x) => x.id !== p.id);
        savePhotos(); renderGallery();
      });
      const cap = fig.querySelector(".cap");
      cap.addEventListener("blur", () => { p.cap = cap.textContent.trim().slice(0, 60); savePhotos(); });
      cap.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); cap.blur(); } });
      grid.appendChild(fig);
    });
  }
  photoInput.addEventListener("change", () => {
    const files = [...photoInput.files];
    let pending = files.length;
    if (!pending) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 720;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.width * scale));
          c.height = Math.max(1, Math.round(img.height * scale));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          photos.push({
            id: Date.now() + "-" + Math.random().toString(36).slice(2),
            src: c.toDataURL("image/jpeg", 0.72),
            cap: "",
          });
          if (--pending === 0) { savePhotos(); renderGallery(); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    photoInput.value = "";
  });
  renderGallery();

  /* ------------------------------------------------- 11 tickets + fortune */
  const TICKETS = [
    { title: "Free hug",         sub: "valid forever",           note: "No expiry, no conditions. Just arms, open." },
    { title: "Movie night",      sub: "you choose the film",     note: "Blanket fort optional. Snacks non-negotiable." },
    { title: "Breakfast in bed", sub: "one unhurried morning",   note: "Crumbs in the sheets are included in the deal." },
    { title: "A quiet evening",  sub: "phones face down",        note: "Tea, low light, and nothing that needs answering." },
    { title: "Dessert on me",    sub: "two scoops",              note: "Yes, you may have the last bite. Once." },
    { title: "Chore swap",       sub: "I take your worst one",   note: "A grand romantic gesture, disguised as laundry." },
    { title: "A day out",        sub: "destination: anywhere",   note: "Pack light. Expect to laugh at least twice." },
    { title: "Say it first",     sub: "one honest sentence",     note: "I go first, no hedging, no jokes to hide behind." },
  ];
  const ticketWrap = $("#coupons");
  TICKETS.forEach((t, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "ticket";
    el.setAttribute("aria-expanded", "false");
    el.innerHTML = `
      <span class="ticket__stub">No. ${String(i + 1).padStart(2, "0")}</span>
      <span class="ticket__body">
        <span class="ticket__redeemed">redeemed</span>
        <span class="ticket__title">${t.title}</span>
        <span class="ticket__sub">${t.sub}</span>
      </span>
      <span class="ticket__note">${t.note}</span>`;
    el.addEventListener("click", () => {
      el.setAttribute("aria-expanded", String(el.classList.toggle("is-open")));
    });
    ticketWrap.appendChild(el);
  });

  const NOTES = [
    "You are the reason ordinary days keep feeling like small occasions.",
    "If I could give you one thing, it would be your own eyes for an hour. Then you would know.",
    "I loved you yesterday, I love you today, and I intend to keep being embarrassing about it.",
    "Home stopped being a place some time ago. It is wherever you are mid-sentence.",
    "Thank you for being patient with me on my untidy days.",
    "In a hundred quiet versions of this life, I would still find the seat next to you.",
    "Your happiness is my favourite ongoing project.",
    "You are, and have always been, my favourite hello.",
  ];
  const jarNote = $("#jarNote");
  $("#jarBtn").addEventListener("click", () => {
    jarNote.textContent = NOTES[(Math.random() * NOTES.length) | 0];
    jarNote.classList.remove("pop");
    void jarNote.offsetWidth;
    jarNote.classList.add("pop");
  });

  /* ------------------------------------------------ 12 reveal + scrollspy */
  const hasIO = "IntersectionObserver" in window;
  const revealer = hasIO ? new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); revealer.unobserve(en.target); }
    });
  }, { threshold: 0.12 }) : null;
  $$(".reveal").forEach((el) => (revealer ? revealer.observe(el) : el.classList.add("in")));

  const navLinks = $$(".nav a");
  const byId = new Map(navLinks.map((a) => [a.getAttribute("href").slice(1), a]));
  if (hasIO) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        navLinks.forEach((a) => a.removeAttribute("aria-current"));
        const link = byId.get(en.target.id);
        if (link) link.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-42% 0px -50% 0px" });
    ["meter", "days", "letter", "prints", "keepsakes"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) spy.observe(el);
    });
  }

  if (nameA.value && !nameB.value) nameB.focus();

  /* ---------------------------------------------------------- 13 logbook */
  /* Optional guest log: each reading is POSTed to a Google Apps Script web
     app that appends a row to a private Sheet the host can read. Paste the
     deployed /exec URL below (see tools/log-sheet.gs); leave "" to keep the
     page fully offline. Logging is best-effort and never blocks the meter. */
  const LOG_ENDPOINT = "https://script.google.com/macros/s/AKfycbzo-R7ubW-lY9jXzbX4cGCSorvkmgSI50o4x9k54rLLGQaTXI_1Q8AWZNwYzFsFTZf1/exec";

  function logReading(a, b, score) {
    if (!LOG_ENDPOINT) return;
    try {
      fetch(LOG_ENDPOINT, {
        method: "POST",
        mode: "no-cors", // Apps Script needs a "simple" request; reply is opaque
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ a, b, score }),
        keepalive: true,
      }).catch(() => { /* offline / blocked — ignore */ });
    } catch { /* a log must never break the meter */ }
  }

  // Only claim that readings are logged once an endpoint is actually wired in.
  if (LOG_ENDPOINT) {
    const formNote = $("#formNote");
    const dataNote = $("#dataNote");
    if (formNote) formNote.hidden = false;
    if (dataNote) dataNote.textContent =
      "Names, dates and photos live only in this browser's local storage. The two names you read are also saved to a private sheet so the host can see who has been tested.";
  }

  booted = true;
})();
