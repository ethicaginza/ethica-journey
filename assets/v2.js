/* v2：ご利用シーンの切り替え。自分で場面を選ぶと、下の予約バーの行き先と、コースのカードの印がその場面に合わせて変わる。
   URL に ?scene=first|anniv|date|biz|short を付けると、その場面を選んだ状態で開く */
(function (w, d) {
  'use strict';
  var box = d.querySelector('[data-scenes]');
  if (!box) return;
  var tabs = [].slice.call(box.querySelectorAll('.sc-tab'));
  var panels = [].slice.call(box.querySelectorAll('.sc-panel'));
  if (!tabs.length || tabs.length !== panels.length) return;
  d.documentElement.classList.add('js');

  var KEY = 'ethica_scene';
  var dockA = d.querySelector('#dock a[data-cta="dock"]');
  var dockMain = dockA && dockA.querySelector('.d-main');
  var recLabel = box.getAttribute('data-rec') || '';

  function link(base, content, term) {
    return base + '?utm_source=ethica_lp&utm_medium=referral&utm_campaign=lp_2026autumn&utm_content=' + content + '&utm_term=' + term;
  }
  function panelOf(key) {
    for (var i = 0; i < panels.length; i++) if (panels[i].getAttribute('data-scene') === key) return panels[i];
    return null;
  }
  function mark(course) {
    [].forEach.call(d.querySelectorAll('.rec-tag'), function (el) { el.parentNode.removeChild(el); });
    [].forEach.call(d.querySelectorAll('.card.rec'), function (el) { el.classList.remove('rec'); });
    var host = d.getElementById('c-' + course);
    if (!host || !recLabel) return;
    var card = host.classList.contains('card') ? host : host.querySelector('.card');
    if (!card) return;
    card.classList.add('rec');
    var tag = d.createElement('span');
    tag.className = 'rec-tag';
    tag.textContent = recLabel;
    card.insertBefore(tag, card.querySelector('.use') || card.firstChild);
  }
  function personalize(p) {
    var key = p.getAttribute('data-scene');
    if (dockA && dockMain) {
      var arrow = dockMain.querySelector('.arrow');
      dockMain.textContent = p.getAttribute('data-dock') || '';
      if (arrow) dockMain.appendChild(arrow);
      dockA.setAttribute('href', link(p.getAttribute('data-href'), 'dock', 'scene_' + key));
      dockA.setAttribute('data-scene', key);
      dockA.classList.add('sc-on');
    }
    mark(p.getAttribute('data-course'));
  }
  function select(key, chosen, focus) {
    var p = panelOf(key);
    if (!p) return false;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-scene') === key;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panels.forEach(function (x) { x.hidden = x !== p; });
    if (chosen) {
      personalize(p);
      try { w.sessionStorage.setItem(KEY, key); } catch (e) {}
    }
    return true;
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () {
      var key = t.getAttribute('data-scene');
      select(key, true, false);
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ event: 'scene_select', scene: key });
    });
    t.addEventListener('keydown', function (ev) {
      var n = ev.key === 'ArrowRight' ? i + 1 : ev.key === 'ArrowLeft' ? i - 1 : ev.key === 'Home' ? 0 : ev.key === 'End' ? tabs.length - 1 : -1;
      if (n < 0 && ev.key !== 'ArrowLeft') return;
      ev.preventDefault();
      n = (n + tabs.length) % tabs.length;
      select(tabs[n].getAttribute('data-scene'), true, true);
    });
  });

  // 隠れている場面の写真は、読み込みが落ち着いてから先に取っておく（切り替えたときに空白を見せない）
  function warm() { panels.forEach(function (p) { var im = p.querySelector('img[loading="lazy"]'); if (im) im.loading = 'eager'; }); }
  if (d.readyState === 'complete') setTimeout(warm, 1200); else w.addEventListener('load', function () { setTimeout(warm, 1200); });

  var first = tabs[0].getAttribute('data-scene');
  var asked = null, saved = null;
  try { asked = new URLSearchParams(w.location.search).get('scene'); } catch (e) {}
  try { saved = w.sessionStorage.getItem(KEY); } catch (e) {}
  if (!(asked && select(asked, true, false)) && !(saved && select(saved, true, false))) select(first, false, false);
})(window, document);
