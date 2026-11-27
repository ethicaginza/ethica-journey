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

  /* 時代の章：大きい潜水図が画面の上に消えたら、メニューの下に小さい潜水図を出す。
     スマホは横にめくって中央に来たパネル、PCは読んでいる位置のパネルの番号を金色にし、水面からそこまでの線を光らせる。
     元の帯は縦に並んだ一覧を前提にしているので、写しを作ってこちらで動かす（元の帯は外す） */
  var mini0 = d.querySelector('.tl-mini'), voy = d.getElementById('voyage'), dvBig = d.querySelector('#chapters .dv');
  if (mini0 && voy && dvBig && mini0.getAttribute('data-info')) {
    var mini = mini0.cloneNode(true); mini.classList.remove('on'); mini0.parentNode.replaceChild(mini, mini0);
    var info = {}; mini.getAttribute('data-info').split(';').forEach(function (r) { var a = r.split('|'); info[a[0]] = { ago: a[1], t: a[2] }; });
    var pins = [].slice.call(mini.querySelectorAll('.tm-p')), axis = mini.querySelector('.tm-axis'), plot = mini.querySelector('.tm-plot') || axis, doneEl = mini.querySelector('.tm-done');
    var nEl = mini.querySelector('.tm-n'), agoEl = mini.querySelector('.tm-ago'), tEl = mini.querySelector('.tm-t');
    var mlegs = [].slice.call(voy.querySelectorAll('.leg')), curN = 0;
    var xOf = function (n) { var p = mini.querySelector('.tm-p[data-n="' + n + '"]'); return p ? parseFloat(p.style.getPropertyValue('--x')) : 0; };
    var setMini = function (n) {
      var k = +n; if (!info[n] || k === curN) return; curN = k;
      pins.forEach(function (p) { var m = +p.getAttribute('data-n'); p.classList.toggle('cur', m === k); p.classList.toggle('seen', m < k); });
      if (nEl) nEl.textContent = (mini.getAttribute('data-dish') || '{n}').replace('{n}', k);
      if (agoEl) agoEl.textContent = info[n].ago; if (tEl) tEl.textContent = info[n].t;
      if (doneEl) { var cp = 'inset(-20px ' + (100 - xOf(n)).toFixed(1) + '% -20px -20px)'; doneEl.style.webkitClipPath = cp; doneEl.style.clipPath = cp; }
    };
    var railMode = function () { return voy.scrollWidth > voy.clientWidth + 4; };
    var legNow = function () {
      var best = mlegs[0], i;
      if (railMode()) { var mid = voy.scrollLeft + voy.clientWidth / 2, bd = 1e9; mlegs.forEach(function (c) { var x = Math.abs(c.offsetLeft - voy.offsetLeft + c.offsetWidth / 2 - mid); if (x < bd) { bd = x; best = c; } }); }
      else { var L = w.innerHeight * 0.5; for (i = mlegs.length - 1; i >= 0; i--) { if (mlegs[i].getBoundingClientRect().top <= L) { best = mlegs[i]; break; } } }
      return best;
    };
    var tall = w.matchMedia ? w.matchMedia('(min-height: 501px)') : { matches: true };
    var msync = function () {
      var hb = top ? top.getBoundingClientRect().bottom : 68, mh = mini.offsetHeight || 80;
      var on = tall.matches && dvBig.getBoundingClientRect().bottom < hb + mh * 0.6 && voy.getBoundingClientRect().bottom > hb + mh + 70;
      mini.classList.toggle('on', on);
      var l = legNow(); if (l) setMini(l.getAttribute('data-n'));
    };
    var mt = 0, mreq = function () { if (mt) return; mt = w.requestAnimationFrame(function () { mt = 0; msync(); }); };
    w.addEventListener('scroll', mreq, { passive: true }); voy.addEventListener('scroll', mreq, { passive: true }); w.addEventListener('resize', mreq);
    setMini(mlegs[0] ? mlegs[0].getAttribute('data-n') : '1'); msync();
    /* 小さい潜水図を押すと、いちばん近い番号のパネルへ移る */
    axis.addEventListener('click', function (ev) {
      var b = plot.getBoundingClientRect(), x = (ev.clientX - b.left) / b.width * 100, bestN = 1, bd = 1e9, li = null, ld = 1e9;
      pins.forEach(function (p) { var n = +p.getAttribute('data-n'), dd = Math.abs(xOf(n) - x); if (dd < bd) { bd = dd; bestN = n; } });
      mlegs.forEach(function (c) { var dd = Math.abs(+c.getAttribute('data-n') - bestN); if (dd < ld) { ld = dd; li = c; } });
      if (!li) return;
      if (railMode()) voy.scrollTo({ left: li.offsetLeft - voy.offsetLeft + li.offsetWidth / 2 - voy.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
      else w.scrollTo({ top: li.getBoundingClientRect().top + w.scrollY - w.innerHeight * 0.42, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* 動画のキャスト・ピクチャー イン ピクチャーのボタンを出さない（後から作られる動画にも付ける） */
  var noCast = function (v) { try { v.disableRemotePlayback = true; v.disablePictureInPicture = true; v.setAttribute('disableremoteplayback', ''); v.setAttribute('x-webkit-airplay', 'deny'); } catch (e) {} };
  [].forEach.call(d.querySelectorAll('video'), noCast);
  if ('MutationObserver' in w) new MutationObserver(function (ms) {
    ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.nodeType !== 1) return; if (n.tagName === 'VIDEO') noCast(n); else if (n.querySelectorAll) [].forEach.call(n.querySelectorAll('video'), noCast); }); });
  }).observe(d.documentElement, { childList: true, subtree: true });
})(window, document);
