/* テーブルの写真の水面（フィロソフィーの見出しの裏）に重ねる金色の細い輪（2D canvas）。指のタップ・なぞりで、青いレジンの型で切り抜いて描く。
   型の無い水面（トップのセノーテ・動画の背景）と黒い背景の上には描かない（2026-10-20 オーナー指示）。動きを減らす設定では何もしない。 */
(function () {
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (/[?&]nopond=1/.test(location.search)) return; // 点検用：金の輪を止める
  var cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:45';
  document.body.appendChild(cv);
  var ctx = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), W = 0, H = 0;
  // 写真の上の輪は、別の描画面に描いてから型で切り抜き、上の描画面へ重ねる
  var hc = document.createElement('canvas'), hctx = hc.getContext('2d');
  function size() {
    var w = document.documentElement.clientWidth || window.innerWidth, h = window.innerHeight;
    if (w === W && h === H) return;
    W = w; H = h; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = hc.width = Math.round(W * dpr); cv.height = hc.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size(); window.addEventListener('resize', size);
  var rings = [], hrings = [], running = false, lastTrail = 0, lx = -1, ly = -1, down = null, prevT = 0;
  // トップの写真の上で、青いレジンでない所（木・皿）なら true（マウス用）
  function offResin(x, y) {
    var h = window.__heroRipple; if (!h || !h.r.maskOn) return false;
    var b = h.el.getBoundingClientRect(); if (x < b.left || x > b.right || y < b.top || y > b.bottom) return false;
    return h.r.maskAt(x - b.left, y - b.top) < 0.35;
  }
  // 指の点が、写真の水面（トップの写真と、その写し）の描画面の上か
  function inRect(el, x, y) { var b = el.getBoundingClientRect(); return b.bottom > 0 && b.width > 0 && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom; }
  function onHero(x, y) {
    var els = document.querySelectorAll('[data-water] canvas');
    for (var i = 0; i < els.length; i++) if (inRect(els[i], x, y)) return true;
    return false;
  }
  // その点の水面（動いていて、型が届いていて、その点が青いレジン）を返す。無ければ null
  function heroOk(x, y) {
    var a = window.__waterImg || [];
    for (var i = 0; i < a.length; i++) {
      var r = a[i]; if (!r || r.dead || !r.ok || !r.maskOn || !r.c.isConnected || !inRect(r.c, x, y)) continue;
      var b = r.c.getBoundingClientRect(); if (r.maskAt(x - b.left, y - b.top) >= 0.35) return r;
    }
    return null;
  }
  // トップの写真の上と、水面が動いている動画の背景（.wv-ready）では、マウスの金の輪は出さない（水面の波紋が出る）
  function skip(e) { var t = e.target, el = t && t.closest && t.closest('[data-water],[data-water-v]'); return !!(el && (el.hasAttribute('data-water') || el.classList.contains('wv-ready'))); }
  function go() { if (!running) { running = true; prevT = performance.now(); requestAnimationFrame(tick); } }
  var PAGE_RINGS = false; // 黒い背景の上の輪は出さない
  function add(x, y, big) {
    if (!PAGE_RINGS) return;
    rings.push({ x: x, y: y, r: big ? 6 : 2, max: big ? 150 : 46, life: 1, w: big ? 1.4 : 0.8, a: big ? 0.75 : 0.32, sp: big ? 3.2 : 1.1 });
    if (big) rings.push({ x: x, y: y, r: 2, max: 90, life: 1, w: 0.9, a: 0.5, sp: 2.2, delay: 7 });
    go();
  }
  // 写真の上の輪（型で切り抜く）。タップは ripple.js が青いレジンへ寄せた点で呼ぶ（水面の波紋と同じ点・同じ瞬間）
  function addHero(x, y, big, wr) {
    if (!wr) return;
    hrings.push({ x: x, y: y, r: big ? 5 : 2, max: big ? 110 : 40, life: 1, w: big ? 1.3 : 0.8, a: big ? 0.8 : 0.34, sp: big ? 2.6 : 1.0, wr: wr });
    if (big) hrings.push({ x: x, y: y, r: 2, max: 70, life: 1, w: 0.9, a: 0.55, sp: 1.8, delay: 7, wr: wr });
    go();
  }
  window.__pondHero = function (x, y, wr) { addHero(x, y, true, wr || (window.__heroRipple && window.__heroRipple.r)); };
  window.addEventListener('pointerdown', function (e) {
    // マウスはトップの写真の上では描かない（写真の水面が揺れる）
    if (e.pointerType === 'mouse') { if (!skip(e) && !offResin(e.clientX, e.clientY)) add(e.clientX, e.clientY, true); }
    else down = onHero(e.clientX, e.clientY) ? null : { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; // 写真の上のタップは ripple.js から
  }, { passive: true });
  window.addEventListener('pointerup', function (e) {
    if (!down || e.pointerId !== down.id) return;
    var dx = e.clientX - down.x, dy = e.clientY - down.y, quick = performance.now() - down.t < 500;
    if (quick && dx * dx + dy * dy < 100 && !onHero(e.clientX, e.clientY)) add(e.clientX, e.clientY, true);
    down = null;
  }, { passive: true });
  window.addEventListener('pointercancel', function () { down = null; }, { passive: true });
  // 指を滑らせている間（スクロール中も）は、マウスの通り道と同じように指の下に小さな輪を続けて出す
  var tl = {};
  window.addEventListener('touchmove', function (e) {
    var now = performance.now(), menu = document.documentElement.classList.contains('menu-open');
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i], q = tl[t.identifier], dx = q ? t.clientX - q.x : 99, dy = q ? t.clientY - q.y : 99;
      if (q && (now - q.t < 55 || dx * dx + dy * dy < 400)) continue;
      tl[t.identifier] = { x: t.clientX, y: t.clientY, t: now };
      if (onHero(t.clientX, t.clientY)) { var hr = !menu && heroOk(t.clientX, t.clientY); if (hr) addHero(t.clientX, t.clientY, false, hr); }
      else add(t.clientX, t.clientY, false);
    }
  }, { passive: true });
  var tend = function (e) { for (var i = 0; i < e.changedTouches.length; i++) delete tl[e.changedTouches[i].identifier]; };
  window.addEventListener('touchend', tend, { passive: true }); window.addEventListener('touchcancel', tend, { passive: true });
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || skip(e)) return;
    var now = performance.now(), dx = e.clientX - lx, dy = e.clientY - ly;
    if (now - lastTrail < 90 || dx * dx + dy * dy < 900) return;
    lastTrail = now; lx = e.clientX; ly = e.clientY; if (!offResin(e.clientX, e.clientY)) add(e.clientX, e.clientY, false);
  }, { passive: true });
  // 型の画像（白黒）を、透明度の型に作り直して持っておく（型の URL ごと）
  var am = null, amUrl = '';
  function alphaMask(r) {
    var url = r.maskUrl, im = r.mimgs && r.mimgs[url];
    if (!url || !im || !im.naturalWidth) return null;
    if (url === amUrl) return am;
    try {
      var w = Math.round(im.naturalWidth / 2), h = Math.round(im.naturalHeight / 2), c = document.createElement('canvas'), x = c.getContext('2d');
      c.width = w; c.height = h; x.drawImage(im, 0, 0, w, h);
      var d = x.getImageData(0, 0, w, h), p = d.data;
      // 波紋を立てる境（0.35）より外は描かない。0.35〜0.65 で滑らかに濃くする
      for (var i = 0; i < p.length; i += 4) { var v = Math.min(1, Math.max(0, (p[i] / 255 - 0.35) / 0.3)); p[i + 3] = Math.round(v * v * (3 - 2 * v) * 255); p[i] = p[i + 1] = p[i + 2] = 0; }
      x.putImageData(d, 0, 0); am = c; amUrl = url; return am;
    } catch (e) { return null; }
  }
  function step(list, c, f) {
    for (var i = list.length - 1; i >= 0; i--) {
      var g = list[i];
      if (g.delay > 0) { g.delay -= f; continue; }
      g.r += g.sp * f * (1 - g.r / g.max * 0.6); g.life = 1 - g.r / g.max;
      if (g.life <= 0) { list.splice(i, 1); continue; }
      c.beginPath(); c.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(214,183,124,' + (g.a * g.life).toFixed(3) + ')'; c.lineWidth = g.w; c.stroke();
    }
  }
  function tick(now) {
    var f = Math.min(3, Math.max(0.25, (now - prevT) / 16.7)); prevT = now; // 画面の更新頻度によらず同じ速さで広げる
    ctx.clearRect(0, 0, W, H);
    step(rings, ctx, f);
    if (hrings.length) {
      // 水面ごとに描いて、その水面の型（cover・zoom・pan で写真に合わせる）と見えている矩形で切り抜く
      var groups = [];
      for (var gi = 0; gi < hrings.length; gi++) { var wr = hrings[gi].wr; if (groups.indexOf(wr) < 0) groups.push(wr); }
      for (var k = 0; k < groups.length; k++) {
        var R = groups[k], list = hrings.filter(function (g) { return g.wr === R; });
        var m = R && !R.dead && R.ok && R.maskOn && R.view && R.c.isConnected ? alphaMask(R) : null;
        if (!m) { hrings = hrings.filter(function (g) { return g.wr !== R; }); continue; } // 型が使えないときは描かない
        hctx.clearRect(0, 0, W, H); step(list, hctx, f);
        hrings = hrings.filter(function (g) { return g.wr !== R || g.life > 0; });
        var V = R.view, b = R.c.getBoundingClientRect(), cw = b.width, ch = b.height;
        var mw = cw * V.zoom / V.cover[0], mh = ch * V.zoom / V.cover[1];
        var mx = b.left + cw * (0.5 + (-0.5 - V.pan[0]) * V.zoom / V.cover[0]), my = b.top + ch * (0.5 - (0.5 - V.pan[1]) * V.zoom / V.cover[1]);
        hctx.globalCompositeOperation = 'destination-in'; hctx.drawImage(m, mx, my, mw, mh);
        var tp = document.getElementById('top'), y0 = b.top;
        if (tp && tp.classList.contains('solid')) y0 = Math.max(y0, tp.getBoundingClientRect().bottom);
        hctx.fillStyle = '#000'; hctx.fillRect(b.left, y0, cw, Math.max(0, b.bottom - y0)); hctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(hc, 0, 0, W, H);
      }
    }
    if (rings.length || hrings.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, W, H); }
  }
})();
