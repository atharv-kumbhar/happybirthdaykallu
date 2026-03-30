"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";

/* ─────────────────────────────────────────
   PALETTE & TOKENS
───────────────────────────────────────── */
// const C = {
//   bg: "#faf8f3",
//   ink: "#2a1a0e",
//   mid: "#8a6a50",
//   ghost: "rgba(138,106,80,0.22)",
//   peach: "#f0b8a8", peachL: "#fde8e0",
//   sage:  "#b8d4a0", sageL:  "#e4f0d8",
//   sky:   "#a8c8e8", skyL:   "#d8ecf8",
//   honey: "#e8cc80", honeyL: "#faf0c0",
//   lav:   "#c8b0e0", lavL:   "#ece4f8",
//   rose:  "#e890a8",
//   sf: "'Cormorant Garamond',Georgia,serif",
//   ss: "'Nunito',sans-serif",
// };

const C = {
  bg: "#fff3f0", // soft blush (main background)
  ink: "#3b1f1a", // warm deep brown text

  mid: "#a6786a", // muted romantic tone
  ghost: "rgba(166,120,106,0.25)",

  peach: "#f2a7a0",
  peachL: "#fde1dd",

  sage: "#c9e3c8",
  sageL: "#eef7ed",

  sky: "#c7d9f6",
  skyL: "#eef4ff",

  honey: "#f6d48f",
  honeyL: "#fff6d6",

  lav: "#d9c6f3",
  lavL: "#f4efff",

  rose: "#f29bb2",

  accent: "#e6a57e", // softer, romantic highlight

  sf: "'Cormorant Garamond', Georgia, serif",
  ss: "'Nunito', sans-serif",
};

const PETALS = [C.peach, C.sage, C.sky, C.honey, C.lav, C.rose];
const rnd = (a, b) => a + Math.random() * (b - a);
const rndItem = (a) => a[Math.floor(Math.random() * a.length)];
let _uid = 0;
const uid = () => ++_uid;

/* ─────────────────────────────────────────
   SPRING PHYSICS HOOK
───────────────────────────────────────── */
function useSpring(target, { stiffness = 180, damping = 22 } = {}) {
  const [val, setVal] = useState(target);
  const state = useRef({ pos: target, vel: 0, raf: null });
  useEffect(() => {
    const s = state.current;
    const tick = () => {
      const force = (target - s.pos) * stiffness - s.vel * damping;
      s.vel += force * 0.016;
      s.pos += s.vel * 0.016;
      if (Math.abs(s.pos - target) < 0.001 && Math.abs(s.vel) < 0.001) {
        s.pos = target;
        s.vel = 0;
        setVal(target);
        return;
      }
      setVal(s.pos);
      s.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(s.raf);
    s.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.raf);
  }, [target, stiffness, damping]);
  return val;
}

/* ─────────────────────────────────────────
   CURSOR
───────────────────────────────────────── */
function Cursor() {
  const [pos, setPos] = useState({ x: -99, y: -99 });
  const [down, setDown] = useState(false);
  const lagX = useSpring(pos.x, { stiffness: 280, damping: 28 });
  const lagY = useSpring(pos.y, { stiffness: 280, damping: 28 });
  const scale = useSpring(down ? 0.55 : 1, { stiffness: 300, damping: 20 });

  useEffect(() => {
    const mv = (e) => setPos({ x: e.clientX, y: e.clientY });
    const md = () => setDown(true),
      mu = () => setDown(false);
    window.addEventListener("mousemove", mv);
    window.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    return () => {
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mousedown", md);
      window.removeEventListener("mouseup", mu);
    };
  }, []);

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          zIndex: 9999,
          pointerEvents: "none",
          transform: `translate(-50%,-50%) scale(${scale})`,
          width: 10,
          height: 10,
          borderRadius: "50%",
          // background: down ? C.peach : "#c4a882",
          // boxShadow:`0 0 14px ${down ? C.peach : "rgba(196,168,130,.5)"}`,
          background: down ? C.peach : C.accent,
          boxShadow: `0 0 14px ${down ? C.peach : "rgba(214,167,122,.5)"}`,
          transition: "background .2s, box-shadow .2s",
        }}
      />
      <div
        style={{
          position: "fixed",
          left: lagX,
          top: lagY,
          zIndex: 9998,
          pointerEvents: "none",
          transform: "translate(-50%,-50%)",
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: `1.5px solid rgba(196,168,130,${down ? ".5" : ".28"})`,
          transition: "border-color .2s",
        }}
      />
    </>
  );
}

/* ─────────────────────────────────────────
   CANVAS PARTICLE SYSTEM — GPU accelerated
───────────────────────────────────────── */
function ParticleCanvas() {
  const ref = useRef();
  const particles = useRef([]);
  const raf = useRef();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const resize = () => {
      canvas.width = innerWidth;
      canvas.height = innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current = particles.current.filter((p) => p.life > 0);
      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.vx *= 0.99;
        p.rotation += p.rotV;
        p.life -= p.decay;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        if (p.type === "dot") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        } else if (p.type === "petal") {
          ctx.beginPath();
          ctx.ellipse(0, -p.size, p.size * 0.5, p.size, 0, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.font = `${p.size * 2}px serif`;
          ctx.fillText(p.char, -p.size, p.size);
        }
        ctx.restore();
      }
      raf.current = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener("__burst__", (e) => {
      const { x, y, count = 18, type = "mixed" } = e.detail;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + rnd(-0.3, 0.3);
        const speed = rnd(1.5, 6);
        const col = rndItem(PETALS);
        particles.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - rnd(1, 3),
          rotation: rnd(0, Math.PI * 2),
          rotV: rnd(-0.12, 0.12),
          size: rnd(3, 8),
          color: col,
          life: 1,
          decay: rnd(0.012, 0.022),
          type:
            type === "char" ? "char" : Math.random() > 0.5 ? "petal" : "dot",
          char: rndItem(["✦", "◦", "·", "✧", "⊹"]),
        });
      }
    });

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 900,
      }}
    />
  );
}

const burst = (x, y, count = 18, type = "mixed") =>
  window.dispatchEvent(
    new CustomEvent("__burst__", { detail: { x, y, count, type } }),
  );

