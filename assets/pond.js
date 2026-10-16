/* ページ全体の「水面」。マウスの通り道とクリックした所、タップした所（スクロールではない軽い指先）に、金色の細い波紋が広がる（2D canvas）。
   トップの写真（WebGLの水面）の上では描かない。動きを減らす設定では何もしない。 */
(function () {
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:45';
  document.body.appendChild(cv);
  var ctx = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), W = 0, H = 0;
  function size() {
    var w = document.documentElement.clientWidth || window.innerWidth, h = window.innerHeight;
    if (w === W && h === H) return;
    W = w; H = h; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size(); window.addEventListener('resize', size);
  var rings = [], running = false, lastTrail = 0, lx = -1, ly = -1, down = null, prevT = 0;
  function skip(e) { var t = e.target; return t && t.closest && t.closest('[data-water]'); }
  function add(x, y, big) {
    rings.push({ x: x, y: y, r: big ? 6 : 2, max: big ? 150 : 46, life: 1, w: big ? 1.4 : 0.8, a: big ? 0.75 : 0.32, sp: big ? 3.2 : 1.1 });
    if (big) rings.push({ x: x, y: y, r: 2, max: 90, life: 1, w: 0.9, a: 0.5, sp: 2.2, delay: 7 });
    if (!running) { running = true; prevT = performance.now(); requestAnimationFrame(tick); }
  }
  window.addEventListener('pointerdown', function (e) {
    if (skip(e)) return;
    if (e.pointerType === 'mouse') add(e.clientX, e.clientY, true);
    else down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  }, { passive: true });
  window.addEventListener('pointerup', function (e) {
    if (!down || e.pointerId !== down.id) return;
    var dx = e.clientX - down.x, dy = e.clientY - down.y, quick = performance.now() - down.t < 500;
    if (quick && dx * dx + dy * dy < 100) add(e.clientX, e.clientY, true);
    down = null;
  }, { passive: true });
  window.addEventListener('pointercancel', function () { down = null; }, { passive: true });
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || skip(e)) return;
    var now = performance.now(), dx = e.clientX - lx, dy = e.clientY - ly;
    if (now - lastTrail < 90 || dx * dx + dy * dy < 900) return;
    lastTrail = now; lx = e.clientX; ly = e.clientY; add(e.clientX, e.clientY, false);
  }, { passive: true });
  function tick(now) {
    var f = Math.min(3, Math.max(0.25, (now - prevT) / 16.7)); prevT = now; // 画面の更新頻度によらず同じ速さで広げる
    ctx.clearRect(0, 0, W, H);
    for (var i = rings.length - 1; i >= 0; i--) {
      var g = rings[i];
      if (g.delay > 0) { g.delay -= f; continue; }
      g.r += g.sp * f * (1 - g.r / g.max * 0.6); g.life = 1 - g.r / g.max;
      if (g.life <= 0) { rings.splice(i, 1); continue; }
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(214,183,124,' + (g.a * g.life).toFixed(3) + ')'; ctx.lineWidth = g.w; ctx.stroke();
    }
    if (rings.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, W, H); }
  }
})();
