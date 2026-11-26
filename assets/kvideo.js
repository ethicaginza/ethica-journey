/* コンセプト欄のインタビュー動画（2026-11-26）
   画面に入ったら音なしで自動再生し、出たら止める。音声ボタンは、音なしの間はうっすら見え、
   音を出すと消える（動画に触れる・マウスを乗せると、薄く出て音を消せる）。 */
(function (w, d) {
  'use strict';
  var fig = d.querySelector('.k-vid');
  if (!fig) return;
  var v = fig.querySelector('video'), btn = fig.querySelector('.snd');
  if (!v || !btn) return;
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var loaded = false, inView = false, firstSound = true, hideT = 0;

  function load() {
    if (loaded) return;
    loaded = true;
    v.src = v.getAttribute('data-src');
    v.load();
  }
  function play() { load(); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  function setSound(on) {
    v.muted = !on;
    fig.classList.toggle('sound-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) {
      if (firstSound) { firstSound = false; try { v.currentTime = 0; } catch (e) {} }
      play();
      peek(false);
    }
  }
  // 音が出ている間、ボタンを一時的に薄く見せる（数秒で消える）
  function peek(show) {
    clearTimeout(hideT);
    fig.classList.toggle('peek', !!show);
    if (show) hideT = setTimeout(function () { fig.classList.remove('peek'); }, 2600);
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    setSound(v.muted);
  });
  fig.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' && !v.muted) peek(true); });
  fig.addEventListener('click', function () { if (!v.muted) peek(true); });

  if ('IntersectionObserver' in w) {
    new IntersectionObserver(function (es) {
      inView = es[es.length - 1].isIntersecting;
      if (inView) { if (!reduce || !v.muted) play(); }
      else if (loaded) v.pause();
    }, { threshold: 0.45 }).observe(fig);
    // 早めに読み込みを始める（画面の少し手前）
    new IntersectionObserver(function (es, o) {
      if (es[es.length - 1].isIntersecting) { load(); o.disconnect(); }
    }, { rootMargin: '600px 0px' }).observe(fig);
  } else { play(); }
  d.addEventListener('visibilitychange', function () { if (d.hidden && loaded) v.pause(); else if (inView && (!reduce || !v.muted)) play(); });
})(window, document);
