// Illustrations en relief de l'écran Outils : portage ligne à ligne de _ToolArtPainter (lib/widgets/tool_art.dart, GymMane, GPLv3).
// Dessin sur <canvas> 64 x 54 comme l'original (dégradés, ombres floues, reflets, rotations), net sur écran haute densité.

const HUES = ['#F3C7B1', '#A78BDA', '#A8C99E', '#9CC2E8', '#E8CF98', '#E6A4B9'];

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const css = (c, a = 1) => `rgba(${c.map(Math.round).join(',')},${a})`;
const NOIR = [0, 0, 0];
const BLANC = [255, 255, 255];

/** Dessine l'outil `id` dans ctx (repère 64 x 54 déjà mis à l'échelle). `dark` = fond sombre (luminance < 0,5). */
export function dessinerOutil(ctx, id, dark, echelle = 1) {
  const w = 64;
  const h = 54;
  const hue = (i) => lerp(hex(HUES[i]), NOIR, dark ? 0.08 : 0);
  const ink = (c) => lerp(c, NOIR, 0.5);
  const steel = hex(dark ? '#D8D3CD' : '#B9B2AA');
  const flou = 'filter' in ctx;

  const rrect = (x, y, rw, rh, r) => { const p = new Path2D(); p.roundRect(x, y, rw, rh, Math.min(r, rw / 2, rh / 2)); return p; };
  const decale = (p, dx, dy) => { const q = new Path2D(); q.addPath(p, new DOMMatrix().translate(dx, dy)); return q; };
  const vertical = (top, bottom, stops) => {
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  };

  // MaskFilter.blur(normal, sigma) : flou gaussien d'écart type sigma, à l'échelle du dessin.
  const flouter = (sigma) => { if (flou) ctx.filter = `blur(${sigma * echelle}px)`; };
  const sansFlou = () => { if (flou) ctx.filter = 'none'; };

  const shadow = (path, { blur = 3.5, dy = 2.5, alpha = 0.28 } = {}) => {
    ctx.save();
    flouter(blur);
    ctx.fillStyle = css(NOIR, dark ? alpha + 0.12 : alpha * 0.6);
    ctx.fill(decale(path, 0, dy));
    ctx.restore();
  };
  const fillGrad = (path, c, b) => {
    ctx.fillStyle = vertical(b.y, b.y + b.h, [[0, css(lerp(c, BLANC, 0.22))], [1, css(lerp(c, NOIR, 0.12))]]);
    ctx.fill(path);
  };
  const gloss = (path, b, r) => {
    ctx.save();
    ctx.clip(path);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = vertical(b.y, b.y + b.h, [[0, 'rgba(255,255,255,0.5)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]);
    ctx.stroke(rrect(b.x + 0.6, b.y + 0.6, b.w - 1.2, b.h - 1.2, Math.max(0, r - 0.6)));
    ctx.restore();
  };
  const block = (x, y, bw, bh, r, c, { ombre = true, reflet = true } = {}) => {
    const p = rrect(x, y, bw, bh, r);
    const b = { x, y, w: bw, h: bh };
    if (ombre) shadow(p);
    fillGrad(p, c, b);
    if (reflet) gloss(p, b, r);
    return b;
  };
  const plate = (x, y, pw, ph, c) => {
    block(x, y, pw, ph, Math.min(3, pw / 2), c);
    ctx.fillStyle = css(ink(c), 0.28);
    ctx.fill(rrect(x + pw / 2 - 0.7, y + ph / 2 - (ph * 0.62) / 2, 1.4, ph * 0.62, 1));
  };
  const turn = (angle, draw) => {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(angle);
    ctx.translate(-w / 2, -h / 2);
    draw();
    ctx.restore();
  };
  const arc = (cx, cy, rx, ry, start, sweep, centre) => {
    const p = new Path2D();
    if (centre) p.moveTo(cx, cy);
    p.ellipse(cx, cy, rx, ry, 0, start, start + sweep);
    if (centre) p.closePath();
    return p;
  };
  const ligne = (x1, y1, x2, y2, couleur, lw, rond = false) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = couleur;
    ctx.lineWidth = lw;
    ctx.lineCap = rond ? 'round' : 'butt';
    ctx.stroke();
  };
  const cercle = (cx, cy, r, couleur) => { ctx.fillStyle = couleur; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
  const ovale = (cx, cy, ow, oh, couleur) => { ctx.fillStyle = couleur; ctx.beginPath(); ctx.ellipse(cx, cy, ow / 2, oh / 2, 0, 0, Math.PI * 2); ctx.fill(); };
  const bornes = (pts) => {
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };

  switch (id) {
    case 'rm':
      turn(-0.14, () => {
        const cy = h / 2;
        block(2, cy - 2, w - 4, 4, 2, steel, { reflet: false });
        for (const left of [true, false]) {
          const x = (dx, bw) => (left ? dx : w - dx - bw);
          block(x(2, 3.5), cy - 3.5, 3.5, 7, 1.5, steel, { ombre: false, reflet: false });
          plate(x(8, 8), cy - 18, 8, 36, hue(0));
          plate(x(16, 5.5), cy - 12, 5.5, 24, hue(4));
          block(x(21.5, 3.5), cy - 5.5, 3.5, 11, 1.5, steel, { ombre: false, reflet: false });
        }
      });
      break;
    case 'bmi':
      turn(0.06, () => {
        const b = block(w / 2 - 21, h / 2 + 2 - 20, 42, 40, 11, hue(2));
        const dcx = w / 2;
        const dcy = b.y + 15;
        ctx.fillStyle = css(ink(hue(2)), 0.85);
        ctx.fill(arc(dcx, dcy, 13, 11, Math.PI, Math.PI, true));
        ctx.fillStyle = css(lerp(hue(2), BLANC, 0.75));
        ctx.fill(arc(dcx, dcy, 9, 7, Math.PI, Math.PI, true));
        ligne(dcx, dcy, dcx + Math.cos(-0.9) * 8, dcy + Math.sin(-0.9) * 8, '#D9774E', 2, true);
        cercle(dcx, dcy, 2, css(ink(hue(2))));
        for (const dx of [-10, 10]) {
          ctx.fillStyle = css(ink(hue(2)), 0.35);
          ctx.fill(rrect(w / 2 + dx - 4.5, b.y + b.h - 7 - 1.5, 9, 3, 2));
        }
      });
      break;
    case 'cal': {
      const cx = w / 2;
      const flame = (scale, dy) => {
        const fh = 44 * scale;
        const fw = 32 * scale;
        const top = h - 4 - fh + dy;
        const bottom = h - 4 + dy;
        const p = new Path2D();
        p.moveTo(cx, top);
        p.bezierCurveTo(cx + fw * 0.15, top + fh * 0.25, cx + fw * 0.55, top + fh * 0.4, cx + fw * 0.5, top + fh * 0.68);
        p.bezierCurveTo(cx + fw * 0.46, top + fh * 0.92, cx + fw * 0.2, bottom, cx, bottom);
        p.bezierCurveTo(cx - fw * 0.2, bottom, cx - fw * 0.5, top + fh * 0.92, cx - fw * 0.5, top + fh * 0.66);
        p.bezierCurveTo(cx - fw * 0.5, top + fh * 0.45, cx - fw * 0.3, top + fh * 0.38, cx - fw * 0.22, top + fh * 0.22);
        p.bezierCurveTo(cx - fw * 0.08, top + fh * 0.36, cx - fw * 0.02, top + fh * 0.18, cx, top);
        p.closePath();
        return { p, top, bottom, fw };
      };
      const outer = flame(1, 0);
      ctx.save();
      flouter(9);
      cercle(cx, h - 16, 18, css(hex('#F2A46E'), dark ? 0.22 : 0.16));
      ctx.restore();
      shadow(outer.p);
      ctx.fillStyle = vertical(outer.top, outer.bottom, [[0, '#F4BC86'], [1, '#E0745A']]);
      ctx.fill(outer.p);
      ctx.save();
      ctx.clip(outer.p);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.stroke(decale(outer.p, -3, 2));
      ctx.restore();
      const inner = flame(0.52, -2);
      ctx.fillStyle = vertical(inner.top, inner.bottom, [[0, '#F8E2A8'], [1, css(lerp(hex('#F8E2A8'), BLANC, 0.5))]]);
      ctx.fill(inner.p);
      break;
    }
    case 'bf':
      turn(0.1, () => {
        const s = block(w / 2 - 20, h / 2 - 23, 40, 46, 8, hue(3));
        const rcx = w / 2;
        const rcy = s.y + 18;
        ctx.lineWidth = 5;
        ctx.strokeStyle = css(ink(hue(3)), 0.3);
        ctx.beginPath(); ctx.arc(rcx, rcy, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.lineCap = 'round';
        ctx.strokeStyle = css(hue(5));
        ctx.beginPath(); ctx.arc(rcx, rcy, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 0.7); ctx.stroke();
        for (const [dy, f] of [[33, 1], [38.5, 0.6]]) {
          ctx.fillStyle = css(ink(hue(3)), 0.4);
          ctx.fill(rrect(s.x + 8, s.y + dy, 24 * f, 2.5, 2));
        }
      });
      break;
    case 'plate':
      turn(-0.06, () => {
        const cy = h / 2;
        block(4, cy - 2.5, w - 8, 5, 2.5, steel, { reflet: false });
        let x = 12;
        for (const [pw, ph, hu] of [[8, 46, 3], [6.5, 36, 4], [5.5, 27, 2], [4.5, 19, 0]]) {
          plate(x, cy - ph / 2, pw, ph, hue(hu));
          x += pw + 1.2;
        }
        block(x + 1, cy - 6, 4, 12, 1.5, steel, { reflet: false });
      });
      break;
    case 'warmup': {
      const base = h - 6;
      for (const [i, bh, hu] of [[0, 16, 2], [1, 27, 4], [2, 40, 0]]) {
        const x = 10 + i * 15;
        block(x, base - bh, 12, bh, 4, hue(hu));
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill(rrect(x + 3, base - bh + 4, 6, 2.5, 2));
      }
      break;
    }
    case 'rpe': {
      const cx = w / 2;
      const cy = h - 10;
      const track = arc(cx, cy, 22, 22, Math.PI, Math.PI, false);
      shadow(track, { blur: 3 });
      const g = ctx.createLinearGradient(cx - 22, 0, cx + 22, 0);
      [css(hue(2)), css(hue(4)), css(hue(0)), '#E07A5A'].forEach((c, i) => g.addColorStop(i / 3, c));
      ctx.strokeStyle = g;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.stroke(track);
      for (let k = 1; k < 5; k += 1) {
        const a = Math.PI + (Math.PI * k) / 5;
        ligne(cx + Math.cos(a) * 18.5, cy + Math.sin(a) * 18.5, cx + Math.cos(a) * 25.5, cy + Math.sin(a) * 25.5, 'rgba(255,255,255,0.45)', 1.2);
      }
      const needle = dark ? '#F2EEE9' : '#3A332D';
      const tx = cx + Math.cos(Math.PI * 1.72) * 17;
      const ty = cy + Math.sin(Math.PI * 1.72) * 17;
      const moyeu = new Path2D();
      moyeu.arc(cx, cy, 4.5, 0, Math.PI * 2);
      shadow(moyeu, { blur: 2, dy: 1.5 });
      ligne(cx, cy, tx, ty, needle, 3, true);
      cercle(cx, cy, 4.5, needle);
      cercle(cx, cy, 1.6, css(hue(0)));
      break;
    }
    case 'dots': {
      const base = h - 4;
      for (const [x, bh, hu] of [[6, 18, 1], [22, 28, 4], [38, 12, 0]]) {
        const b = block(x, base - bh, 16, bh, 3.5, hue(hu));
        ctx.fillStyle = css(ink(hue(hu)), 0.35);
        ctx.fill(rrect(x + 5, b.y + 5, 6, 2.2, 1.1));
      }
      const mx = 30;
      const my = base - 28 - 11;
      for (const s of [-1, 1]) {
        ctx.fillStyle = css(s < 0 ? hue(3) : hue(5));
        ctx.beginPath();
        ctx.moveTo(mx + s * 1.5, my - 4);
        ctx.lineTo(mx + s * 6.5, my - 12);
        ctx.lineTo(mx + s * 10, my - 10);
        ctx.lineTo(mx + s * 5, my - 2);
        ctx.closePath();
        ctx.fill();
      }
      const disc = new Path2D();
      disc.arc(mx, my, 8, 0, Math.PI * 2);
      shadow(disc, { blur: 2.5, dy: 1.5 });
      // RadialGradient(center: Alignment(-0.3, -0.4)), rayon 0,5 du plus petit côté = 8.
      const rg = ctx.createRadialGradient(mx - 0.3 * 8, my - 0.4 * 8, 0, mx - 0.3 * 8, my - 0.4 * 8, 8);
      rg.addColorStop(0, '#FBE9B8');
      rg.addColorStop(1, '#D6A55A');
      ctx.fillStyle = rg;
      ctx.fill(disc);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = css(hex('#9C7334'), 0.6);
      ctx.beginPath(); ctx.arc(mx, my, 4.5, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'wilks': {
      const goldLight = '#FBE9B8';
      const goldDark = '#C9934A';
      const rim = hex('#9C7334');
      const cx = w / 2;
      const gold = (b) => {
        const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
        g.addColorStop(0, goldLight);
        g.addColorStop(1, goldDark);
        return g;
      };
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = goldDark;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * 12.5, 9);
        ctx.bezierCurveTo(cx + s * 22, 8, cx + s * 22, 20, cx + s * 8.5, 23);
        ctx.stroke();
      }
      const cup = new Path2D();
      cup.moveTo(cx - 14, 5);
      cup.lineTo(cx + 14, 5);
      cup.bezierCurveTo(cx + 14, 17, cx + 9, 25, cx + 2.6, 27.5);
      cup.lineTo(cx + 2.6, 34);
      cup.bezierCurveTo(cx + 2.6, 36, cx + 8, 37, cx + 9, 39.5);
      cup.lineTo(cx - 9, 39.5);
      cup.bezierCurveTo(cx - 8, 37, cx - 2.6, 36, cx - 2.6, 34);
      cup.lineTo(cx - 2.6, 27.5);
      cup.bezierCurveTo(cx - 9, 25, cx - 14, 17, cx - 14, 5);
      cup.closePath();
      const base = block(cx - 14, 39, 28, 11, 3, hue(4));
      ctx.fillStyle = css(ink(hue(4)), 0.35);
      ctx.fill(rrect(base.x + base.w / 2 - 6, base.y + base.h / 2 - 1.2, 12, 2.4, 1.2));
      shadow(cup);
      // Bornes de la coupe telles que les donne Path.getBounds() (points de contrôle inclus sur ces courbes).
      ctx.fillStyle = gold(bornes([cx - 14, 5, cx + 14, 39.5]));
      ctx.fill(cup);
      ctx.fillStyle = gold({ x: cx - 5, y: 28, w: 10, h: 5 });
      ctx.beginPath(); ctx.ellipse(cx, 30.5, 4.5, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      ovale(cx, 5.5, 28, 4, css(rim, 0.55));
      ovale(cx, 5, 25, 2.6, goldLight);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(cx - 9.5, 10);
      ctx.bezierCurveTo(cx - 9.5, 17, cx - 7, 21, cx - 4, 23);
      ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k < 10; k += 1) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const r = k % 2 === 0 ? 4.2 : 1.8;
        const px = cx + Math.cos(a) * r;
        const py = 15 + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = css(rim, 0.55);
      ctx.fill();
      break;
    }
    case 'ffmi': {
      const r = block(7, 3, 14, h - 6, 3.5, hue(2));
      ctx.fillStyle = css(ink(hue(2)), 0.5);
      for (let k = 0; k <= 12; k += 1) {
        const y = r.y + 5 + (k * (r.h - 10)) / 12;
        const len = k % 4 === 0 ? 8 : (k % 2 === 0 ? 5.5 : 3.5);
        ctx.fill(rrect(r.x + 2, y - 0.7, len, 1.4, 0.7));
      }
      const bx = w - 21;
      const by = h - 18;
      const iron = hue(0);
      const anse = (y0) => {
        ctx.beginPath();
        ctx.moveTo(bx - 9.5, by + y0);
        ctx.bezierCurveTo(bx - 12, by - 26, bx + 12, by - 26, bx + 9.5, by + y0);
      };
      ctx.lineCap = 'round';
      anse(-1);
      ctx.lineWidth = 4.6;
      ctx.strokeStyle = css(ink(iron), 0.9);
      ctx.stroke();
      anse(-1.5);
      ctx.lineWidth = 3;
      ctx.strokeStyle = css(lerp(iron, NOIR, 0.18));
      ctx.stroke();
      const bell = new Path2D();
      bell.moveTo(bx - 7, by + 13.5);
      bell.bezierCurveTo(bx - 17, by + 11, bx - 16.5, by - 9, bx, by - 10);
      bell.bezierCurveTo(bx + 16.5, by - 9, bx + 17, by + 11, bx + 7, by + 13.5);
      bell.closePath();
      shadow(bell);
      // Bornes de la cloche selon Path.getBounds (points de contrôle) : seul le haut et le bas comptent pour ce dégradé vertical.
      fillGrad(bell, iron, { x: bx - 14.3, y: by - 10, w: 28.6, h: 23.5 });
      ctx.save();
      ctx.clip(bell);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.stroke(decale(bell, -2.5, 2));
      ctx.restore();
      ovale(bx - 5, by - 3, 6, 3.6, 'rgba(255,255,255,0.42)');
      ctx.fillStyle = css(ink(iron), 0.28);
      ctx.fill(rrect(bx - 5, by + 1, 10, 6, 2));
      break;
    }
    default:
  }
}