/* ─────────────────────────────────────────
   D3 BLOOMING FLOWER — smooth path morphing
───────────────────────────────────────── */
function D3Flower({
  x = 0,
  y = 0,
  size = 1,
  color = C.peach,
  innerColor,
  open = false,
  delay = 0,
  interactive = true,
}) {
  const gRef = useRef();
  const [bloomed, setBloomed] = useState(false);
  const [hov, setHov] = useState(false);
  const ic = innerColor || color;
  const N = 6;

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setBloomed(true), delay);
      return () => clearTimeout(t);
    }
  }, [open, delay]);

  useEffect(() => {
    if (!gRef.current) return;
    const g = d3.select(gRef.current);
    const dur = bloomed ? 550 : 280;
    const ease = bloomed ? d3.easeCubicOut : d3.easeCubicIn;

    // Outer petals
    g.selectAll(".petal-outer").each(function (d, i) {
      const el = d3.select(this);
      if (bloomed) {
        el.transition()
          .duration(dur)
          .delay(i * 55)
          .ease(d3.easeBackOut.overshoot(1.6))
          .attr("transform", `rotate(${i * 60}) translate(0,${-11 * size})`)
          .attr("opacity", 0.88);
      } else {
        el.transition()
          .duration(dur)
          .delay(i * 28)
          .ease(ease)
          .attr("transform", `rotate(${i * 60}) translate(0,0) scale(0)`)
          .attr("opacity", 0);
      }
    });

    // Inner petals
    g.selectAll(".petal-inner").each(function (d, i) {
      const el = d3.select(this);
      if (bloomed) {
        el.transition()
          .duration(dur)
          .delay(i * 55 + 70)
          .ease(d3.easeBackOut.overshoot(1.4))
          .attr(
            "transform",
            `rotate(${i * 60 + 30}) translate(0,${-7.5 * size})`,
          )
          .attr("opacity", 0.55);
      } else {
        el.transition()
          .duration(dur)
          .delay(i * 22)
          .ease(ease)
          .attr("transform", `rotate(${i * 60 + 30}) translate(0,0) scale(0)`)
          .attr("opacity", 0);
      }
    });

    // Center
    g.select(".center-outer")
      .transition()
      .duration(dur + 100)
      .ease(d3.easeBackOut.overshoot(2))
      .attr("r", bloomed ? 6 * size : 2 * size);
    g.select(".center-inner")
      .transition()
      .duration(dur + 80)
      .ease(d3.easeBackOut.overshoot(2))
      .attr("r", bloomed ? 3 * size : 1 * size);
  }, [bloomed, size]);

  // Hover glow via d3
  useEffect(() => {
    if (!gRef.current) return;
    const g = d3.select(gRef.current);
    g.select(".glow-ring")
      .transition()
      .duration(300)
      .attr("r", hov && bloomed ? 16 * size : 0)
      .attr("opacity", hov && bloomed ? 0.18 : 0);
  }, [hov, bloomed, size]);

  const stemLen = 20 * size;

  return (
    <g
      ref={gRef}
      transform={`translate(${x},${y})`}
      style={{ cursor: interactive ? "pointer" : "default" }}
      onMouseEnter={() => {
        if (interactive) {
          setHov(true);
          setBloomed(true);
        }
      }}
      onMouseLeave={() => {
        if (interactive) setHov(false);
      }}
      onClick={(e) => {
        if (interactive) {
          e.stopPropagation();
          setBloomed((b) => !b);
        }
      }}
    >
      {/* Stem */}
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={stemLen}
        stroke="#8bb84e"
        strokeWidth={1.8 * size}
        strokeLinecap="round"
        opacity={0.72}
      />
      {/* Leaves */}
      {[
        [-1, 0.52, -32],
        [1, 0.68, 32],
      ].map(([sx, fy, rot], i) => (
        <ellipse
          key={i}
          cx={sx * 6 * size}
          cy={stemLen * fy}
          rx={6 * size}
          ry={2.5 * size}
          fill="#9cc75a"
          opacity={0.65}
          transform={`rotate(${rot},${sx * 6 * size},${stemLen * fy})`}
          style={{
            transformOrigin: `${sx * 6 * size}px ${stemLen * fy}px`,
            animation: bloomed
              ? `leafS ${2.1 + i * 0.5}s ease-in-out infinite ${i ? "reverse" : ""}`
              : "",
          }}
        />
      ))}

      {/* Glow */}
      <circle
        className="glow-ring"
        cx={0}
        cy={0}
        r={0}
        fill={color}
        opacity={0}
      />

      {/* Outer petals */}
      {Array.from({ length: N }, (_, i) => (
        <ellipse
          key={i}
          className="petal-outer"
          cx={0}
          cy={0}
          rx={5.2 * size}
          ry={9.8 * size}
          fill={color}
          opacity={0}
          transform={`rotate(${i * 60}) translate(0,0) scale(0)`}
          style={{ transformOrigin: "0 0" }}
        />
      ))}

      {/* Inner petals */}
      {Array.from({ length: N }, (_, i) => (
        <ellipse
          key={`i${i}`}
          className="petal-inner"
          cx={0}
          cy={0}
          rx={3.4 * size}
          ry={6.8 * size}
          fill={ic}
          opacity={0}
          transform={`rotate(${i * 60 + 30}) translate(0,0) scale(0)`}
          style={{ transformOrigin: "0 0" }}
        />
      ))}

      {/* Center */}
      <circle
        className="center-outer"
        cx={0}
        cy={0}
        r={2 * size}
        fill="#fde98a"
        style={{
          filter: hov && bloomed ? "drop-shadow(0 0 6px #fde98a)" : "none",
          transition: "filter .3s",
        }}
      />
      <circle
        className="center-inner"
        cx={0}
        cy={0}
        r={1 * size}
        fill="#f59e0b"
        opacity={0.7}
      />
    </g>
  );
}

/* ─────────────────────────────────────────
   TOUCH BLOOM (spawned at click point)
───────────────────────────────────────── */
const BLOOM_PALETTE = [
  [C.peach, C.peachL],
  [C.sage, C.sageL],
  [C.sky, C.skyL],
  [C.honey, C.honeyL],
  [C.lav, C.lavL],
  [C.rose, C.peachL],
];

function SpawnedFlower({ x, y, color, inner, size, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, []);
  const W = 90 * size,
    H = 100 * size;
  return (
    <div
      style={{
        position: "fixed",
        left: x - W / 2,
        top: y - H * 0.62,
        pointerEvents: "none",
        zIndex: 800,
        animation: "fadeInQ .15s ease",
      }}
    >
      <svg
        viewBox="-30 -44 60 60"
        width={W}
        height={H}
        style={{ overflow: "visible" }}
      >
        <D3Flower
          cx={0}
          cy={0}
          size={size * 0.88}
          color={color}
          innerColor={inner}
          open
          interactive={false}
          delay={0}
        />
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────
   RIPPLE (d3-driven expanding ring)
───────────────────────────────────────── */
function D3Ripple({ x, y, onDone }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current) return;
    d3.select(ref.current)
      .attr("r", 0)
      .attr("opacity", 0.5)
      .transition()
      .duration(680)
      .ease(d3.easeQuadOut)
      .attr("r", 44)
      .attr("opacity", 0)
      .on("end", onDone);
  }, []);
  return (
    <svg
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 799,
        pointerEvents: "none",
        overflow: "visible",
        transform: "translate(-50%,-50%)",
      }}
      width={100}
      height={100}
    >
      <circle
        ref={ref}
        cx={50}
        cy={50}
        r={0}
        fill="none"
        stroke={C.ghost}
        strokeWidth={1.4}
      />
    </svg>
  );
}

