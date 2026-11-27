/* 試作専用の追加スクリプト（本番の app_v2.js には手を入れない） */
(function (w, d) {
  'use strict';
  var root = d.documentElement, top = d.getElementById('top');
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = w.matchMedia('(max-width: 900px) and (orientation: portrait)');

  /* 続きを読む：押すと、その枠の中のたたんだ文が開く。開いたらボタンは消える */
  [].forEach.call(d.querySelectorAll('.p-more'), function (bt) {
    bt.addEventListener('click', function () {
      var box = bt.closest('[data-fold]'); if (!box) return;
      box.classList.add('p-open'); bt.setAttribute('aria-expanded', 'true'); bt.hidden = true;
    });
  });

  /* 最初の画面：セノーテ（波紋つき）→ 写真4枚。写真は上の層でフェードし、波紋の層には触らない */
  var hero = d.getElementById('hero'), slides = [].slice.call(d.querySelectorAll('.p-slide'));
  if (hero && slides.length) {
    var cur = -1, on = true, timer = 0, pt = 0;
    var load = function (el) { var im = el.querySelector('img'); if (im && !im.src) im.src = im.getAttribute('data-src'); };
    /* 青いテーブルの写真だけ、青い所に波紋（本番の波紋の部品と、同じ写真用の型をそのまま使う） */
    var coarse = w.matchMedia && w.matchMedia('(pointer: coarse)').matches, wr = null, WM = 'assets/img/hero_mask.png?v=5';
    var water = function (el) {
      if (wr || reduce || !w.EthicaRipple) return;
      var im = el.querySelector('img'), cv = el.querySelector('canvas'); if (!im || !cv) return;
      var go = function () {
        if (wr) return;
        try {
          wr = new w.EthicaRipple(cv, im.currentSrc || im.src, { ambient: coarse ? 0 : 2600, pert: coarse ? 0.06 : 0.03, zoomFrom: 1, zoomTo: 1, pan: 0, panY: 0, period: 14, dpr: 2, lite: coarse,
            thr: coarse ? 0.015 : 0.03, touch: { r: 42, s: 0.2, move: 0.06, echo: true }, mask: { landscape: WM, portrait: WM },
            onLost: function () { el.classList.remove('water'); }, onBack: function () { el.classList.add('water'); } });
          if (!wr.ok) { wr = null; return; }
          wr.start(function () { el.classList.add('water'); }); wr.bind(hero);
          wr.inView = el.classList.contains('on'); w.__photoRipple = wr;
        } catch (e) { wr = null; }
      };
      if (im.complete && im.naturalWidth) go(); else im.addEventListener('load', go, { once: true });
    };
    var show = function (n) {
      var prev = cur;
      /* 前の写真は、次の写真が出きるまで下に残す（両方を同時に薄くすると、奥のセノーテが一瞬透ける） */
      slides.forEach(function (el, i) { el.classList.toggle('on', i === n); el.classList.toggle('prev', n >= 0 && prev >= 0 && i === prev); });
      clearTimeout(pt); pt = setTimeout(function () { slides.forEach(function (el) { el.classList.remove('prev'); }); }, 1700);
      hero.classList.toggle('p-photo', n >= 0); cur = n;
      if (n + 1 < slides.length) load(slides[n + 1]);
      var ws = n >= 0 && slides[n].hasAttribute('data-water-photo');
      if (ws) water(slides[n]);
      if (wr) { wr.inView = ws; if (ws) wr.kick(); }
    };
    var fix = (location.search.match(/[?&]slide=(-?\d+)/) || [])[1];
    if (fix !== undefined) { if (+fix >= 0) { load(slides[+fix]); } show(+fix); }
    else if (!reduce) {
      w.addEventListener('load', function () { load(slides[0]); });
      var tick = function () {
        timer = setTimeout(function () {
          if (on && !d.hidden) show(cur + 1 >= slides.length ? -1 : cur + 1);
          tick();
        }, cur < 0 ? 4000 : 3000);
      };
      tick();
      if ('IntersectionObserver' in w) new IntersectionObserver(function (es) { on = es[es.length - 1].isIntersecting; }).observe(hero);
    }
    /* スマホでは、最初の画面のあいだだけヘッダーの小さなロゴを隠す（中央に大きなロゴがあるため） */
    var over = function () { top.classList.toggle('over-ss', small.matches && (w.scrollY || 0) <= 40); };
    w.addEventListener('scroll', over, { passive: true }); w.addEventListener('resize', over); over();
  }

  /* 時代の章の抜粋（スマホは横にめくる）：中央にあるパネルの数字だけを光らせる */
  var vr = d.querySelector('.p-vrail');
  if (vr) {
    var legs = [].slice.call(vr.querySelectorAll('.leg'));
    var vmark = function () {
      var mid = vr.scrollLeft + vr.clientWidth / 2, best = null, bd = 1e9;
      legs.forEach(function (c) { var x = Math.abs(c.offsetLeft - vr.offsetLeft + c.offsetWidth / 2 - mid); if (x < bd) { bd = x; best = c; } });
      legs.forEach(function (c) { c.classList.toggle('p-cur', c === best); });
    };
    vr.addEventListener('scroll', function () { w.requestAnimationFrame(vmark); }, { passive: true }); vmark();
  }

  /* コースのパネル：横にめくる。最初に見せる1枚を中央に置き、下の点で位置を示す */
  [].forEach.call(d.querySelectorAll('.p-rail'), function (rail) {
    var cards = [].slice.call(rail.children), pips = rail.nextElementSibling;
    var dots = pips && pips.classList.contains('p-pips') ? [].slice.call(pips.children) : [];
    var isRail = function () { return rail.scrollWidth > rail.clientWidth + 4; };
    var center = function (el) { return el.offsetLeft - rail.offsetLeft + el.offsetWidth / 2; };
    var mark = function () {
      if (!dots.length) return;
      var mid = rail.scrollLeft + rail.clientWidth / 2, best = 0, bd = 1e9;
      cards.forEach(function (c, i) { var x = Math.abs(center(c) - mid); if (x < bd) { bd = x; best = i; } });
      dots.forEach(function (p, i) { p.classList.toggle('on', i === best); });
    };
    var start = function () {
      var c = cards[+rail.getAttribute('data-start') || 0];
      if (isRail() && c) rail.scrollLeft = center(c) - rail.clientWidth / 2;
      mark();
    };
    rail.addEventListener('scroll', function () { w.requestAnimationFrame(mark); }, { passive: true });
    start(); w.addEventListener('load', start);
  });

  /* 動画のキャスト・ピクチャー イン ピクチャーのボタンを出さない（後から作られる動画にも付ける） */
  var noCast = function (v) { try { v.disableRemotePlayback = true; v.disablePictureInPicture = true; v.setAttribute('disableremoteplayback', ''); v.setAttribute('x-webkit-airplay', 'deny'); } catch (e) {} };
  [].forEach.call(d.querySelectorAll('video'), noCast);
  if ('MutationObserver' in w) new MutationObserver(function (ms) {
    ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.nodeType !== 1) return; if (n.tagName === 'VIDEO') noCast(n); else if (n.querySelectorAll) [].forEach.call(n.querySelectorAll('video'), noCast); }); });
  }).observe(d.documentElement, { childList: true, subtree: true });
})(window, document);
