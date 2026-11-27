// Canyon Courier — the renderer: a pseudo-3D chase view over a winding canyon.
// The camera rides behind the plane; ground, walls, rings and the runway are
// projected with a simple perspective (screen scale = CAM / distance ahead), so the
// canyon winds, the ground rushes by and the rings grow as the plane closes on them.

import {
  CANYON_HALF,
  DRAW_AHEAD,
  FIELD,
  FONT,
  FUEL,
  PLANE,
  PLANE_COLORS,
  RING,
  SEGMENT,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FEET_PER_METRE = 3.28084;
/** Focal length of the chase camera, in pixels. */
const CAM = 430;
const CX = FIELD.width / 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function createRenderer(canvas) {
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const ctx = canvas.getContext('2d');

  function project(lateral, heightMetres, z, plane) {
    const p = CAM / Math.max(24, z);
    return {
      x: CX + (lateral - plane.x) * p,
      y: FIELD.horizonY + (plane.alt / FEET_PER_METRE - heightMetres) * p,
      s: p,
    };
  }

  function drawSky(world, time) {
    const palette = world.palette();
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.horizonY + 40);
    gradient.addColorStop(0, palette.skyTop);
    gradient.addColorStop(0.55, palette.skyMid);
    gradient.addColorStop(1, palette.skyLow);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.horizonY + 40);

    // Sun with a soft halo, fixed in the sky, drifting almost imperceptibly.
    const sunX = FIELD.width * 0.3 + Math.sin(time * 0.02) * 8;
    const sunY = 92;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    glow.addColorStop(0, palette.sunGlow);
    glow.addColorStop(1, 'rgba(255, 200, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
    ctx.fillStyle = palette.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();

    // Clouds: three parallax layers, drifting with distance flown.
    drawClouds(world, time);
    // Mountain silhouettes along the horizon, two layers of parallax.
    drawMountains(world, 0.12, palette.mountainFar, 150, 46);
    drawMountains(world, 0.3, palette.mountainNear, 90, 78);
  }

  function drawClouds(world, time) {
    const drift = (world.state.distance * 0.02 + time * 6) % (FIELD.width + 420);
    const clouds = [
      { x: 180, y: 84, w: 190, h: 30, speed: 1 },
      { x: 620, y: 140, w: 240, h: 36, speed: 0.6 },
      { x: 1020, y: 70, w: 160, h: 26, speed: 1.4 },
      { x: 420, y: 190, w: 210, h: 30, speed: 0.8 },
    ];
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (const cloud of clouds) {
      let x = (cloud.x - drift * cloud.speed) % (FIELD.width + 420);
      if (x < -260) x += FIELD.width + 420;
      ctx.beginPath();
      ctx.ellipse(x, cloud.y, cloud.w / 2, cloud.h / 2, 0, 0, Math.PI * 2);
      ctx.ellipse(x + cloud.w * 0.28, cloud.y + 8, cloud.w * 0.32, cloud.h * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(x - cloud.w * 0.3, cloud.y + 10, cloud.w * 0.26, cloud.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMountains(world, factor, color, base, amp) {
    const offset = (world.state.distance * factor) % 640;
    // A rolling ridge: two slow sines, smoothed through midpoints so no peak is a spike.
    const points = [];
    for (let x = -40; x <= FIELD.width + 40; x += 40) {
      const peak = base + Math.sin((x + offset) * 0.011) * amp + Math.sin((x + offset) * 0.027 + 1.7) * amp * 0.4;
      points.push([x, FIELD.horizonY - Math.max(10, peak)]);
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-40, FIELD.horizonY + 2);
    ctx.lineTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length - 1; i += 1) {
      const mx = (points[i][0] + points[i + 1][0]) / 2;
      const my = (points[i][1] + points[i + 1][1]) / 2;
      ctx.quadraticCurveTo(points[i][0], points[i][1], mx, my);
    }
    ctx.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
    ctx.lineTo(FIELD.width + 40, FIELD.horizonY + 2);
    ctx.closePath();
    ctx.fill();
  }

  /** The canyon floor and walls, drawn far-to-near so nearer slices cover farther ones. */
  function drawGround(world) {
    const palette = world.palette();
    const state = world.state;
    const plane = { x: state.x, alt: state.alt };
    const baseIndex = Math.floor(state.distance / SEGMENT);

    // The slices only reach DRAW_AHEAD forward; below the horizon, paint the far
    // valley floor first so no unpainted band ever shows between horizon and ground.
    ctx.fillStyle = shade(palette.groundFar, 0.55);
    ctx.fillRect(0, FIELD.horizonY, FIELD.width, FIELD.height - FIELD.horizonY);

    for (let i = DRAW_AHEAD - 1; i >= 0; i -= 1) {
      const index = baseIndex + i;
      const segment = world.segmentAt((index + 0.5) * SEGMENT);
      const z0 = index * SEGMENT - state.distance;
      const z1 = (index + 1) * SEGMENT - state.distance;
      if (z1 < 30) continue;
      const next = world.segmentAt((index + 1.5) * SEGMENT);
      const c0 = segment.center;
      const c1 = next.center;
      const p00 = project(c0 - CANYON_HALF, 0, z0, plane);
      const p01 = project(c0 + CANYON_HALF, 0, z0, plane);
      const p10 = project(c1 - CANYON_HALF, 0, z1, plane);
      const p11 = project(c1 + CANYON_HALF, 0, z1, plane);
      const depth = clamp(1 - i / DRAW_AHEAD, 0.25, 1);
      const groundColor = segment.field === 0 ? palette.fieldA : palette.fieldB;
      ctx.fillStyle = shade(groundColor, depth);
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.closePath();
      ctx.fill();
      // A faint edge line where this slice meets the next: the scrolling reads as speed.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.stroke();

      // River: a blue band wandering across the floor.
      if (segment.river) {
        const r0 = c0 + segment.riverX * CANYON_HALF;
        const r1 = c1 + segment.riverX * CANYON_HALF;
        const w = 16;
        const a = project(r0 - w, 0, z0, plane);
        const b = project(r0 + w, 0, z0, plane);
        const c = project(r1 + w, 0, z1, plane);
        const d = project(r1 - w, 0, z1, plane);
        ctx.fillStyle = shade(palette.river, depth);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
      }

      // Road: a grey strip with a dashed centre line.
      if (segment.road) {
        const r0 = c0 + segment.roadX * CANYON_HALF;
        const r1 = c1 + segment.roadX * CANYON_HALF;
        const w = 7;
        const a = project(r0 - w, 0, z0, plane);
        const b = project(r0 + w, 0, z0, plane);
        const c = project(r1 + w, 0, z1, plane);
        const d = project(r1 - w, 0, z1, plane);
        ctx.fillStyle = shade(palette.road, depth);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
      }

      drawWall(world, plane, segment, next, c0, c1, z0, z1, -1, depth, palette);
      drawWall(world, plane, segment, next, c0, c1, z0, z1, 1, depth, palette);
    }
  }

  /** One canyon wall: a rock face rising from the floor edge outward and up. */
  function drawWall(world, plane, segment, next, c0, c1, z0, z1, side, depth, palette) {
    const base0 = c0 + side * CANYON_HALF;
    const base1 = c1 + side * CANYON_HALF;
    const top0 = c0 + side * (CANYON_HALF + 34);
    const top1 = c1 + side * (CANYON_HALF + 34);
    const h0 = side < 0 ? segment.wallL : segment.wallR;
    const h1 = side < 0 ? next.wallL : next.wallR;
    const b00 = project(base0, 0, z0, plane);
    const b01 = project(base1, 0, z1, plane);
    const t01 = project(top1, h1, z1, plane);
    const t00 = project(top0, h0, z0, plane);
    const rock = side < 0 ? palette.rockNear : palette.rockFar;
    // Sunlit near the rim, dark toward the floor — one fixed screen-space gradient
    // so neighbouring slices blend into a single face instead of banding.
    const topColor = light(rock, 0.3 * depth);
    const bottomColor = shade(rock, depth * 0.4);
    const grad = ctx.createLinearGradient(0, FIELD.horizonY - 120, 0, FIELD.height);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(b00.x, b00.y);
    ctx.lineTo(b01.x, b01.y);
    ctx.lineTo(t01.x, t01.y);
    ctx.lineTo(t00.x, t00.y);
    ctx.closePath();
    ctx.fill();
    // Sunlit rim along the top edge.
    ctx.strokeStyle = 'rgba(255, 214, 160, 0.4)';
    ctx.lineWidth = Math.max(1, 0.8 * b00.s);
    ctx.beginPath();
    ctx.moveTo(t00.x, t00.y);
    ctx.lineTo(t01.x, t01.y);
    ctx.stroke();
    // A thin, faint strata line halfway up the face.
    const m00 = project(base0 + side * 17, h0 * 0.45, z0, plane);
    const m01 = project(base1 + side * 17, h1 * 0.45, z1, plane);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = Math.max(1, 0.5 * b00.s);
    ctx.beginPath();
    ctx.moveTo(m00.x, m00.y);
    ctx.lineTo(m01.x, m01.y);
    ctx.stroke();
  }

  /** Darken a hex colour toward black by factor 0..1. */
  function shade(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const f = clamp(factor, 0, 1);
    const mix = (v) => Math.round(v * f + 12 * (1 - f));
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
  }

  /** Lighten a hex colour toward white by factor 0..1. */
  function light(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const f = clamp(factor, 0, 1);
    const mix = (v) => Math.round(v + (255 - v) * f);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
  }

  /** The runway: a dark strip on the floor with a dashed centre line and threshold bars. */
  function drawRunway(world) {
    const state = world.state;
    if (!state.runway) return;
    const palette = world.palette();
    const plane = { x: state.x, alt: state.alt };
    const { d0, d1 } = state.runway;
    const halfWidth = 13;
    for (let i = DRAW_AHEAD - 1; i >= 0; i -= 1) {
      const baseIndex = Math.floor(state.distance / SEGMENT);
      const index = baseIndex + i;
      const z0 = index * SEGMENT - state.distance;
      const z1 = (index + 1) * SEGMENT - state.distance;
      const segD0 = index * SEGMENT;
      const segD1 = (index + 1) * SEGMENT;
      if (segD1 < d0 || segD0 > d1 || z1 < 30) continue;
      const c0 = world.centerAt((index + 0.5) * SEGMENT);
      const c1 = world.centerAt((index + 1.5) * SEGMENT);
      const a = project(c0 - halfWidth, 0, z0, plane);
      const b = project(c0 + halfWidth, 0, z0, plane);
      const c = project(c1 + halfWidth, 0, z1, plane);
      const d = project(c1 - halfWidth, 0, z1, plane);
      ctx.fillStyle = palette.runway;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      // Centre dashes, one per slice.
      const m0 = project(c0, 0, z0, plane);
      const m1 = project(c1, 0, z1, plane);
      ctx.strokeStyle = palette.runwayLine;
      ctx.lineWidth = Math.max(1.5, 3 * m0.s);
      ctx.beginPath();
      ctx.moveTo(lerp(m0.x, m1.x, 0.2), lerp(m0.y, m1.y, 0.2));
      ctx.lineTo(lerp(m0.x, m1.x, 0.8), lerp(m0.y, m1.y, 0.8));
      ctx.stroke();
      // Threshold bars at the runway start.
      if (segD0 <= d0 && segD1 > d0) {
        ctx.strokeStyle = palette.runwayLine;
        ctx.lineWidth = Math.max(2, 5 * m0.s);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  /** The rings: glowing circles floating ahead; hit ones are skipped. */
  function drawRings(world) {
    const state = world.state;
    const plane = { x: state.x, alt: state.alt };
    const far = state.distance + DRAW_AHEAD * SEGMENT;
    for (const ring of state.rings) {
      if (ring.hit || ring.d < state.distance - 20 || ring.d > far) continue;
      const z = ring.d - state.distance;
      const centre = world.centerAt(ring.d) + ring.x;
      const p = project(centre, ring.h / FEET_PER_METRE, z, plane);
      const rx = RING.radius * p.s;
      const ry = rx * 0.94;
      if (rx < 2 || p.y < -80 || p.y > FIELD.height + 80) continue;
      ctx.save();
      ctx.shadowColor = '#ffb347';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = Math.max(2, rx * 0.16);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff3d0';
      ctx.lineWidth = Math.max(1, rx * 0.05);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 179, 71, 0.08)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawNextRingArrow(world);
  }

  /** An edge arrow pointing at the next unhit ring when it is off-screen. */
  function drawNextRingArrow(world) {
    const state = world.state;
    const next = state.rings.find((ring) => !ring.hit && ring.d > state.distance - 20);
    if (!next) return;
    const plane = { x: state.x, alt: state.alt };
    const z = Math.max(30, next.d - state.distance);
    const centre = world.centerAt(next.d) + next.x;
    const p = project(centre, next.h / FEET_PER_METRE, z, plane);
    if (p.x > 60 && p.x < FIELD.width - 60 && p.y > 60 && p.y < FIELD.height - 60) return;
    const ax = clamp(p.x, 70, FIELD.width - 70);
    const ay = clamp(p.y, 70, FIELD.height - 70);
    const angle = Math.atan2(p.y - ay, p.x - ax);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** The drop target: pulsing concentric circles painted on the ground. */
  function drawDropTarget(world, time) {
    const state = world.state;
    const target = state.dropTarget;
    if (!target || target.scored) return;
    const plane = { x: state.x, alt: state.alt };
    const z = target.d - state.distance;
    if (z < 30 || z > DRAW_AHEAD * SEGMENT) return;
    const centre = world.centerAt(target.d) + target.x;
    const p = project(centre, 0, z, plane);
    const rx = 26 * p.s;
    const ry = rx * 0.34;
    if (rx < 2) return;
    const pulse = 0.6 + Math.sin(time * 5) * 0.4;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 120, 60, ${0.55 + pulse * 0.35})`;
    ctx.lineWidth = Math.max(2, rx * 0.09);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 120, 60, ${0.25 + pulse * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** The plane, seen from behind and slightly above, banking with the turn. */
  function drawPlane(world, time) {
    const state = world.state;
    const bob = Math.sin(time * 2.1) * 3;
    const px = CX;
    const py = FIELD.height - 128 + bob;
    const bankAngle = (state.bank * PLANE.bankDegrees * Math.PI) / 180;
    const pitchLift = -state.pitch * 10;
    ctx.save();
    ctx.translate(px, py + pitchLift);
    ctx.rotate(bankAngle);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 8;
    // Main wings.
    ctx.fillStyle = PLANE_COLORS.wing;
    ctx.beginPath();
    ctx.moveTo(-128, 6);
    ctx.quadraticCurveTo(-70, -12, -16, -2);
    ctx.lineTo(16, -2);
    ctx.quadraticCurveTo(70, -12, 128, 6);
    ctx.quadraticCurveTo(70, 14, 16, 10);
    ctx.lineTo(-16, 10);
    ctx.quadraticCurveTo(-70, 14, -128, 6);
    ctx.closePath();
    ctx.fill();
    // Fuselage: tail at the bottom, nose tapering away up-screen.
    ctx.fillStyle = PLANE_COLORS.fuselage;
    ctx.beginPath();
    ctx.moveTo(-14, 58);
    ctx.quadraticCurveTo(-18, 10, -10, -52);
    ctx.quadraticCurveTo(0, -62, 10, -52);
    ctx.quadraticCurveTo(18, 10, 14, 58);
    ctx.quadraticCurveTo(0, 66, -14, 58);
    ctx.closePath();
    ctx.fill();
    // Cheatline stripe down the fuselage.
    ctx.fillStyle = PLANE_COLORS.stripe;
    ctx.beginPath();
    ctx.moveTo(-4, 52);
    ctx.lineTo(-3, -48);
    ctx.lineTo(3, -48);
    ctx.lineTo(4, 52);
    ctx.closePath();
    ctx.fill();
    // Canopy.
    ctx.fillStyle = PLANE_COLORS.canopy;
    ctx.beginPath();
    ctx.ellipse(0, -30, 9, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-3, -36, 3, 7, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // Tail fins.
    ctx.fillStyle = PLANE_COLORS.tail;
    ctx.beginPath();
    ctx.moveTo(-12, 52);
    ctx.lineTo(-34, 66);
    ctx.lineTo(-30, 74);
    ctx.lineTo(-8, 62);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(12, 52);
    ctx.lineTo(34, 66);
    ctx.lineTo(30, 74);
    ctx.lineTo(8, 62);
    ctx.closePath();
    ctx.fill();
    // Prop blur ahead of the nose.
    ctx.fillStyle = PLANE_COLORS.prop;
    ctx.beginPath();
    ctx.ellipse(0, -58, 26, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Exhaust shimmer behind the tail.
    if (state.throttle > 0.25) {
      ctx.save();
      ctx.globalAlpha = 0.25 + state.throttle * 0.3;
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.ellipse(px, py + 74, 10 + state.throttle * 8, 4 + Math.sin(time * 31) * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** Sparks and dust from scrapes. */
  function drawParticles(world) {
    for (const p of world.state.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10, 16, 28, 0.62)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
  }

  function label(text, x, y, size, color, align = 'left', glow = false) {
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  function smallLabel(text, x, y, size, color, align = 'left') {
    ctx.font = `600 ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  /** The flight instruments: altitude, speed, heading, fuel, damage, score. */
  function drawHud(world, best, screen) {
    const state = world.state;
    const palette = world.palette();
    const headingNames = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const headingText = `${String(Math.round(state.heading)).padStart(3, '0')}° ${headingNames[Math.round(state.heading / 45) % 8]}`;

    // Top-left instrument block: altitude, speed, heading.
    panel(18, 16, 268, 92);
    smallLabel('ALTITUDE', 34, 40, 13, '#9fb4d8');
    label(`${Math.round(state.alt)} ft`, 34, 70, 26, '#eef4ff');
    smallLabel('SPEED', 150, 40, 13, '#9fb4d8');
    label(`${Math.round(state.speed)} kt`, 150, 70, 26, '#eef4ff');
    smallLabel('HEADING', 34, 100, 13, '#9fb4d8');
    label(headingText, 120, 100, 20, '#ffd98a');

    // Top-right: score, best, combo.
    panel(FIELD.width - 286, 16, 268, 92);
    smallLabel('SCORE', FIELD.width - 270, 40, 13, '#9fb4d8');
    label(`${state.score}`, FIELD.width - 270, 70, 26, '#eef4ff');
    smallLabel('BEST', FIELD.width - 150, 40, 13, '#9fb4d8');
    label(`${Math.max(best, state.score)}`, FIELD.width - 150, 70, 26, '#eef4ff');
    if (state.combo > 1) {
      label(`COMBO x${state.combo}`, FIELD.width - 34, 100, 20, '#ffb347', 'right', true);
    }

    // Mission line, top centre.
    if (state.mission) {
      const text = state.mission.label;
      ctx.font = `700 19px ${FONT}`;
      const w = ctx.measureText(text).width + 36;
      panel(CX - w / 2, 16, w, 38);
      label(text, CX, 43, 19, '#ffe9b8', 'center');
      if (state.mission.type === 'rings') {
        smallLabel(
          `${state.mission.ringsHit}/${state.mission.ringsTotal} rings  ·  ${Math.max(0, Math.ceil(state.mission.timeLeft))}s`,
          CX,
          78,
          15,
          '#ffd98a',
          'center',
        );
      }
    }

    // Altitude tape, left edge.
    drawTape(18, 140, 46, 300, state.alt, 3200, 'ft', '#7fd0ff');
    // Speed tape, right edge.
    drawTape(FIELD.width - 64, 140, 46, 300, state.speed, 240, 'kt', '#ffd98a');

    // Fuel and throttle, bottom-left.
    panel(18, FIELD.height - 86, 240, 68);
    smallLabel('FUEL', 34, FIELD.height - 62, 13, '#9fb4d8');
    drawBar(34, FIELD.height - 52, 208, 12, state.fuel / 100, state.fuel < FUEL.lowAt ? '#ff5a4e' : '#7fd0ff');
    smallLabel('THROTTLE', 34, FIELD.height - 28, 13, '#9fb4d8');
    drawBar(108, FIELD.height - 36, 134, 10, state.throttle, '#ffb347');

    // Damage, bottom-right.
    panel(FIELD.width - 258, FIELD.height - 86, 240, 68);
    smallLabel('AIRFRAME', FIELD.width - 242, FIELD.height - 62, 13, '#9fb4d8');
    drawBar(FIELD.width - 242, FIELD.height - 52, 208, 12, 1 - state.damage / 100, state.damage > 60 ? '#ff5a4e' : '#8be28b');
    smallLabel(`LEVEL ${state.level} · ${palette.name.toUpperCase()}`, FIELD.width - 242, FIELD.height - 28, 13, '#c8d4e8');

    // Artificial horizon, bottom centre.
    drawArtificialHorizon(world);

    // Centre reticle for ring aiming.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(CX, FIELD.height - 300, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CX - 16, FIELD.height - 300);
    ctx.lineTo(CX - 6, FIELD.height - 300);
    ctx.moveTo(CX + 6, FIELD.height - 300);
    ctx.lineTo(CX + 16, FIELD.height - 300);
    ctx.stroke();

    // Warnings, only while actually flying.
    if (screen === SCREEN_PLAY && state.fuel < FUEL.lowAt && Math.floor(performance.now() / 400) % 2 === 0) {
      label('LOW FUEL', CX, 150, 30, '#ff5a4e', 'center', true);
    }
    if (screen === SCREEN_PLAY && state.alt < 260 && state.alt > 0 && Math.floor(performance.now() / 400) % 2 === 0) {
      label('TERRAIN', CX, 186, 30, '#ffb347', 'center', true);
    }

    // Mission message banner, only while actually flying.
    if (screen === SCREEN_PLAY && state.messageTime > 0 && state.message) {
      const alpha = clamp(state.messageTime / 0.6, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = `700 30px ${FONT}`;
      const w = ctx.measureText(state.message).width + 48;
      panel(CX - w / 2, 210, w, 52);
      label(state.message, CX, 246, 30, '#ffe9b8', 'center');
      ctx.globalAlpha = 1;
    }
  }

  function drawTape(x, y, w, h, value, max, unit, color) {
    panel(x, y, w, h);
    const frac = clamp(value / max, 0, 1);
    ctx.fillStyle = color;
    ctx.fillRect(x + 8, y + h - 10 - (h - 20) * frac, w - 16, 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(x + 8, y + h - 10 - (h - 20) * frac, w - 16, 2);
    smallLabel(`${Math.round(value)}`, x + w / 2, y + h + 22, 15, '#eef4ff', 'center');
    smallLabel(unit, x + w / 2, y - 8, 12, '#9fb4d8', 'center');
  }

  function drawBar(x, y, w, h, frac, color) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(0, w * clamp(frac, 0, 1)), h, 4);
    ctx.fill();
  }

  function drawArtificialHorizon(world) {
    const state = world.state;
    const cx = 312;
    const cy = FIELD.height - 52;
    const r = 30;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate((-state.bank * PLANE.bankDegrees * Math.PI) / 180);
    ctx.translate(0, clamp(state.pitch, -1, 1) * 12);
    ctx.fillStyle = '#3f6fb8';
    ctx.fillRect(-r - 2, -r - 2, r * 2 + 4, r + 2);
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(-r - 2, 0, r * 2 + 4, r + 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy);
    ctx.lineTo(cx + 5, cy);
    ctx.lineTo(cx, cy + 5);
    ctx.closePath();
    ctx.fill();
  }

  function drawTitle(world, best) {
    ctx.fillStyle = 'rgba(8, 12, 24, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    label('CANYON COURIER', CX, 218, 72, '#ffe9b8', 'center', true);
    label('Fly the canyon. Thread the rings. Bring the parcel home.', CX, 262, 22, '#dbe6f5', 'center');
    panel(CX - 330, 300, 660, 150);
    smallLabel('FLY', CX - 300, 336, 15, '#9fb4d8');
    label('← → bank · ↑ climb · ↓ descend', CX - 300, 364, 20, '#eef4ff');
    label('SHIFT / E throttle up · Q throttle down', CX - 300, 392, 20, '#eef4ff');
    smallLabel('MISSION', CX - 300, 424, 15, '#9fb4d8');
    label('SPACE drops the parcel · P pauses', CX - 300, 444, 20, '#eef4ff');
    if (best > 0) label(`BEST SCORE ${best}`, CX, 500, 22, '#ffd98a', 'center');
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) label('PRESS SPACE OR CLICK TO FLY', CX, 505, 26, '#ffffff', 'center', true);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8, 12, 24, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    label('PAUSED', CX, 330, 56, '#eef4ff', 'center');
    label('Press P or click to keep flying', CX, 384, 22, '#c8d4e8', 'center');
  }

  function drawOver(world, best) {
    const state = world.state;
    ctx.fillStyle = 'rgba(8, 12, 24, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    label(state.overReason || 'FLIGHT OVER', CX, 250, 48, '#ff8a7a', 'center', true);
    label(`SCORE ${state.score}   ·   BEST ${Math.max(best, state.score)}`, CX, 312, 28, '#eef4ff', 'center');
    label(
      `Rings ${state.ringsCleared} · Drops ${state.dropsMade} · Landings ${state.landingsMade} · Best combo x${state.bestCombo}`,
      CX,
      356,
      20,
      '#c8d4e8',
      'center',
    );
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) label('PRESS SPACE OR CLICK TO FLY AGAIN', CX, 430, 24, '#ffffff', 'center', true);
  }

  function draw(world, screen, best, time) {
    const state = world.state;
    ctx.save();
    if (state.shake > 0) {
      const mag = state.shake * 7;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    drawSky(world, time);
    drawGround(world);
    drawRunway(world);
    drawDropTarget(world, time);
    drawRings(world);
    if (screen !== SCREEN_TITLE) drawPlane(world, time);
    drawParticles(world);
    ctx.restore();
    if (screen === SCREEN_TITLE) {
      drawPlane(world, time);
      drawHud(world, best, screen);
      drawTitle(world, best);
      return;
    }
    drawHud(world, best, screen);
    if (screen === SCREEN_PAUSED) drawPaused();
    if (screen === SCREEN_OVER) drawOver(world, best);
  }

  return { draw };
}