/* ─────────────────────────────────────────
   ANIMATED CAKE (d3 flame)
───────────────────────────────────────── */
function Cake({ blown, onClick }) {
  const flameRefs = useRef([]);
  const [hov, setHov] = useState(false);
  const scale = useSpring(hov ? 1.04 : 1, { stiffness: 200, damping: 18 });

  useEffect(() => {
    flameRefs.current.forEach((ref, i) => {
      if (!ref || blown) return;
      const animate = () => {
        d3.select(ref)
          .select(".f-outer")
          .transition()
          .duration(120 + i * 30)
          .ease(d3.easeSinInOut)
          .attr("rx", rnd(3, 5))
          .attr("ry", rnd(5.5, 7.5))
          .attr("cy", rnd(13, 16))
          .transition()
          .duration(120 + i * 30)
          .ease(d3.easeSinInOut)
          .attr("rx", rnd(3.5, 4.5))
          .attr("ry", rnd(6, 7))
          .attr("cy", rnd(14, 15))
          .on("end", animate);
      };
      animate();
    });
  }, [blown]);

  const CX = [32, 46, 60, 74, 88];

  return (
    <svg
      viewBox="0 0 120 128"
      width={168}
      height={179}
      style={{
        cursor: "pointer",
        overflow: "visible",
        transform: `scale(${scale})`,
        transformOrigin: "center bottom",
        filter: hov
          ? "drop-shadow(0 12px 28px rgba(240,184,168,.45))"
          : "drop-shadow(0 4px 16px rgba(200,180,154,.25))",
        transition: "filter .4s",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
    >
      {/* shadow */}
      <ellipse cx={60} cy={124} rx={44} ry={6} fill="rgba(42,26,14,.08)" />

      {/* base tier */}
      <rect
        x={8}
        y={76}
        width={104}
        height={44}
        rx={12}
        fill="#fff6f2"
        stroke="#f0d6cc"
        strokeWidth={1.2}
      />
      {[18, 29, 40, 51, 62, 73, 84, 95, 106].map((x, i) => (
        <ellipse
          key={i}
          cx={x}
          cy={76}
          rx={7}
          ry={5.2}
          fill="white"
          opacity={0.9}
        />
      ))}
      {[22, 38, 54, 70, 86, 102].map((x, i) => (
        <circle
          key={i}
          cx={x}
          cy={97}
          r={4}
          fill={[C.peach, C.sage, C.sky, C.honey, C.lav, C.peach][i]}
          opacity={0.88}
        />
      ))}

      {/* top tier */}
      <rect
        x={20}
        y={46}
        width={80}
        height={34}
        rx={11}
        fill="#fff4f8"
        stroke={C.peach}
        strokeWidth={1.2}
      />
      {[28, 40, 52, 64, 76, 88, 100].map((x, i) => (
        <ellipse
          key={i}
          cx={x}
          cy={46}
          rx={7}
          ry={5}
          fill="white"
          opacity={0.9}
        />
      ))}
      <text
        x={60}
        y={67}
        textAnchor="middle"
        fontSize={7.5}
        fontFamily={C.sf}
        fill={"#e37724"}//#d8c2b8
        fontStyle="italic"
      >
        Happy Birthday
      </text>

      {/* candles */}
      {CX.map((cx, i) => (
        <g key={i} ref={(el) => (flameRefs.current[i] = el)}>
          <rect
            x={cx - 3.2}
            y={26}
            width={6.4}
            height={22}
            rx={3.2}
            fill={[C.peach, C.sky, C.sage, C.honey, C.lav][i]}
            opacity={0.9}
          />
          <line
            x1={cx}
            y1={26}
            x2={cx}
            y2={20}
            stroke="#6a4828"
            strokeWidth={1.2}
            strokeLinecap="round"
          />
          {!blown ? (
            <g>
              {/* glow */}
              <ellipse
                cx={cx}
                cy={14}
                rx={9}
                ry={11}
                fill="#ff9820"
                opacity={0.12}
              />
              {/* outer flame */}
              <ellipse
                className="f-outer"
                cx={cx}
                cy={14}
                rx={4}
                ry={7}
                fill="#ff9820"
                opacity={0.92}
              />
              {/* mid flame */}
              <ellipse cx={cx} cy={15.5} rx={2.6} ry={4.5} fill="#ffde30" />
              {/* core */}
              <ellipse
                cx={cx}
                cy={17}
                rx={1.3}
                ry={2.4}
                fill="white"
                opacity={0.75}
              />
            </g>
          ) : (
            <ellipse
              cx={cx}
              cy={20}
              rx={1.8}
              ry={1.8}
              fill="#c0b8b0"
              opacity={0.4}
              style={{ animation: "smokeQ 2s ease-out infinite" }}
            />
          )}
        </g>
      ))}

      {hov &&
        !blown &&
        [10, 108].map((x, i) => (
          <text
            key={i}
            x={x}
            y={22}
            fontSize={9}
            fill={C.peach}
            opacity={0.75}
            style={{ animation: `btQ 1.3s ease-in-out ${i * 0.3}s infinite` }}
          >
            ♡
          </text>
        ))}
    </svg>
  );
}

/* ─────────────────────────────────────────
   WISH CARD — d3 for flip physics
───────────────────────────────────────── */
function WishCard({ emoji, front, back, accent, delay, onReveal, revealed }) {
  const [flipped, setFlipped] = useState(false);
  const [hov, setHov] = useState(false);
  const rotY = useSpring(flipped ? 180 : 0, { stiffness: 140, damping: 20 });
  const hovY = useSpring(hov && !flipped ? 6 : 0, {
    stiffness: 200,
    damping: 18,
  });
  const sc = useSpring(hov && !flipped ? 1.036 : 1, {
    stiffness: 200,
    damping: 18,
  });
  const ty = useSpring(hov && !flipped ? -5 : 0, {
    stiffness: 200,
    damping: 18,
  });
  const once = useRef(false);

  return (
    <div
      style={{
        perspective: 700,
        cursor: "pointer",
        animation: `ciQ .62s cubic-bezier(.22,1,.36,1) ${delay}s both`,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => {
        setFlipped((f) => !f);
        if (!once.current) {
          once.current = true;
          onReveal();
        }
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "108%",
          transformStyle: "preserve-3d",
          transform: `rotateY(${rotY}deg) rotateY(${hovY}deg) scale(${sc}) translateY(${ty}px)`,
        }}
      >
        {/* Front */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            background: "#fff8f6",
            borderRadius: 22,
            border: `1px solid rgba(212,194,170,.25)`,
            boxShadow: hov
              ? `0 18px 48px rgba(42,26,14,.1), 0 0 0 1px ${accent}33`
              : "0 2px 18px rgba(196,168,130,.12)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 22,
            transition: "box-shadow .35s",
          }}
        >
          <div
            style={{
              fontSize: "2rem",
              lineHeight: 1,
              transform: hov ? "scale(1.22) rotate(8deg)" : "scale(1)",
              transition: "transform .35s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            {emoji}
          </div>
          <p
            style={{
              fontFamily: C.sf,
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: ".88rem",
              color: C.mid,
              textAlign: "center",
              lineHeight: 1.72,
            }}
          >
            {front}
          </p>
          <span
            style={{
              fontSize: ".54rem",
              letterSpacing: ".13em",
              color: revealed ? "#b8906a" : "rgba(138,106,80, 0.6)",
            }}
          >
            {revealed ? "✦ revealed ✦" : "tap ✦"}
          </span>
        </div>
        {/* Back */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: `linear-gradient(148deg,${accent}16,${accent}06)`,
            borderRadius: 22,
            border: `1px solid ${accent}44`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 22,
          }}
        >
          <p
            style={{
              fontFamily: C.sf,
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: ".88rem",
              color: "#5a3020",
              textAlign: "center",
              lineHeight: 1.95,
            }}
          >
            {back}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   FLOWER ROW
───────────────────────────────────────── */
function FlowerRow() {
  const fs = [
    { p: 6, c: C.peach, i: C.peachL, s: 0.72 },
    { p: 18, c: C.sage, i: C.sageL, s: 0.88 },
    { p: 30, c: C.honey, i: C.peach, s: 0.68 },
    { p: 42, c: C.sky, i: C.lav, s: 0.82 },
    { p: 50, c: C.peach, i: C.lav, s: 1.02 },
    { p: 58, c: C.lav, i: C.sky, s: 0.8 },
    { p: 70, c: C.sage, i: C.honey, s: 0.74 },
    { p: 82, c: C.honey, i: C.sage, s: 0.86 },
    { p: 94, c: C.peach, i: C.peachL, s: 0.7 },
  ];
  return (
    <div style={{ position: "relative", height: 70, overflow: "visible" }}>
      {fs.map((f, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${f.p}%`,
            bottom: 0,
            transform: "translateX(-50%)",
          }}
        >
          <svg
            viewBox="-24 -40 48 54"
            width={48 * f.s}
            height={54 * f.s}
            style={{ overflow: "visible" }}
          >
            <D3Flower
              cx={0}
              cy={0}
              size={f.s * 0.76}
              color={f.c}
              innerColor={f.i}
              open
              delay={i * 120}
            />
          </svg>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
function Toast({ msg, show }) {
  const y = useSpring(show ? 0 : 12, { stiffness: 240, damping: 22 });
  const op = useSpring(show ? 1 : 0, { stiffness: 240, damping: 22 });
  return (
    <div
      style={{
        position: "fixed",
        bottom: 30,
        left: "50%",
        zIndex: 9800,
        transform: `translate(-50%,${y}px)`,
        opacity: op,
        background: "rgba(32,18,8,.88)",
        backdropFilter: "blur(12px)",
        color: "#fef0e0",
        padding: "10px 28px",
        borderRadius: 100,
        fontFamily: C.ss,
        fontWeight: 300,
        fontSize: ".72rem",
        letterSpacing: ".1em",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        boxShadow: "0 8px 32px rgba(32,18,8,.2)",
      }}
    >
      {msg}
    </div>
  );
}

/* ─────────────────────────────────────────
   ANIMAL CELEBRATION FINALE
───────────────────────────────────────── */
function Confetti() {
  const canvasRef = useRef();
  useEffect(() => {
    const c = canvasRef.current,
      ctx = c.getContext("2d");
    c.width = 500;
    c.height = 300;
    const items = Array.from({ length: 48 }, (_, i) => ({
      x: rnd(0, 500),
      y: rnd(-20, -200),
      vx: rnd(-1.5, 1.5),
      vy: rnd(1.5, 4),
      rot: rnd(0, Math.PI * 2),
      rotV: rnd(-0.06, 0.06),
      w: rnd(6, 12),
      h: rnd(3, 6),
      col: rndItem([
        C.peach,
        C.sage,
        C.honey,
        C.sky,
        C.lav,
        "#f4a0b8",
        "#b8e0a0",
      ]),
      life: 1,
      decay: rnd(0.003, 0.008),
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, 500, 300);
      for (const p of items) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotV;
        p.life -= p.decay;
        if (p.y > 310) {
          p.y = -10;
          p.life = 1;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life * 0.85);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={300}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

/* Animals (SVG) */
function Elephant() {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current) return;
    const g = d3.select(ref.current);
    // Sway loop
    const sway = () => {
      g.transition()
        .duration(1400)
        .ease(d3.easeSinInOut)
        .attr("transform", "translate(60,20) rotate(-2,-60,120) translateX(-3)")
        .transition()
        .duration(1400)
        .ease(d3.easeSinInOut)
        .attr("transform", "translate(60,20) rotate(2,-60,120) translateX(3)")
        .on("end", sway);
    };
    sway();
  }, []);

  return (
    <g ref={ref} transform="translate(60,20)">
      {/* tail */}
      <path
        d="M96 100 Q110 112 106 124 Q102 130 108 138"
        stroke="#c8a882"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        style={{ animation: "tailQ 1.2s ease-in-out infinite" }}
      />
      {/* body */}
      <ellipse cx={0} cy={92} rx={34} ry={26} fill="#d4b896" />
      <ellipse cx={0} cy={88} rx={30} ry={22} fill="#dcc0a0" />
      {/* legs */}
      {[
        [-16, 10],
        [-6, 13],
        [6, 13],
        [16, 10],
      ].map(([dx, dy], i) => (
        <rect
          key={i}
          x={dx - 5.5}
          y={dy + 100}
          width={11}
          height={17}
          rx={5.5}
          fill="#c8a882"
          style={{
            animation: `legQ ${0.55 + i * 0.08}s ease-in-out ${i * 0.12}s infinite`,
          }}
        />
      ))}
      <ellipse cx={0} cy={130} rx={30} ry={4} fill="rgba(42,26,14,.07)" />
      {/* ears */}
      <ellipse
        cx={-30}
        cy={68}
        rx={16}
        ry={20}
        fill="#dcc0a0"
        style={{
          transformOrigin: "-20px 70px",
          animation: "earQ 1.8s ease-in-out infinite",
        }}
      />
      <ellipse
        cx={-28}
        cy={68}
        rx={10}
        ry={13}
        fill={C.peach}
        opacity={0.5}
        style={{
          transformOrigin: "-20px 70px",
          animation: "earQ 1.8s ease-in-out infinite",
        }}
      />
      <ellipse
        cx={30}
        cy={68}
        rx={16}
        ry={20}
        fill="#dcc0a0"
        style={{
          transformOrigin: "20px 70px",
          animation: "earQ 1.8s ease-in-out .2s infinite reverse",
        }}
      />
      {/* head */}
      <ellipse cx={0} cy={60} rx={26} ry={24} fill="#dcc0a0" />
      <ellipse cx={-4} cy={56} rx={20} ry={17} fill="#e4cdb0" opacity={0.5} />
      {/* eyes */}
      <circle cx={-11} cy={53} r={4} fill="white" />
      <circle cx={11} cy={53} r={4} fill="white" />
      <circle
        cx={-10}
        cy={53}
        r={2.4}
        fill="#2a1a0e"
        style={{ animation: "winkQ 3s ease-in-out infinite" }}
      />
      <circle
        cx={12}
        cy={53}
        r={2.4}
        fill="#2a1a0e"
        style={{ animation: "winkQ 3s ease-in-out 1.2s infinite" }}
      />
      <circle cx={-9} cy={52.2} r={0.9} fill="white" />
      <circle cx={13} cy={52.2} r={0.9} fill="white" />
      {/* brows */}
      <path
        d="M-14 47 Q-10 44 -6 47"
        stroke="#9a7050"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M8 47 Q12 44 16 47"
        stroke="#9a7050"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
      />
      {/* smile */}
      <path
        d="M-8 63 Q0 69 8 63"
        stroke="#9a7050"
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
      />
      {/* blush */}
      <ellipse cx={-16} cy={60} rx={7} ry={4} fill={C.rose} opacity={0.38} />
      <ellipse cx={16} cy={60} rx={7} ry={4} fill={C.rose} opacity={0.38} />
      {/* trunk */}
      <path
        d="M-3 76 Q-19 84 -24 100 Q-28 112 -20 116 Q-14 120 -14 110"
        stroke="#c8a882"
        strokeWidth={7}
        fill="none"
        strokeLinecap="round"
        style={{ animation: "trunkQ 2s ease-in-out infinite" }}
      />
      <path
        d="M-3 76 Q-19 84 -24 100 Q-28 112 -20 116 Q-14 120 -14 110"
        stroke="#dcc0a0"
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
        style={{ animation: "trunkQ 2s ease-in-out infinite" }}
      />
      {/* flower on trunk */}
      <g
        transform="translate(-14,108)"
        style={{ animation: "hbQ 1.8s ease-in-out infinite" }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <ellipse
            key={i}
            cx={0}
            cy={0}
            rx={4.8}
            ry={8.8}
            fill={[C.peach, C.sage, C.honey, C.peach, C.lav, C.sage][i]}
            opacity={0.9}
            style={{
              transformOrigin: "0 0",
              transform: `rotate(${i * 60}deg) translateY(-8.8px)`,
            }}
          />
        ))}
        <circle cx={0} cy={0} r={5} fill="#fde98a" />
      </g>
      {/* party hat */}
      <g
        transform="translate(-2,30)"
        style={{ animation: "hbQ 1.6s ease-in-out .2s infinite" }}
      >
        <polygon
          points="0,-26 -13,0 13,0"
          fill={C.peach}
          stroke="#f4a0b8"
          strokeWidth={1}
        />
        <line
          x1={0}
          y1={-26}
          x2={0}
          y2={-34}
          stroke="#f4a0b8"
          strokeWidth={1.5}
        />
        <circle cx={0} cy={-34} r={3} fill={C.honey} />
        {[-5, -1, 3].map((x, i) => (
          <ellipse
            key={i}
            cx={x}
            cy={-8 + i * 5}
            rx={2}
            ry={1}
            fill={[C.sage, C.honey, C.sky][i]}
            opacity={0.9}
          />
        ))}
      </g>
    </g>
  );
}

function FBird({ x, y, col, wc, anim, delay }) {
  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ animation: `${anim} 4.5s ease-in-out ${delay}s infinite` }}
    >
      <ellipse cx={0} cy={0} rx={10} ry={7} fill={col} />
      <circle cx={9} cy={-4} r={7} fill={col} />
      <ellipse
        cx={-4}
        cy={-2}
        rx={9}
        ry={5}
        fill={wc}
        opacity={0.82}
        style={{
          transformOrigin: "-4px -2px",
          animation: `wingQ .38s ease-in-out ${delay}s infinite`,
        }}
      />
      <circle cx={11} cy={-5} r={1.8} fill="white" />
      <circle
        cx={11.5}
        cy={-5}
        r={1.1}
        fill="#2a1a0e"
        style={{ animation: `winkQ 3s ease-in-out ${delay + 0.5}s infinite` }}
      />
      <polygon points="16,-4 21,-3 16,-2" fill={C.honey} />
      <path d="M-10 2 Q-17-2-18 4 Q-17 8-10 4" fill={wc} opacity={0.7} />
      <g transform="translate(8,-11)">
        <polygon points="0,-6 -4,0 4,0" fill={C.lav} opacity={0.88} />
        <circle cx={0} cy={-6} r={1.2} fill={C.peach} />
      </g>
    </g>
  );
}

function GBird({ x, y, col, wc, delay }) {
  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ animation: `hopQ .5s ease-in-out ${delay}s infinite` }}
    >
      <ellipse cx={0} cy={0} rx={9} ry={6.5} fill={col} />
      <circle cx={8} cy={-3.5} r={6.5} fill={col} />
      <ellipse
        cx={-3}
        cy={-1.5}
        rx={8}
        ry={4.5}
        fill={wc}
        opacity={0.82}
        style={{
          transformOrigin: "-3px -1.5px",
          animation: `wingQ .38s ease-in-out ${delay + 0.1}s infinite`,
        }}
      />
      <circle cx={10} cy={-4.5} r={1.6} fill="white" />
      <circle cx={10.5} cy={-4.5} r={1} fill="#2a1a0e" />
      <polygon points="14,-3.5 18,-2.5 14,-1.5" fill={C.honey} />
      <ellipse cx={8} cy={-4} rx={3.5} ry={2} fill={C.peach} opacity={0.4} />
    </g>
  );
}

function Bunny() {
  return (
    <g
      style={{
        animation: "bunnyQ 1.4s ease-in-out infinite",
        transformOrigin: "0 40px",
      }}
    >
      <ellipse cx={0} cy={54} rx={16} ry={3.5} fill="rgba(42,26,14,.07)" />
      <ellipse cx={0} cy={38} rx={15} ry={19} fill="#f0ece4" />
      <ellipse cx={0} cy={42} rx={8.5} ry={11} fill="#fdf8f4" opacity={0.75} />
      <circle cx={0} cy={14} r={14} fill="#f0ece4" />
      {/* ears */}
      <ellipse
        cx={-7.5}
        cy={-8}
        rx={4.8}
        ry={13}
        fill="#f0ece4"
        style={{
          transformOrigin: "-7.5px 4px",
          animation: "earLQ 1.8s ease-in-out infinite",
        }}
      />
      <ellipse
        cx={-7.5}
        cy={-8}
        rx={2.4}
        ry={9.5}
        fill={C.peach}
        opacity={0.65}
        style={{
          transformOrigin: "-7.5px 4px",
          animation: "earLQ 1.8s ease-in-out infinite",
        }}
      />
      <ellipse
        cx={7.5}
        cy={-8}
        rx={4.8}
        ry={13}
        fill="#f0ece4"
        style={{
          transformOrigin: "7.5px 4px",
          animation: "earRQ 1.8s ease-in-out .15s infinite",
        }}
      />
      <ellipse
        cx={7.5}
        cy={-8}
        rx={2.4}
        ry={9.5}
        fill={C.peach}
        opacity={0.65}
        style={{
          transformOrigin: "7.5px 4px",
          animation: "earRQ 1.8s ease-in-out .15s infinite",
        }}
      />
      {/* face */}
      <circle cx={-4.8} cy={13} r={2.9} fill="white" />
      <circle cx={4.8} cy={13} r={2.9} fill="white" />
      <circle
        cx={-4.4}
        cy={13}
        r={1.9}
        fill="#2a1a0e"
        style={{ animation: "winkQ 3.5s ease-in-out .5s infinite" }}
      />
      <circle
        cx={5.2}
        cy={13}
        r={1.9}
        fill="#2a1a0e"
        style={{ animation: "winkQ 3.5s ease-in-out .9s infinite" }}
      />
      <ellipse cx={0} cy={18} rx={2.4} ry={1.7} fill={C.peach} />
      <path
        d="M-3 20 Q0 23 3 20"
        stroke="#c87890"
        strokeWidth={1.2}
        fill="none"
        strokeLinecap="round"
      />
      <ellipse
        cx={-8.5}
        cy={18}
        rx={3.8}
        ry={2.4}
        fill={C.peach}
        opacity={0.45}
      />
      <ellipse
        cx={8.5}
        cy={18}
        rx={3.8}
        ry={2.4}
        fill={C.peach}
        opacity={0.45}
      />
      {/* arms up */}
      <path
        d="M-14 30 Q-23 18-17 10"
        stroke="#f0ece4"
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M14 30 Q23 18 17 10"
        stroke="#f0ece4"
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      <text
        x={-27}
        y={12}
        fontSize={11}
        fill={C.honey}
        style={{ animation: "spQ 1.2s ease-in-out infinite" }}
      >
        ✦
      </text>
      <text
        x={15}
        y={12}
        fontSize={11}
        fill={C.peach}
        style={{ animation: "spQ 1.2s ease-in-out .3s infinite" }}
      >
        ✦
      </text>
      <circle cx={0} cy={55} r={5} fill="white" />
      {/* hat */}
      <g transform="translate(0,-2)">
        <polygon points="0,-15 -5.5,0 5.5,0" fill={C.sage} opacity={0.9} />
        <rect
          x={-5.5}
          y={0}
          width={11}
          height={2}
          rx={1}
          fill={C.sage}
          opacity={0.65}
        />
        <circle cx={0} cy={-15} r={2} fill={C.honey} />
      </g>
    </g>
  );
}

function Balloons() {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current) return;
    d3.select(ref.current)
      .selectAll(".bal")
      .each(function (_, i) {
        const el = d3.select(this);
        const loop = () => {
          el.transition()
            .duration(2800 + i * 200)
            .ease(d3.easeSinInOut)
            .attr("transform", `translate(0,-10) rotate(3)`)
            .transition()
            .duration(2800 + i * 200)
            .ease(d3.easeSinInOut)
            .attr("transform", `translate(0,0) rotate(-3)`)
            .on("end", loop);
        };
        loop();
      });
  }, []);

  const bals = [
    [55, 22, C.peach, 0],
    [115, 10, C.sage, 0.3],
    [180, 24, C.sky, 0.6],
    [248, 8, C.honey, 0.15],
    [315, 22, C.lav, 0.45],
    [385, 12, C.peach, 0.7],
    [448, 18, C.sage, 0.2],
  ];

  return (
    <svg
      ref={ref}
      viewBox="0 0 500 60"
      width="100%"
      height={60}
      style={{ overflow: "visible" }}
    >
      {bals.map(([x, y, c], i) => (
        <g key={i} className="bal" transform={`translate(${x},${y})`}>
          <ellipse cx={0} cy={0} rx={11} ry={14} fill={c} opacity={0.82} />
          <path
            d="M0 14 Q3 18 0 22 Q-3 26 0 30"
            stroke={c}
            strokeWidth={1.5}
            fill="none"
            opacity={0.6}
          />
          <ellipse
            cx={-3}
            cy={-5}
            rx={3}
            ry={2}
            fill="white"
            opacity={0.3}
            transform="rotate(-30,-3,-5)"
          />
        </g>
      ))}
    </svg>
  );
}

function Finale({ onClose }) {
  const [phase, setPhase] = useState(0);
  const scaleV = useSpring(1, { stiffness: 120, damping: 14 });
  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 2800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9950,
        background: "rgba(250,248,243,.9)",
        backdropFilter: "blur(22px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
        overflowY: "auto",
        animation: "cbgQ .5s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff8f6",
          borderRadius: 30,
          padding: "30px 26px 28px",
          maxWidth: 540,
          width: "100%",
          textAlign: "center",
          boxShadow:
            "0 40px 100px rgba(42,26,14,.12), 0 2px 8px rgba(42,26,14,.06)",
          border: "1px solid rgba(210,190,168,.22)",
          animation: "cinQ .58s cubic-bezier(.34,1.56,.64,1)",
          position: "relative",
          overflow: "visible",
        }}
      >
        <p
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 18,
            fontFamily: C.ss,
            fontWeight: 300,
            fontSize: ".58rem",
            color: "rgba(138,106,80,.3)",
            cursor: "pointer",
          }}
        >
          tap to close ✕
        </p>

        {/* Balloons */}
        <div
          style={{
            position: "absolute",
            top: -58,
            left: 0,
            right: 0,
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <Balloons />
        </div>

        {/* Canvas confetti + Animal SVG */}
        {/* <div
          style={{
            position: "relative",
            height: 240,
            overflow: "hidden",
            borderRadius: 16,
            background:
              "linear-gradient(180deg,rgba(250,248,243,.3),rgba(250,248,243,.8))",
            marginBottom: 10,
          }}
        >
          <Confetti />
          <svg
            viewBox="0 0 500 240"
            width="100%"
            height={240}
            style={{ overflow: "visible", position: "relative", zIndex: 1 }}
          >
            <line
              x1={20}
              y1={220}
              x2={480}
              y2={220}
              stroke="rgba(138,106,80,.15)"
              strokeWidth={1.5}
              strokeDasharray="4,6"
            />
            {[
              [46, 220, C.peach, C.peachL, 0.58],
              [108, 220, C.sage, C.sageL, 0.52],
              [380, 220, C.lav, C.sky, 0.55],
              [440, 220, C.honey, C.peach, 0.6],
            ].map(([x, y, c, ic, s], i) => (
              <D3Flower
                key={i}
                cx={x}
                cy={y - 8}
                size={s * 0.7}
                color={c}
                innerColor={ic}
                open
                interactive={false}
                delay={i * 120}
              />
            ))}
            <FBird
              x={38}
              y={34}
              col={C.peach}
              wc={C.peachL}
              anim="bf1Q"
              delay={0}
            />
            <FBird
              x={415}
              y={28}
              col={C.sky}
              wc={C.lav}
              anim="bf2Q"
              delay={0.55}
            />
            <GBird x={95} y={210} col={C.sage} wc={C.sageL} delay={0.3} />
            <Elephant />
            <g transform="translate(370,155)">
              <Bunny />
            </g>
            {[
              [26, 18],
              [150, 8],
              [330, 22],
              [470, 14],
              [246, 4],
            ].map(([x, y], i) => (
              <text
                key={i}
                x={x}
                y={y}
                fontSize={i % 2 ? 11 : 9}
                fill={[C.peach, C.honey, C.lav, C.sage, C.sky][i]}
                style={{
                  animation: `spQ ${1 + i * 0.3}s ease-in-out ${i * 0.2}s infinite`,
                }}
              >
                {i % 2 ? "✦" : "◦"}
              </text>
            ))}
          </svg>
        </div> */}
        <div
          style={{
            position: "relative",
            height: 240,
            overflow: "hidden",
            borderRadius: 16,
            marginBottom: 10,
          }}
        >
          <video
            src="/animation3.mp4" // 👉 your video file
            autoPlay
            muted
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: 16,
            }}
          />
        </div>

        {/* Message */}
        <div
          style={{
            opacity: phase ? 1 : 0,
            transform: phase ? "translateY(0)" : "translateY(14px)",
            transition:
              "opacity .75s ease, transform .75s cubic-bezier(.22,1,.36,1)",
          }}
        >
          <p
            style={{
              fontFamily: C.ss,
              fontWeight: 300,
              fontSize: ".62rem",
              letterSpacing: ".28em",
              textTransform: "uppercase",
              color: C.ghost,
              marginBottom: 10,
            }}
          >
            all six cards opened ✦
          </p>
          <h2
            style={{
              fontFamily: C.sf,
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: "clamp(1.8rem,6vw,2.9rem)",
              color: C.ink,
              lineHeight: 1.12,
              marginBottom: 14,
            }}
          >
            Happy <span style={{ color: C.mid }}>Birthday</span> ✦
          </h2>
          <p
            style={{
              fontFamily: C.sf,
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: "clamp(.86rem,2.2vw,.98rem)",
              color: C.mid,
              lineHeight: 2.15,
              maxWidth: 400,
              margin: "0 auto 22px",
            }}
          >
            Happy Birthday! 🎉✨
Wishing you a day filled with laughter, love, and all the little things that make you truly happy. May this year bring you success, beautiful moments, and endless reasons to smile. Stay blessed, keep shining, and enjoy every second of your special day! 💫😊
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {["🌸", "✦", "💛", "✦", "🌸"].map((ch, i) => (
              <span
                key={i}
                style={{
                  color: i === 2 ? C.peach : C.ghost,
                  fontSize: i === 2 ? "1.15rem" : ".82rem",
                  animation:
                    i === 2
                      ? "btQ 1.8s ease-in-out infinite"
                      : `spQ ${1.5 + i * 0.3}s ease-in-out ${i * 0.2}s infinite`,
                }}
              >
                {ch}
              </span>
            ))}
          </div>
          <p
            style={{
              fontFamily: C.ss,
              fontWeight: 300,
              fontSize: ".80rem",
              letterSpacing: ".1em",
            }}
            className="text-rose-600"
          >
            with so much love 🐘🐰🐦
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN APP
───────────────────────────────────────── */
const CARDS_DATA = [
  {
    emoji: "🌸",
    front: "Your laugh fills every room",
    back: "Completely contagious, entirely unstoppable. It makes everyone around you laugh — every single time.",
    accent: C.peach,
  },
  {
    emoji: "🌿",
    front: "The warmth you carry everywhere",
    back: "People feel seen and safe near you. That's not ordinary — that's one of the rarest gifts.",
    accent: C.sage,
  },
  {
    emoji: "✨",
    front: "Kindness given so freely",
    back: "You give without keeping score. The universe has been quietly keeping track on your behalf.",
    accent: C.honey,
  },
  {
    emoji: "🦋",
    front: "Magic in ordinary moments",
    back: "You make Tuesday afternoons feel like something worth writing about. A genuine superpower.",
    accent: C.sky,
  },
  {
    emoji: "🎯",
    front: "Every dream you're chasing",
    back: "Big, beautiful, worth every bit of effort. This year, may every single one find its way to you.",
    accent: C.lav,
  },
  {
    emoji: "🫶",
    front: "Simply, exactly, you",
    back: "No improvements needed. You are already so wonderfully, completely, perfectly enough.",
    accent: "#fde4ca",
  },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Nunito:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body {
  cursor: none !important;
  background: #1f1612;
}
::selection{background:#f0b8a8;color:#2a1a0e}

@keyframes leafS{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}}
@keyframes fadeInQ{from{opacity:0}to{opacity:1}}
@keyframes ciQ{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes smokeQ{0%{opacity:.4;transform:translateY(0) scale(.9)}100%{opacity:0;transform:translateY(-18px) scale(1.8)}}
@keyframes btQ{0%,100%{transform:scale(1)}20%{transform:scale(1.35)}40%{transform:scale(1)}60%{transform:scale(1.18)}}
@keyframes tailQ{0%,100%{transform:rotate(-20deg)}50%{transform:rotate(20deg)}}
@keyframes legQ{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes earQ{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.68)}}
@keyframes trunkQ{0%,100%{d:path('M-3 76 Q-19 84 -24 100 Q-28 112 -20 116 Q-14 120 -14 110')}50%{d:path('M-3 76 Q-16 82 -20 98 Q-22 108 -16 114 Q-12 118 -14 108')}}
@keyframes hbQ{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-4px) rotate(2deg)}}
@keyframes winkQ{0%,88%,100%{transform:scaleY(1)}94%{transform:scaleY(.08)}}
@keyframes bf1Q{0%{transform:translate(0,0) scaleX(1)}25%{transform:translate(55px,-20px) scaleX(1)}50%{transform:translate(110px,-7px) scaleX(-1)}75%{transform:translate(55px,10px) scaleX(-1)}100%{transform:translate(0,0) scaleX(1)}}
@keyframes bf2Q{0%{transform:translate(0,0) scaleX(-1)}25%{transform:translate(-55px,-18px) scaleX(-1)}50%{transform:translate(-110px,-5px) scaleX(1)}75%{transform:translate(-55px,12px) scaleX(1)}100%{transform:translate(0,0) scaleX(-1)}}
@keyframes wingQ{0%,100%{transform:scaleY(1)}50%{transform:scaleY(-.3)}}
@keyframes hopQ{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes bunnyQ{0%,100%{transform:translateY(0) scaleY(1)}40%{transform:translateY(-16px) scaleY(1.07)}60%{transform:translateY(-14px) scaleY(1.07)}}
@keyframes earLQ{0%,100%{transform:rotate(0)}50%{transform:rotate(-13deg)}}
@keyframes earRQ{0%,100%{transform:rotate(0)}50%{transform:rotate(13deg)}}
@keyframes spQ{0%,100%{opacity:0;transform:scale(0) rotate(0)}50%{opacity:1;transform:scale(1) rotate(180deg)}}
@keyframes cbgQ{from{opacity:0}to{opacity:1}}
@keyframes cinQ{0%{opacity:0;transform:scale(.62) translateY(40px)}68%{transform:scale(1.04) translateY(-3px)}100%{opacity:1;transform:scale(1) translateY(0)}}
@keyframes scrollQ{0%,100%{opacity:.22;transform:translateX(-50%) translateY(0)}50%{opacity:.42;transform:translateX(-50%) translateY(5px)}}
`;

export default function App() {
  const [mt, setMt] = useState(false);
  const [bl, setBl] = useState(false);
  const [cel, setCel] = useState(false);
  const [flowers, setFlowers] = useState([]);
  const [ripples, setRipples] = useState([]);
  const [toast, setToast] = useState({ m: "", s: false });
  const [fin, setFin] = useState(false);
  const [fcd, setFcd] = useState(new Set());
  const [ttap, setTtap] = useState(0);
  const [htap, setHtap] = useState(0);
  const [ki, setKi] = useState(0);
  const typd = useRef(""),
    tref = useRef(null);
  const KN = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ];

  useEffect(() => {
    setTimeout(() => setMt(true), 60);
  }, []);
  const audioRef = useRef(null);
  const birthdayAudioRef = useRef(null);

  // useEffect(() => {
  //   const playAudio = () => {
  //     if (audioRef.current) {
  //       audioRef.current.play().catch(() => {});
  //     }
  //     window.removeEventListener("click", playAudio);
  //   };

  //   window.addEventListener("click", playAudio);

  //   return () => window.removeEventListener("click", playAudio);
  // }, []);

  const shT = useCallback((m, d = 2600) => {
    clearTimeout(tref.current);
    setToast({ m, s: true });
    tref.current = setTimeout(() => setToast((t) => ({ ...t, s: false })), d);
  }, []);

  const addFlower = useCallback((x, y) => {
    const [c, ic] = rndItem(BLOOM_PALETTE);
    const sz = rnd(0.72, 1.18),
      id = uid();
    setFlowers((p) => [...p, { id, x, y, c, ic, sz }]);
    setTimeout(() => setFlowers((p) => p.filter((f) => f.id !== id)), 5000);
  }, []);

  const addRipple = useCallback((x, y) => {
    const id = uid();
    setRipples((p) => [...p, { id, x, y }]);
    setTimeout(() => setRipples((p) => p.filter((r) => r.id !== id)), 800);
  }, []);

  const hClick = useCallback(
    (e) => {
      if (e.target.closest("button,.nb")) return;
      const { clientX: x, clientY: y } = e;
      addFlower(x, y);
      addRipple(x, y);
      burst(x, y, 14);
      shT("🌸", 700);
    },
    [addFlower, addRipple, shT],
  );

  const hBlow = useCallback(
    (e) => {
      e.stopPropagation();
      if (!bl) {
        setBl(true);
        shT("💨 make a wish...", 2200);
        burst(e.clientX, e.clientY, 22);
        setTimeout(() => {
          setCel(true);
          shT("happy birthday 💛");
        }, 1800);
        // 🎧 PLAY MUSIC HERE
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }

        setTimeout(() => {
          setCel(true);
          shT("happy birthday 💛");
        }, 1800);
      } else {
        setBl(false);
        setCel(false);
        shT("🕯️ relit ✨");
        audioRef.current?.pause();
      }
    },
    [bl, shT],
  );

  const hTitle = useCallback(
    (e) => {
      e.stopPropagation();
      burst(e.clientX, e.clientY, 12);
      const n = ttap + 1;
      setTtap(n);
      if (n >= 10) {
        shT("🌈 rainbow unlocked!");
        setTtap(0);
      } else shT(`${n}/10 ✦`);
    },
    [ttap, shT],
  );

  const hHeart = useCallback(
    (e) => {
      e.stopPropagation();
      burst(e.clientX, e.clientY, 10);
      const n = htap + 1;
      setHtap(n);
      if (n >= 10) {
        shT("💕 overflowing hearts!");
        setHtap(0);
      } else shT(`♡ ${n}/10`);
    },
    [htap, shT],
  );

  const hCard = useCallback(
    (i) => {
      const nx = new Set([...fcd, i]);
      setFcd(nx);
      if (nx.size === 6)
        setTimeout(() => {
          setFin(true);
          shT("🎉 the animals are here!", 1800);
        }, 700);
    },
    [fcd, shT],
  );

  useEffect(() => {
    const h = (e) => {
      if (e.key === KN[ki]) {
        const n = ki + 1;
        if (n === KN.length) {
          shT("🕹️ Konami! Legendary! 🌈 secret unlocked!");
          document.body.style.filter = "hue-rotate(120deg)";
          setKi(0);
        } else setKi(n);
      } else setKi(0);
      if (e.key.length === 1) {
        typd.current = (typd.current + e.key.toLowerCase()).slice(-12);
        if (typd.current.includes("birthday")) {
          typd.current = "";
          // shT("🎵 you spelled it! ✨");
          shT("🎵 playing birthday song ✨");

          // if (audioRef.current) {
          //   audioRef.current.currentTime = 0;
          //   audioRef.current.play().catch(() => {
          //     shT("🔊 tap anywhere to enable sound");
          //   });
          // }
          shT("🎂 happy birthday!!!");
          birthdayAudioRef.current?.play();
          burst(innerWidth / 2, innerHeight / 2, 50);
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [ki, shT]);

  return (
    <>
      <audio ref={audioRef} loop>
        <source src="/romantic.mpeg" type="audio/mpeg" />
      </audio>
      <audio ref={birthdayAudioRef}>
        <source src="/HappyBirthday.mpeg" type="audio/mpeg" />
      </audio>
      <style>{CSS}</style>
      <Cursor />
      <ParticleCanvas />

      {flowers.map((f) => (
        <SpawnedFlower
          key={f.id}
          x={f.x}
          y={f.y}
          color={f.c}
          inner={f.ic}
          size={f.sz}
          onDone={() => setFlowers((p) => p.filter((x) => x.id !== f.id))}
        />
      ))}
      {ripples.map((r) => (
        <D3Ripple
          key={r.id}
          x={r.x}
          y={r.y}
          onDone={() => setRipples((p) => p.filter((x) => x.id !== r.id))}
        />
      ))}

      <div
        onClick={hClick}
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg, #fff3f0 0%, #fffaf7 100%)",
          position: "relative",
          overflowX: "hidden",
        }}
      >
        {/* Soft bg orbs */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "4%",
              left: "-6%",
              width: 480,
              height: 480,
              borderRadius: "50%",
              background:
                "radial-gradient(circle,rgba(240,184,168,.18) 0%,transparent 70%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "2%",
              right: "-6%",
              width: 380,
              height: 380,
              borderRadius: "50%",
              background:
                "radial-gradient(circle,rgba(168,200,232,.14) 0%,transparent 70%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "45%",
              left: "48%",
              width: 300,
              height: 300,
              borderRadius: "50%",
              background:
                "radial-gradient(circle,rgba(200,176,224,.1) 0%,transparent 70%)",
              transform: "translate(-50%,-50%)",
            }}
          />
        </div>

        {/* ── HERO ── */}
        <section
          style={{
            position: "relative",
            zIndex: 10,
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: `radial-gradient(circle at 30% 20%, rgba(242,167,160,0.25), transparent 60%), radial-gradient(circle at 70% 80%, rgba(214,196,240,0.18), transparent 60%), linear-gradient(180deg, #fff3f0 0%, #fffaf7 100%)`,
            padding: "80px 24px 60px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: C.ss,
              fontWeight: 500,
              fontSize: ".80rem",
              letterSpacing: ".32em",
              textTransform: "uppercase",
              color: C.rose,
              marginBottom: 20,
              opacity: mt ? 1 : 0,
              animation: mt ? "ciQ .9s .1s both" : "none",
            }}
          >
            
          </p>

          <h1
            className="nb"
            onClick={hTitle}
            style={{
              fontFamily: C.sf,
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: "clamp(3rem,12vw,7.2rem)",
              color: C.ink,
              lineHeight: 1,
              letterSpacing: "-.01em",
              marginBottom: 6,
              cursor: "pointer",
              userSelect: "none",
              opacity: mt ? 1 : 0,
              animation: mt ? "ciQ .95s .24s both" : "none",
            }}
          >
            Happy <em style={{ color: C.accent }}>Birthday</em>
          </h1>

          <p
            className="nb"
            onClick={(e) => {
              e.stopPropagation();
              addFlower(e.clientX, e.clientY);
              burst(e.clientX, e.clientY, 10);
              shT("💛");
            }}
            style={{
              fontFamily: C.sf,
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: "clamp(4.1rem,3.5vw,1.95rem)",
              color: C.mid,
              marginBottom: 52,
              cursor: "pointer",
              userSelect: "none",
              letterSpacing: ".02em",
              opacity: mt ? 1 : 0,
              animation: mt ? "ciQ .95s .38s both" : "none",
            }}
          >
            KALYANI
          </p>

          <div
            style={{
              width: "min(180px,48%)",
              height: 1,
              margin: "0 auto 54px",
              background: `linear-gradient(to right,transparent,${C.ghost},transparent)`,
              opacity: mt ? 1 : 0,
              animation: mt ? "fadeInQ 1.2s .55s both" : "none",
            }}
          />

          <div
            className="nb"
            style={{
              opacity: mt ? 1 : 0,
              animation: mt ? "ciQ 1s .68s both" : "none",
            }}
          >
            <Cake blown={bl} onClick={hBlow} />
          </div>

          {cel && (
            <p
              style={{
                fontFamily: C.sf,
                fontStyle: "italic",
                fontWeight: 300,
                fontSize: ".92rem",
                color: C.mid,
                marginTop: 14,
                animation: "ciQ .5s ease both",
              }}
            >
              your wish is already on its way ✨
            </p>
          )}

          <button
            className="nb"
            onClick={hBlow}
            style={{
              marginTop: 28,
              background: bl ? "transparent" : C.ink,
              color: bl ? C.mid : "#fef0e0",
              border: bl ? `1px solid ${C.ghost}` : "none",
              borderRadius: 100,
              padding: "11px 38px",
              cursor: "none",
              fontFamily: C.ss,
              fontWeight: 300,
              fontSize: ".74rem",
              letterSpacing: ".16em",
              transition: "all .45s cubic-bezier(.22,1,.36,1)",
              boxShadow: bl ? "none" : "0 8px 28px rgba(42,26,14,.18)",
              opacity: mt ? 1 : 0,
              animation: mt ? "ciQ .95s .95s both" : "none",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "translateY(-3px) scale(1.03)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
          >
            {bl ? "light again" : "blow the candles"}
          </button>

          <p
            style={{
              fontFamily: C.ss,
              fontWeight: 300,
              fontSize: ".68rem",
              letterSpacing: ".14em",
              marginTop: 20,
              opacity: mt ? 1 : 0,
              animation: mt ? "ciQ 1s 1.3s both" : "none",
            }}
            className="text-rose-600"
          >
            touch anywhere · flowers bloom
          </p>

          <div
            style={{
              position: "absolute",
              bottom: 22,
              left: "50%",
              pointerEvents: "none",
              fontFamily: C.ss,
              fontWeight: 300,
              fontSize: ".58rem",
              letterSpacing: ".2em",
              color: "rgba(138,106,80,.26)",
              whiteSpace: "nowrap",
              animation: "scrollQ 2.4s ease-in-out infinite",
            }}
          >
            scroll ↓
          </div>
        </section>

        {/* FLOWER ROW */}
        <div style={{ position: "relative", zIndex: 10, overflow: "visible" }}>
          <FlowerRow />
        </div>

        {/* QUOTE */}
        <section
          style={{
            position: "relative",
            zIndex: 10,
            padding: "72px 32px 64px",
            maxWidth: 480,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: C.sf,
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: "clamp(1rem,2.8vw,1.28rem)",
              color: C.mid,
              lineHeight: 2.15,
            }}
          >
            "Some people make the whole world softer
            <br />
            just by existing in it."
          </p>
          <div
            style={{
              width: 24,
              height: 1,
              background: C.ghost,
              margin: "32px auto 0",
            }}
          />
        </section>

        {/* CARDS */}
        <section
          style={{
            position: "relative",
            zIndex: 10,
            padding: "8px 28px 88px",
            maxWidth: 880,
            margin: "0 auto",
          }}
        >
          <p
            style={{
              fontFamily: C.sf,
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: "clamp(1.3rem,3.8vw,1.9rem)",
              color: C.ink,
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            six little things
          </p>
          <p
            style={{
              fontFamily: C.ss,
              fontWeight: 300,
              fontSize: ".80rem",
              textAlign: "center",
              letterSpacing: ".12em",
              marginBottom: 16,
            }}
            className="text-rose-600"
          >
            tap to flip · flip all six for a surprise 🎉
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginBottom: 44,
            }}
          >
            {CARDS_DATA.map((_, i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: fcd.has(i) ? C.mid : C.ghost,
                  transform: fcd.has(i) ? "scale(1.35)" : "scale(1)",
                  transition:
                    "background .4s, transform .35s cubic-bezier(.34,1.56,.64,1)",
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
              gap: 16,
            }}
          >
            {CARDS_DATA.map((c, i) => (
              <div key={i} className="nb">
                <WishCard
                  {...c}
                  delay={0.08 + i * 0.08}
                  revealed={fcd.has(i)}
                  onReveal={() => hCard(i)}
                />
              </div>
            ))}
          </div>
          {fcd.size > 0 && fcd.size < 6 && (
            <p
              style={{
                textAlign: "center",
                fontFamily: C.ss,
                fontWeight: 300,
                fontSize: ".62rem",
                color: C.ghost,
                letterSpacing: ".1em",
                marginTop: 26,
                animation: "ciQ .5s ease both",
              }}
            >
              {6 - fcd.size} more {6 - fcd.size === 1 ? "card" : "cards"} to
              unlock the surprise...
            </p>
          )}
        </section>

        {/* CLOSING NOTE */}
        <section
          style={{
            position: "relative",
            zIndex: 10,
            padding: "0 28px 80px",
            maxWidth: 490,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div
            style={{
              background: "rgba(172, 79, 65, 0.1)",
              borderRadius: 24,
              padding: "44px 32px",
              border: "1px solid rgba(224,178,138,0.18)",
              boxShadow: "0 2px 28px rgba(196,168,130,.1)",
            }}
          >
            <p
              style={{
                fontFamily: C.sf,
                fontStyle: "italic",
                fontWeight: 300,
                fontSize: "clamp(.88rem,2.2vw,.98rem)",
                color: "#7a5040",
                lineHeight: 2.2,
              }}
            >
              May this year bring you everything gentle,
              <br />
              everything golden, and everything
              <br />
              you've been quietly hoping for.
            </p>
            <div
              style={{
                marginTop: 28,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: `linear-gradient(to right,transparent,${C.ghost})`,
                }}
              />
              <span
                style={{
                  fontFamily: C.ss,
                  fontWeight: 300,
                  fontSize: ".66rem",
                  letterSpacing: ".12em",
                }}
                className="text-rose-600"
              >
                with love
              </span>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: `linear-gradient(to left,transparent,${C.ghost})`,
                }}
              />
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer
          style={{
            position: "relative",
            zIndex: 10,
            padding: "18px 24px 28px",
            borderTop: "1px solid rgba(210,190,168,.12)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: C.ss,
              fontWeight: 300,
              fontSize: ".80rem",
              letterSpacing: ".16em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
            className="text-rose-600"
          >
            made with
            <span
              className="nb text-rose-600"
              onClick={hHeart}
              style={{
                fontSize: "1rem",
                cursor: "none",
                display: "inline-block",
                transition: "transform .22s",
              }}
              onMouseEnter={(e) => (e.target.style.transform = "scale(1.6)")}
              onMouseLeave={(e) => (e.target.style.transform = "")}
            >
              ♡
            </span>
            just for you
          </p>
          <p
            style={{
              fontFamily: C.ss,
              fontWeight: 300,
              fontSize: ".85rem",
              marginTop: 5,
              letterSpacing: ".08em",
            }}
            className="text-rose-600"
          >
            touch · flip all 6 · ↑↑↓↓←→←→ba · type "birthday"
          </p>
        </footer>

        <Toast msg={toast.m} show={toast.s} />
        {fin && <Finale onClose={() => setFin(false)} />}
      </div>
    </>
  );
}
