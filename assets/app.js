(function () {
  'use strict';
  var d = document, w = window, root = d.documentElement;
  root.classList.add('js');
  if (/[?&]shot=1/.test(location.search)) { root.classList.add('shot'); var off = (location.search.match(/[?&]off=(\d+)/) || [])[1]; if (off) w.addEventListener('load', function () { w.scrollTo(0, +off); }); }
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var IO = 'IntersectionObserver' in w;

  /* ヘッダーの背景・スマホの固定予約バー（出ているあいだはヘッダーの予約ボタンを隠す） */
  var top = d.getElementById('top'), dock = d.getElementById('dock'), heroCtas = d.getElementById('hero-ctas');
  function onScroll() { top.classList.toggle('solid', (w.scrollY || 0) > 40); }
  w.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  function setDock(on) { dock.classList.toggle('show', on); root.classList.toggle('docked', on); }
  if (IO && heroCtas) new IntersectionObserver(function (es) { var x = es[es.length - 1]; setDock(!x.isIntersecting && x.boundingClientRect.top < 0); }).observe(heroCtas);
  else setDock(true);

  /* スマホのメニュー */
  var mb = d.querySelector('.menu-btn'), mnav = d.getElementById('mnav');
  function menu(open) {
    mb.setAttribute('aria-expanded', open ? 'true' : 'false'); mnav.hidden = !open; top.classList.toggle('open', open); root.classList.toggle('menu-open', open);
    if (open) { var f = mnav.querySelector('a'); if (f) f.focus(); }
  }
  if (mb && mnav) {
    mb.addEventListener('click', function () { menu(mnav.hidden); });
    [].forEach.call(mnav.querySelectorAll('a'), function (a) { a.addEventListener('click', function () { menu(false); }); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !mnav.hidden) { menu(false); mb.focus(); } });
    d.addEventListener('pointerdown', function (e) { if (!mnav.hidden && !top.contains(e.target)) menu(false); }, { passive: true });
  }

  /* 電話の受付時間（12:00〜17:00 JST）外は電話ボタンを薄くし、受付時間を出す */
  try {
    var h = new Date(Date.now() + 9 * 3600e3).getUTCHours();
    if (h < 12 || h >= 17) [].forEach.call(d.querySelectorAll('.dock .call'), function (a) { a.classList.add('off'); });
  } catch (e) {}

  /* 画面に入った要素を表示（最初から画面内の要素は見えたまま） */
  var rises = [].slice.call(d.querySelectorAll('.rise'));
  if (IO && !reduce) {
    var ro = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.remove('pre'); ro.unobserve(x.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    rises.forEach(function (el) { if (el.getBoundingClientRect().top > w.innerHeight) { el.classList.add('pre'); ro.observe(el); } });
  }

  /* 動画は近づいたら読み込み、画面外では止める */
  var vids = [].slice.call(d.querySelectorAll('video[data-src]'));
  function load(v) { if (!v.src) { v.src = v.getAttribute('data-src'); } }
  if (IO) {
    var vo = new IntersectionObserver(function (es) {
      es.forEach(function (x) {
        var v = x.target;
        if (x.isIntersecting) { load(v); if (!reduce) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }
        else { try { v.pause(); } catch (e) {} }
      });
    }, { rootMargin: '200px 0px' });
    vids.forEach(function (v) { vo.observe(v); });
  } else vids.forEach(load);

  /* 水面（写真の上の波紋）。写真は <picture> が選んだもの（currentSrc）をそのまま使う（二重に読み込まない） */
  function ready(img, fn) {
    if (img.complete && img.naturalWidth) return fn();
    img.addEventListener('load', fn, { once: true });
  }
  if (!reduce && w.EthicaRipple) {
    [].forEach.call(d.querySelectorAll('[data-water]'), function (sec, i) {
      var cv = sec.querySelector('canvas'), img = sec.querySelector('img.still');
      if (!cv || !img) return;
      var start = function () {
        var lost = function () { sec.classList.remove('water'); };
        var r = new w.EthicaRipple(cv, img.currentSrc || img.src,
          i === 0 ? { ambient: 2600, zoomFrom: 1.0, zoomTo: 1.1, period: 22, dpr: 3, onLost: lost } : { ambient: 3200, zoomFrom: 1.0, zoomTo: 1.07, period: 30, dim: 0.62, onLost: lost });
        if (!r.ok) return;
        r.start(function () { sec.classList.add('water'); });
        r.bind(sec);
        if (i === 0) {
          var t0 = Date.now(), touched = function () { if (Date.now() - t0 > 1500) { sec.classList.add('touched'); sec.removeEventListener('pointerdown', touched); sec.removeEventListener('pointermove', touched); } };
          sec.addEventListener('pointerdown', touched, { passive: true }); sec.addEventListener('pointermove', touched, { passive: true });
        }
      };
      if (i === 0) ready(img, start);
      else if (IO) { var once = new IntersectionObserver(function (es) { if (es[es.length - 1].isIntersecting) { once.disconnect(); img.loading = 'eager'; ready(img, start); } }, { rootMargin: '300px 0px' }); once.observe(sec); }
    });
  }

  /* 年表：航路図は画面に入ると、番号と線が出てくる順に現れる。画面の中央にある皿の番号が、一覧と航路図の両方で光る */
  var legs = [].slice.call(d.querySelectorAll('.voyage .leg'));
  var route = d.querySelector('.route'), rps = route ? [].slice.call(route.querySelectorAll('.rp')) : [];
  if (route && IO && !reduce && route.getBoundingClientRect().top > w.innerHeight * 0.85) {
    route.classList.add('pre');
    var rpo = new IntersectionObserver(function (es) { if (es[es.length - 1].isIntersecting) { route.classList.remove('pre'); rpo.disconnect(); } }, { rootMargin: '0px 0px -15% 0px' });
    rpo.observe(route);
  }
  if (legs.length && IO) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (x) {
        if (!x.isIntersecting) return;
        var n = x.target.getAttribute('data-n');
        legs.forEach(function (li) { li.classList.toggle('cur', li === x.target); });
        rps.forEach(function (rp) { rp.classList.toggle('cur', rp.getAttribute('data-n') === n); });
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    legs.forEach(function (li) { co.observe(li); });
  }
  var eve = d.querySelector('.eve');
  if (eve && IO && !reduce) { var eo = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { eve.classList.add('go'); eo.disconnect(); } }, { threshold: 0.5 }); eo.observe(eve); }
})();
