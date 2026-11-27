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
    var cur = -1, on = true, timer = 0;
    var load = function (el) { var im = el.querySelector('img'); if (im && !im.src) im.src = im.getAttribute('data-src'); };
    var show = function (n) {
      slides.forEach(function (el, i) { el.classList.toggle('on', i === n); });
      hero.classList.toggle('p-photo', n >= 0); cur = n;
      if (n + 1 < slides.length) load(slides[n + 1]);
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
})(window, document);
