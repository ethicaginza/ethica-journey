(function () {
  'use strict';
  var d = document, w = window, root = d.documentElement;
  root.classList.add('js');
  if (/[?&]shot=1/.test(location.search)) { root.classList.add('shot'); var off = (location.search.match(/[?&]off=(\d+)/) || [])[1]; if (off) w.addEventListener('load', function () { w.scrollTo(0, +off); }); }
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = w.matchMedia && w.matchMedia('(pointer: coarse)').matches;
  var IO = 'IntersectionObserver' in w;

  /* ヘッダーの背景・スマホの固定予約バー（出ているあいだはヘッダーの予約ボタンを隠す） */
  var top = d.getElementById('top'), dock = d.getElementById('dock'), heroCtas = d.getElementById('hero-ctas');
  function onScroll() { top.classList.toggle('solid', (w.scrollY || 0) > 40); }
  w.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  // 予約バーは、トップの予約ボタンが画面の上に流れた後に出す。最後の予約ボタンが見えている間は隠す（同じボタンを重ねない）
  var pastHero = false, inlineOn = false;
  function setDock() { var on = pastHero && !inlineOn; dock.classList.toggle('show', on); root.classList.toggle('docked', pastHero); }
  if (IO && heroCtas) {
    var hdrH = (top && top.offsetHeight) || 68;
    new IntersectionObserver(function (es) { var x = es[es.length - 1]; pastHero = !x.isIntersecting; setDock(); }, { rootMargin: '-' + hdrH + 'px 0px 0px 0px' }).observe(heroCtas);
    // 金のボタン（最後の節・年代図の後・コレクションのカード）が画面に見えている間は、予約バーを隠す
    var inl = [].slice.call(d.querySelectorAll('.final .btn-gold, .tl-cta .btn, .card.mid .btn')), seen = [];
    var io2 = new IntersectionObserver(function (es) {
      es.forEach(function (x) { var k = seen.indexOf(x.target); if (x.isIntersecting && k < 0) seen.push(x.target); else if (!x.isIntersecting && k >= 0) seen.splice(k, 1); });
      inlineOn = seen.length > 0; setDock();
    }, { rootMargin: '-' + hdrH + 'px 0px -' + Math.max(90, (dock && dock.offsetHeight) || 0) + 'px 0px' });
    inl.forEach(function (b) { io2.observe(b); });
  } else { pastHero = true; setDock(); }

  /* 一番上のスライドショー（公式サイトと同じ）：4枚を3秒ごとに（2026-10-21 オーナー指示で5秒→3秒）。画面の外・別のタブの間は止める。動きを減らす設定では1枚目のまま */
  var ss = d.getElementById('ss');
  if (ss) {
    var sl = [].slice.call(ss.querySelectorAll('.ss-slide')), si = 0, sOn = true;
    var bg = function (el) { if (!el.style.backgroundImage) el.style.backgroundImage = 'url(' + el.getAttribute('data-bg') + ')'; };
    bg(sl[0]); requestAnimationFrame(function () { requestAnimationFrame(function () { sl[0].classList.add('on'); }); });
    if (!reduce && sl.length > 1) {
      w.addEventListener('load', function () { sl.forEach(function (el, i) { if (i) { var im = new Image(); im.src = el.getAttribute('data-bg'); } }); });
      setInterval(function () {
        if (!sOn || d.hidden) return;
        var cur = sl[si]; si = (si + 1) % sl.length; bg(sl[si]); cur.classList.remove('on'); sl[si].classList.add('on');
      }, 3000);
      if (IO) new IntersectionObserver(function (es) { sOn = es[es.length - 1].isIntersecting; }).observe(ss);
    }
    // スライドショーがヘッダーの下にある間は、ヘッダーの左にミシュランの印（ロゴは中央にあるため）
    var overSS = function () { top.classList.toggle('over-ss', ss.getBoundingClientRect().bottom > ((top && top.offsetHeight) || 68)); };
    w.addEventListener('scroll', overSS, { passive: true }); w.addEventListener('resize', overSS); overSS();
  }

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
  function hours() {
    try {
      var h = new Date(Date.now() + 9 * 3600e3).getUTCHours(), off = h < 12 || h >= 17;
      [].forEach.call(d.querySelectorAll('.dock .call'), function (a) { a.classList.toggle('off', off); });
    } catch (e) {}
  }
  hours(); d.addEventListener('visibilitychange', function () { if (!d.hidden) hours(); });

  /* 画面に入った要素を表示（最初から画面内の要素は見えたまま） */
  if (w.matchMedia && w.matchMedia('(max-width: 900px)').matches) {
    var stx = d.querySelector('.story .text');
    if (stx) { stx.classList.remove('rise'); [].forEach.call(stx.children, function (el) { el.classList.add('rise'); }); }
    [].forEach.call(d.querySelectorAll('.points li, .items > div'), function (el) { el.classList.add('rise'); });
  }
  if (w.matchMedia && w.matchMedia('(max-width: 600px)').matches) { var gal = d.querySelector('.gallery'); if (gal) gal.setAttribute('tabindex', '0'); }
  var rises = [].slice.call(d.querySelectorAll('.rise'));
  if (IO && !reduce) {
    var ro = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.remove('pre'); ro.unobserve(x.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    rises.forEach(function (el) { if (el.getBoundingClientRect().top > w.innerHeight) { el.classList.add('pre'); ro.observe(el); } });
  }

  /* 動画は近づいたら読み込み、画面外では止める */
  var vids = [].slice.call(d.querySelectorAll('video[data-src]:not(.dv)'));
  /* 文字の裏の暗い動画（縦長の画面は縦長版、横長の画面＝PCなどは横長版）。静止画は読み込み直後に付け、動画は節が画面に入ってから読み、出たら止める（先読みしない） */
  var dvs = [].slice.call(d.querySelectorAll('video.dv')), dvOn = false;
  var dvWide = w.innerWidth > w.innerHeight; // 横長の画面（PC・タブレットの横向き）は横長版
  var dvInit = function () {
    if (dvOn || !dvs.length) return; dvOn = true;
    dvs.forEach(function (v) { v.poster = (dvWide && v.getAttribute('data-poster-w')) || v.getAttribute('data-poster'); });
    if (IO && !reduce) {
      var dvo = new IntersectionObserver(function (es) {
        es.forEach(function (x) {
          var v = x.target;
          if (x.isIntersecting) { if (!v.src) v.src = (w.innerWidth > w.innerHeight && v.getAttribute('data-src-w')) || v.getAttribute('data-src'); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
          else { try { v.pause(); } catch (e) {} }
        });
      });
      dvs.forEach(function (v) { dvo.observe(v); });
    }
  };
  dvInit();
  var smallScr = w.matchMedia && w.matchMedia('(max-width: 600px)').matches;
  function load(v) {
    if (v.src) return;
    var m = smallScr && v.getAttribute('data-src-m');
    if (m) v.addEventListener('error', function () { v.src = v.getAttribute('data-src'); }, { once: true });
    v.src = m || v.getAttribute('data-src');
  }
  if (IO) {
    var vo = new IntersectionObserver(function (es) {
      es.forEach(function (x) {
        var v = x.target;
        if (x.isIntersecting) { if (reduce) return; load(v); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else { try { v.pause(); } catch (e) {} }
      });
    }, { rootMargin: '200px 0px' });
    /* トップの写真と回線を取り合わないよう、ページの読み込みが終わってから見張る */
    var watch = function () { vids.forEach(function (v) { vo.observe(v); }); };
    if (d.readyState === 'complete') watch(); else w.addEventListener('load', watch);
  } else vids.forEach(load);

  /* 水面（写真の上の波紋）。写真は <picture> が選んだもの（currentSrc）をそのまま使う（二重に読み込まない） */
  function ready(img, fn) {
    if (img.complete && img.naturalWidth) return fn();
    img.addEventListener('load', fn, { once: true });
  }
  var unreg = function (r) { var a = w.__waterImg || [], k = a.indexOf(r); if (k >= 0) a.splice(k, 1); };
  /* トップ（セノーテ）：見出し（ミシュランの一行と h1）と説明文の裏だけ楕円で少し暗くする。位置と大きさを CSS（.hero::after の radial-gradient）へ渡す */
  var heroS = d.getElementById('hero');
  if (heroS) {
    var hsA = heroS.querySelector('.inner .eyebrow'), hsB = heroS.querySelector('.inner h1'), hsC = heroS.querySelector('.inner .sub');
    var tr = function (el) { var g = d.createRange(); g.selectNodeContents(el); return g.getBoundingClientRect(); };
    var fitH = function () {
      if (!hsB) return; var hb = heroS.getBoundingClientRect(), b = tr(hsB), a = hsA ? tr(hsA) : b, c = hsC ? tr(hsC) : b; // 見出しの下の説明文まで含める
      var l = Math.min(a.left, b.left, c.left), r = Math.max(a.right, b.right, c.right), t = Math.min(a.top, b.top), m = Math.max(a.bottom, b.bottom, c.bottom);
      var st = heroS.style; st.setProperty('--hs-x', Math.round((l + r) / 2 - hb.left) + 'px'); st.setProperty('--hs-y', Math.round((t + m) / 2 - hb.top) + 'px');
      st.setProperty('--hs-rx', Math.round((r - l) / 2 + 150) + 'px'); st.setProperty('--hs-ry', Math.round((m - t) / 2 + 110) + 'px');
    };
    fitH(); w.addEventListener('resize', fitH); w.addEventListener('load', fitH);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(fitH);
  }
  /* フィロソフィーの見出しと最初の段落の裏の写し：高さを、「時空の断片を…」の手前まで合わせる（そこから下は今の背景） */
  var khbg = d.querySelector('.k-hbg');
  if (khbg) {
    var kSec = khbg.closest('section'), kLede = kSec && kSec.querySelector('.k-grid .lede');
    var kHead = kSec && kSec.querySelector('.k-head'), kLead = kSec && kSec.querySelector('.k-lead'), kImg = kSec && kSec.querySelector('.k-img'), kH2 = kSec && kSec.querySelector('h2');
    // 節の上端からの位置。浮き上がりの動き（.rise の translateY）に左右されないよう、配置上の位置で測る
    var oy = function (el) { var y = 0, e = el; while (e && e !== kSec) { y += e.offsetTop; e = e.offsetParent; } return e === kSec ? y : el.getBoundingClientRect().top - kSec.getBoundingClientRect().top; };
    var mq = function (q) { return !!(w.matchMedia && w.matchMedia(q).matches); };
    var px = function (k, v) { khbg.style.setProperty(k, Math.round(v) + 'px'); };
    var fitK = function () {
      if (!kLede) return;
      // 下端：1段では「時空の断片を…」の手前まで。下の 72px で今の背景（動画）へ溶かす（CSS の mask）
      var two = mq('(min-width: 901px)'), land = !mq('(max-aspect-ratio: 4/5)');
      var kRest = kSec.querySelector('.k-rest'), kGrid = kSec.querySelector('.k-grid');
      if (two && kRest && kGrid) {
        // 2段組み：下の段（料理の写真と「時空の断片を…」）の上端を決め、段の間（--k-extra）にする
        var gap = parseFloat(getComputedStyle(kGrid).rowGap) || 0, kg = parseFloat(getComputedStyle(kGrid).columnGap) || 0;
        var top0 = oy(kRest) - gap; // 本文の下端（段の間を除いた位置）
        // 横長では、写真（3:2）の全体が見える高さ H まで帯を伸ばす。下の段は、本文から節の上の余白と同じだけ空け、
        // 帯の 68% の所より下で始める（余白をそろえる・オーナー指示）。帯はそこから暗くなり、下の段の文字の裏は暗い（CSS の --k-t）
        var H = land ? Math.round(khbg.clientWidth * 2 / 3) : 0, pad = parseFloat(getComputedStyle(kSec).paddingTop) || kg;
        var T = land ? Math.max(top0 + pad, Math.round(H * 0.68)) : top0 + kg;
        px('--k-t', T);
        var ng = Math.round(T - top0);
        if (Math.abs(ng - gap) >= 1) kSec.style.setProperty('--k-extra', ng + 'px');
        // 写真は高さ H のまま置き（上の木まで見える大きさ）、見せる範囲は下の段の少し下（T + 110px）まで。そこから下は今の背景（動画の水面）
        if (H) { px('--k-stage-h', H); px('--khbg-h', Math.min(Math.max(T, H), T + 110)); }
        else { khbg.style.removeProperty('--k-stage-h'); px('--khbg-h', T); }
      } else {
        kSec.style.removeProperty('--k-extra'); khbg.style.removeProperty('--k-stage-h');
        // 1段：本文の下に料理の写真が来るときは、写真の上端から 60px 下まで（溶かす所は写真の裏に隠れる）。そうでなければ「時空の断片を…」の手前まで
        var it = kImg ? oy(kImg) : 0;
        px('--khbg-h', Math.max(0, it > oy(kLede) ? it + 60 : kLead ? oy(kLead) : oy(kLede) + kLede.offsetHeight + 10));
      }
      // 見出しと本文の裏だけ少し暗くする覆いの位置と大きさ（CSS の radial-gradient）
      var hb = khbg.getBoundingClientRect();
      if (kHead) {
        var ht = oy(kHead), hh = kHead.offsetHeight; px('--kh-y', ht + hh / 2); px('--kh-r', hh / 2 + 56);
        if (kH2) { var g = d.createRange(); g.selectNodeContents(kH2); var tb = g.getBoundingClientRect(); px('--kh-x', (tb.left + tb.right) / 2 - hb.left); px('--kh-rx', (tb.right - tb.left) / 2 + 160); }
      }
      var lb = kLede.getBoundingClientRect(), lt = oy(kLede), lh = kLede.offsetHeight;
      px('--kl-x', (lb.left + lb.right) / 2 - hb.left); px('--kl-rx', (lb.right - lb.left) / 2 + 150); px('--kl-y', lt + lh / 2); px('--kl-ry', lh / 2 + 90);
    };
    fitK(); w.addEventListener('resize', fitK); w.addEventListener('load', fitK);
    if (w.ResizeObserver) new ResizeObserver(fitK).observe(kSec);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(fitK);
  }
  if (!reduce && w.EthicaRipple) {
    [].forEach.call(d.querySelectorAll('[data-water]'), function (sec, i) {
      var cv = sec.querySelector('canvas'), img = sec.querySelector('img.still');
      if (!cv || !img) return;
      var tries = 0, lostT = 0, r = null, cur = img.currentSrc;
      var top0 = d.getElementById('top');
      // トップ（セノーテの水中・型なしで全面が揺れる）と、フィロソフィーの見出しの裏（テーブルの写真・青いレジンの型で切り抜く）
      var heroLike = i === 0 || sec.hasAttribute('data-water-copy');
      var host = sec.closest('section') || sec; // 指を受ける範囲（写しは節全体で受け、描画面の矩形の中だけ立てる）
      // 一番上にいる間（ヘッダーが透明な間）は、ヘッダーの帯の下でも指を受ける。ロゴ・メニューの釦と、開いたメニューの中では立てない
      var accept = i === 0 ? function (t) { return !!(top0 && top0.contains(t) && !top0.classList.contains('solid') && !root.classList.contains('menu-open') && !(t.closest && t.closest('a,button'))); } : null;
      var madeAt = 0;
      var lost = function () {
        sec.classList.remove('water');
        if (Date.now() - madeAt > 30000) tries = 0; // 30秒以上もった後の喪失は、数え直す（続けて失敗するときだけ3回で止める）
        // 文脈が戻らない端末への保険：見えている状態で2.5秒たっても戻らなければ、描画面を作り直す（3回まで）
        clearTimeout(lostT); lostT = setTimeout(retry, 2500);
      };
      var back = function () { clearTimeout(lostT); sec.classList.add('water'); if (img.currentSrc && img.currentSrc !== r.src) r.setSrc(img.currentSrc); };
      var retry = function () {
        if (!r || r.ok || tries >= 3) return;
        if (d.hidden) { d.addEventListener('visibilitychange', function f() { if (!d.hidden) { d.removeEventListener('visibilitychange', f); lostT = setTimeout(retry, 1500); } }); return; }
        var b = cv.getBoundingClientRect(); if (b.bottom < 0 || b.top > w.innerHeight) { lostT = setTimeout(retry, 2500); return; } // 写真が見えてから作り直す
        tries++; unreg(r); r.destroy(); if (i === 0) w.__heroRipple = null;
        var nc = cv.cloneNode(false); cv.parentNode.replaceChild(nc, cv); cv = nc; make();
        if (!r.ok) { lostT = setTimeout(retry, 2500); } // 作り直しに失敗したら、また試す（3回まで）
      };
      var make = function () {
        madeAt = Date.now();
        r = new w.EthicaRipple(cv, img.currentSrc || img.src,
          heroLike ? { ambient: coarse ? 0 : 2600, pert: coarse ? 0.06 : 0.03, zoomFrom: 1.0, zoomTo: 1.2, period: 14, panY: 0.02, dpr: 3, lite: coarse, thr: coarse ? 0.015 : 0.03, touch: { r: 42, s: 0.2, move: 0.06, echo: true }, onTap: function (x, y) { if (w.__pondHero) w.__pondHero(x, y, r); }, onLost: lost, onBack: back, mask: sec.hasAttribute('data-water-copy') ? { landscape: 'assets/img/hero_mask.png?v=5', portrait: 'assets/img/hero_mask_m.png?v=5' } : null } : { ambient: coarse ? 0 : 3200, pert: coarse ? 0.06 : 0.03, zoomFrom: 1.0, zoomTo: 1.07, period: 30, dim: 0.62, onLost: lost, onBack: back });
        if (!r.ok) return;
        if (i === 0 && /[?&]debugdrops=1/.test(location.search)) { w.__drops = []; var od = r.drop; r.drop = function (x, y, rad, st) { w.__drops.push([Math.round(x), Math.round(y), st]); return od.apply(r, arguments); }; }
        r.start(function () { sec.classList.add('water'); });
        if (i === 0) w.__heroRipple = { r: r, el: cv };
        if (heroLike) (w.__waterImg = w.__waterImg || []).push(r); // 金の輪（pond.js）が、どの水面の型で切り抜くかを知るため
        r.bind(host, accept);
        cur = img.currentSrc;
      };
      var start = function () {
        make();
        if (!r || !r.ok) return;
        // ページに戻ったとき（別のアプリ・タブから）、文脈が失われたままなら作り直す
        w.addEventListener('pageshow', function () { if (r && !r.ok) { clearTimeout(lostT); lostT = setTimeout(retry, 1500); } });
        if (heroLike) {
          var swap = function () { if (img.currentSrc && img.currentSrc !== cur) { cur = img.currentSrc; r.setSrc(cur); } };
          img.addEventListener('load', swap); w.addEventListener('resize', function () { setTimeout(swap, 300); });
        }
        if (i === 0) {
          setTimeout(function () { sec.classList.add('touched'); }, 9000);
          var t0 = Date.now(), touched = function () { if (Date.now() - t0 > 1500) { sec.classList.add('touched'); sec.removeEventListener('pointerdown', touched); sec.removeEventListener('pointermove', touched); } };
          sec.addEventListener('pointerdown', touched, { passive: true }); sec.addEventListener('pointermove', touched, { passive: true });
        }
      };
      if (i === 0) ready(img, start);
      else if (IO) { var once = new IntersectionObserver(function (es) { if (es[es.length - 1].isIntersecting) { once.disconnect(); img.loading = 'eager'; ready(img, start); } }, { rootMargin: '300px 0px' }); once.observe(sec); }
    });
  }

  /* 背景が動画の所（物語・フィロソフィーの文字の裏、最後の節）にも水面。動画が読み込まれてから作る（読み込みは動画の監視がする）。
     自動の波紋は立てない（文字の裏をチラつかせない）。指・マウスで触れた所だけ揺れる */
  if (!reduce && w.EthicaRipple) {
    [].forEach.call(d.querySelectorAll('[data-water-v]'), function (sec) {
      var cv = sec.querySelector('canvas.wv'), vv = sec.querySelector('video'); if (!cv || !vv) return;
      var rv = null, made = false, tries = 0, lostT = 0;
      var show = function () { sec.classList.add('wv-on'); }, hide = function () { sec.classList.remove('wv-on'); };
      var retry = function () { // 文脈が戻らないときは描画面を作り直す
        if (!rv || rv.ok || tries >= 3) return;
        if (d.hidden) { d.addEventListener('visibilitychange', function f() { if (!d.hidden) { d.removeEventListener('visibilitychange', f); lostT = setTimeout(retry, 1500); } }); return; }
        tries++; rv.destroy(); sec.classList.remove('wv-ready');
        var nc = cv.cloneNode(false); cv.parentNode.replaceChild(nc, cv); cv = nc; build();
        if (!rv.ok) lostT = setTimeout(retry, 2500);
      };
      var build = function () {
        var kh = sec.querySelector('.k-hbg');
        rv = new w.EthicaRipple(cv, vv, { video: true, ambient: 0, skip: kh ? function (x, y) { var b = kh.getBoundingClientRect(); return y >= b.top && y <= b.bottom && x >= b.left && x <= b.right; } : null, pert: coarse ? 0.08 : 0.05, glint: 0.3, zoomFrom: 1, zoomTo: 1, pan: 0, period: 30, dpr: 1, lite: coarse, thr: coarse ? 0.012 : 0.02, dim: parseFloat(cv.getAttribute('data-dim')) || 1,
          sleep: 2500, onSleep: hide, onWake: show, touch: { r: 44, s: 0.24, move: 0.05, echo: true, onEnd: true },
          onLost: function () { hide(); clearTimeout(lostT); lostT = setTimeout(retry, 2500); }, onBack: function () { clearTimeout(lostT); } });
        if (!rv.ok) return;
        rv.start(function () { sec.classList.add('wv-ready'); }); // 最初は眠った状態（動画をそのまま見せる）。触れたら描画面に切り替わる
        rv.bind(sec);
        (w.__waterV = w.__waterV || []).push({ r: rv, el: cv, sec: sec }); // 点検用
      };
      var make = function () { if (made) return; made = true; build(); };
      vv.addEventListener('loadeddata', make, { once: true }); if (vv.readyState >= 2) make();
    });
  }

  /* 点検用（?rdebug=1）：トップの水面の状態を画面の左下に出す。実機で「効かない時」の状態を確かめるため */
  if (/[?&]rdebug=1/.test(location.search)) {
    var dbg = d.createElement('div'); dbg.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99;font:11px/1.4 monospace;color:#9f9;background:rgba(0,0,0,.75);padding:4px 6px;pointer-events:none;white-space:pre';
    d.body.appendChild(dbg); var dn = 0, lastD = 0;
    setInterval(function () {
      var h = w.__heroRipple, r = h && h.r, gl = h && h.el.getContext && h.el.getContext('webgl');
      if (r && r.lastDrop !== lastD) { lastD = r.lastDrop; dn++; }
      dbg.textContent = r ? ('ok:' + r.ok + ' run:' + r.running + ' mask:' + r.maskOn + ' view:' + r.inView + '\nlost:' + (gl ? gl.isContextLost() : '-') + ' idle:' + !!r.idle + ' drops:' + dn + '\nsrc:' + String(r.src || '').split('/').pop()) : 'ripple: none (reduce=' + reduce + ')';
    }, 250);
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
        if (route) { route.classList.toggle('has-cur', +n >= 2 && +n <= 8); [].forEach.call(route.querySelectorAll('.seg'), function (sg) { sg.classList.toggle('on', sg.getAttribute('data-to') === n); }); }
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    legs.forEach(function (li) { co.observe(li); });
  }
  /* スマホ：皿の一覧を読んでいる間だけ、上に細い年代図を出す。帯のすぐ下の「読む位置」にある皿を光らせ、前の皿からの移動を弧で描く。
     帯のどこを押しても、いちばん近い番号の皿へ移る（移った皿は読む位置に来るので、帯は消えず、押した番号が光る） */
  var mini = d.querySelector('.tl-mini'), voyage = d.getElementById('voyage');
  if (mini && voyage) {
    var info = {}; mini.getAttribute('data-info').split(';').forEach(function (r) { var a = r.split('|'); info[a[0]] = { ago: a[1], t: a[2] }; });
    var pins = [].slice.call(mini.querySelectorAll('.tm-p')), axis = mini.querySelector('.tm-axis'), arc = mini.querySelector('.tm-arc'), arcPath = arc && arc.querySelector('path');
    var nEl = mini.querySelector('.tm-n'), agoEl = mini.querySelector('.tm-ago'), tEl = mini.querySelector('.tm-t');
    var legsArr = [].slice.call(voyage.querySelectorAll('.leg')), curMini = 0;
    var xOf = function (n) { var p = mini.querySelector('.tm-p[data-n="' + n + '"]'); return p ? parseFloat(p.style.getPropertyValue('--x')) : 0; };
    var setMini = function (n) {
      var k = +n; if (!info[n] || k === curMini) return; curMini = k;
      pins.forEach(function (p) { var m = +p.getAttribute('data-n'); p.classList.toggle('cur', m === k); p.classList.toggle('seen', m < k); });
      nEl.textContent = k === 9 ? '最後に' : k + '皿目'; agoEl.textContent = info[n].ago; tEl.textContent = info[n].t;
      if (arc && k >= 2) {
        // 橋の形の線（両端で立ち上がる）。間の番号の上を越えるのに要る高さだけ持ち上げ、上の年代の文字には届かせない
        var a = xOf(k - 1), b = xOf(k), aw = axis.offsetWidth || 300, r = (pins[0].offsetWidth || 20) / 2 + 2, H = 12;
        pins.forEach(function (p) {
          var xp = xOf(p.getAttribute('data-n')), f = (xp - a) / (b - a);
          if (f <= 0 || f >= 1) return;
          var lo = 0, hi = 1; for (var q = 0; q < 20; q++) { var m = (lo + hi) / 2; if (3 * m * m - 2 * m * m * m < f) lo = m; else hi = m; }
          H = Math.max(H, r / (3 * lo * (1 - lo)));
        });
        H = Math.min(H, 20);
        arcPath.setAttribute('d', 'M' + a + ' 26 C' + a + ' ' + (26 - H) + ' ' + b + ' ' + (26 - H) + ' ' + b + ' 26');
        arc.classList.toggle('back', b < a); arc.classList.add('on');
      } else if (arc) arc.classList.remove('on');
    };
    var hdrEl = d.getElementById('top');
    var readLine = function () { var top0 = (hdrEl ? hdrEl.getBoundingClientRect().bottom : 68) + mini.offsetHeight; return top0 + (w.innerHeight - top0) * 0.3; };
    var mq = w.matchMedia ? w.matchMedia('(max-width: 900px) and (min-height: 501px)') : { matches: true };
    var onScrollMini = function () {
      if (!mq.matches) { mini.classList.remove('on'); return; }
      var r = voyage.getBoundingClientRect(), L = readLine(), on = r.top < L && r.bottom > L + 40;
      mini.classList.toggle('on', on);
      if (on) { for (var i = legsArr.length - 1; i >= 0; i--) { if (legsArr[i].getBoundingClientRect().top <= L) { setMini(legsArr[i].getAttribute('data-n')); break; } } }
    };
    setMini('1');
    var tick = 0; w.addEventListener('scroll', function () { if (tick) return; tick = requestAnimationFrame(function () { tick = 0; onScrollMini(); }); }, { passive: true });
    w.addEventListener('resize', onScrollMini); onScrollMini();
    axis.addEventListener('click', function (ev) {
      var b = axis.getBoundingClientRect(), x = (ev.clientX - b.left) / b.width * 100, best = null, bd = 1e9;
      pins.forEach(function (p) { var dd = Math.abs(xOf(p.getAttribute('data-n')) - x); if (dd < bd) { bd = dd; best = p; } });
      if (!best) return;
      var li = voyage.querySelector('.leg[data-n="' + best.getAttribute('data-n') + '"]'); if (!li) return;
      var y = li.getBoundingClientRect().top + w.scrollY - (readLine() - 28);
      w.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    });
  }
  var eve = d.querySelector('.eve');
  if (eve && IO && !reduce) { var eo = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { eve.classList.add('go'); eo.disconnect(); } }, { threshold: 0.5 }); eo.observe(eve); }
})();
