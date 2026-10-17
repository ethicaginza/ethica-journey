/* 水面の波紋（WebGL1）。写真をゆっくりズームしながら、ポインターの動き・クリック・タップで波紋を立てる。
   WebGLが使えない・動きを減らす設定の環境では何もしない（呼び出し側の静止画とCSSズームが残る）。
   画面外・別タブのあいだは描画を止める。GPUの文脈が失われたら静止画に戻す（opt.onLost）。 */
(function () {
  'use strict';
  var VS = 'attribute vec2 a;varying vec2 v;void main(){v=a*0.5+0.5;gl_Position=vec4(a,0.0,1.0);}';
  var DROP = 'precision highp float;uniform sampler2D t;uniform vec2 c;uniform float r;uniform float s;uniform vec2 px;varying vec2 v;' +
    'void main(){vec4 i=texture2D(t,v);float d=distance(v*px,c*px)/r;d=max(0.0,1.0-d);d=0.5-cos(d*3.14159265)*0.5;i.r+=d*s;gl_FragColor=i;}';
  // 波の更新。係数を安定域（2.0未満）にし、わずかにならして、半精度の誤差から市松模様のざらつきが育たないようにする
  var UPDATE = 'precision highp float;uniform sampler2D t;uniform vec2 dx;varying vec2 v;' +
    'void main(){vec4 i=texture2D(t,v);vec2 x=vec2(dx.x,0.0);vec2 y=vec2(0.0,dx.y);' +
    'float avg=(texture2D(t,v-x).r+texture2D(t,v-y).r+texture2D(t,v+x).r+texture2D(t,v+y).r)*0.25;' +
    'i.g+=(avg-i.r)*1.7;i.g*=0.986;i.r+=i.g;i.r=mix(i.r,avg,0.015)*0.9985;float k=smoothstep(0.0,0.0025,abs(i.r)+abs(i.g));i.r*=mix(0.93,1.0,k);i.g*=mix(0.93,1.0,k);gl_FragColor=i;}';
  // 描画：波の高さから傾きを出し、写真をわずかにずらす。小さな傾き（静止時に残る細かな揺れ）は写さない＝止まっている写真はくっきり
  function renderSrc(manual) {
    return 'precision highp float;uniform sampler2D t;uniform sampler2D img;uniform vec2 dx;uniform vec2 res;uniform vec2 cover;uniform float zoom;uniform vec2 pan;uniform float pert;uniform float dim;uniform float asp;varying vec2 v;' +
      (manual
        // 補間できないテクスチャ（iPhoneなど）では、4点を自分で混ぜて滑らかにする
        ? 'float H(vec2 uv){vec2 p=uv*res-0.5;vec2 f=fract(p);vec2 b=(floor(p)+0.5)/res;float a=texture2D(t,b).r;float c=texture2D(t,b+vec2(dx.x,0.0)).r;float e=texture2D(t,b+vec2(0.0,dx.y)).r;float g=texture2D(t,b+dx).r;return mix(mix(a,c,f.x),mix(e,g,f.x),f.y);}'
        : 'float H(vec2 uv){return texture2D(t,uv).r;}') +
      'void main(){float h=H(v);float hx=H(v+vec2(dx.x,0.0));float hy=H(v+vec2(0.0,dx.y));' +
      // 傾きはマス目あたりで縦横同じに扱い、ずらす量は画面のピクセルで縦横同じにする（波紋が楕円にならない）
      'vec3 ddx=vec3(1.0,(hx-h)*res.x,0.0);vec3 ddy=vec3(0.0,(hy-h)*res.x,1.0);vec2 off=-normalize(cross(ddy,ddx)).xz;' +
      'off*=smoothstep(0.03,0.12,length(off));' +
      'float sp=pow(max(0.0,dot(off,normalize(vec2(-0.6,1.0)))),4.0);' +
      'vec2 iuv=(v-0.5)*cover/zoom+0.5+pan;iuv+=off*pert*vec2(1.0,asp)*cover;iuv.y=1.0-iuv.y;' +
      'vec3 col=texture2D(img,clamp(iuv,0.001,0.999)).rgb*dim;' +
      'gl_FragColor=vec4(col+sp*vec3(0.95,0.82,0.55)*0.32,1.0);}';
  }
  var STEP_MS = 1000 / 120; // 1秒に120回シミュレーションを進める（画面の更新頻度によらず波の速さをそろえる）

  function Ripple(canvas, src, opt) {
    opt = opt || {};
    this.c = canvas; this.src = src; this.opt = opt;
    this.zoomFrom = opt.zoomFrom == null ? 1.0 : opt.zoomFrom; this.zoomTo = opt.zoomTo || 1.12; this.period = opt.period || 26;
    this.dim = opt.dim == null ? 1.0 : opt.dim;
    this.maxDpr = opt.dpr || 1.5;
    this.raf = 0; this.running = false; this.inView = true; this.tabOn = !document.hidden;
    this.ok = this.init();
  }
  Ripple.prototype.init = function () {
    var gl = this.c.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return false;
    this.gl = gl;
    // 波の計算用テクスチャの型：なめらかに補間できる（linear 拡張がある）型を優先する。iPhone では FLOAT に linear が無いことが多い
    var fl = gl.getExtension('OES_texture_float'), fll = fl && gl.getExtension('OES_texture_float_linear');
    var hf = gl.getExtension('OES_texture_half_float'), hfl = hf && gl.getExtension('OES_texture_half_float_linear');
    gl.getExtension('WEBGL_color_buffer_float'); gl.getExtension('EXT_color_buffer_half_float');
    var cand = [], type = null, force = (location.search.match(/[?&]glforce=([a-z-]+)/) || [])[1];
    if (force === 'half-nearest') { fll = null; hfl = null; fl = null; }
    if (fl && fll) cand.push([gl.FLOAT, true]); if (hf && hfl) cand.push([hf.HALF_FLOAT_OES, true]); if (fl) cand.push([gl.FLOAT, false]); if (hf) cand.push([hf.HALF_FLOAT_OES, false]);
    for (var ci = 0; ci < cand.length; ci++) { if (this.testType(cand[ci][0])) { type = cand[ci][0]; this.linear = cand[ci][1]; break; } }
    if (!type) return false;
    this.type = type;
    this.pDrop = this.prog(DROP); this.pUpd = this.prog(UPDATE); this.pRen = this.prog(renderSrc(!this.linear));
    if (!this.pDrop || !this.pUpd || !this.pRen) return false;
    this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var self = this;
    // GPUの文脈が失われたら、描画をやめて静止画に戻す（復帰はしない＝静止画のままにする仕様）
    this.c.addEventListener('webglcontextlost', function () {
      self.running = false; self.ok = false;
      if (self.raf) { cancelAnimationFrame(self.raf); self.raf = 0; }
      if (self.opt.onLost) self.opt.onLost();
    }, false);
    this.resize();
    return true;
  };
  Ripple.prototype.testType = function (type) {
    if (!type) return false;
    var gl = this.gl, tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, type, null);
    var fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0);
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(tx);
    return ok;
  };
  Ripple.prototype.prog = function (fs) {
    var gl = this.gl;
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; }
    var v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return null;
    var p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p: p, u: u };
  };
  Ripple.prototype.makeTarget = function (w, h) {
    var gl = this.gl, tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
    var f = this.linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, this.type, null);
    var fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { t: tx, f: fb };
  };
  Ripple.prototype.free = function (o) { if (o) { this.gl.deleteTexture(o.t); this.gl.deleteFramebuffer(o.f); } };
  /* 大きさが変わったら描画面を合わせる（安い）。波の計算用の格子は、格子の大きさが変わるときだけ作り直す。
     描画面の画素数は約350万までに抑える（5Kの画面などで重くしない）。 */
  Ripple.prototype.resize = function () {
    var r = this.c.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    var cap = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 3.0e6 : 3.5e6; // スマホは約300万画素まで
    var px = r.width * r.height * dpr * dpr; if (px > cap) dpr *= Math.sqrt(cap / px);
    this.W = Math.max(2, Math.round(r.width * dpr)); this.H = Math.max(2, Math.round(r.height * dpr));
    this.c.width = this.W; this.c.height = this.H;
    this.cw = r.width; this.ch = r.height;
    var sw = r.width > 900 ? 384 : 256, sh = Math.max(64, Math.round(sw * r.height / Math.max(1, r.width)));
    if (sh > 640) { sh = 640; sw = Math.round(sh * r.width / r.height); }
    if (sw === this.sw && Math.abs(sh - this.sh) < 24 && this.a) return;
    this.sw = sw; this.sh = sh;
    this.free(this.a); this.free(this.b);
    this.a = this.makeTarget(sw, sh); this.b = this.makeTarget(sw, sh);
  };
  Ripple.prototype.quad = function () { var gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  Ripple.prototype.swap = function () { var t = this.a; this.a = this.b; this.b = t; };
  Ripple.prototype.drop = function (x, y, radiusPx, strength) {
    if (!this.ok || !this.running) return;
    this.lastDrop = performance.now();
    var gl = this.gl, P = this.pDrop;
    gl.viewport(0, 0, this.sw, this.sh); gl.bindFramebuffer(gl.FRAMEBUFFER, this.b.f); gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.a.t); gl.uniform1i(P.u.t, 0);
    var m = Math.max(this.cw, this.ch);
    gl.uniform2f(P.u.c, x / this.cw, 1 - y / this.ch); gl.uniform1f(P.u.r, radiusPx / m);
    gl.uniform1f(P.u.s, strength); gl.uniform2f(P.u.px, this.cw / m, this.ch / m);
    this.quad(); this.swap();
  };
  Ripple.prototype.step = function () {
    var gl = this.gl, P = this.pUpd;
    gl.viewport(0, 0, this.sw, this.sh); gl.bindFramebuffer(gl.FRAMEBUFFER, this.b.f); gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.a.t); gl.uniform1i(P.u.t, 0);
    gl.uniform2f(P.u.dx, 1 / this.sw, 1 / this.sh); this.quad(); this.swap();
  };
  Ripple.prototype.render = function (time) {
    var gl = this.gl, P = this.pRen;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.W, this.H); gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.a.t); gl.uniform1i(P.u.t, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.img); gl.uniform1i(P.u.img, 1);
    gl.uniform2f(P.u.dx, 1 / this.sw, 1 / this.sh); gl.uniform2f(P.u.res, this.sw, this.sh); gl.uniform1f(P.u.asp, this.cw / this.ch);
    var ca = this.cw / this.ch, ia = this.iw / this.ih;
    var cover = ca > ia ? [1, ia / ca] : [ca / ia, 1];
    var k = 0.5 - 0.5 * Math.cos((time / this.period) * Math.PI * 2 / 2); // 0→1→0 のゆっくりした往復
    var z = this.zoomFrom + (this.zoomTo - this.zoomFrom) * k;
    gl.uniform2f(P.u.cover, cover[0], cover[1]); gl.uniform1f(P.u.zoom, z);
    gl.uniform2f(P.u.pan, 0.01 * k * Math.sin(time / this.period * 1.3), -0.008 * k);
    gl.uniform1f(P.u.pert, this.opt.pert || 0.03); gl.uniform1f(P.u.dim, this.dim);
    this.quad();
  };
  Ripple.prototype.frame = function (now) {
    this.raf = 0;
    if (!this.running || !this.inView || !this.tabOn) return; // 止めるときは次のフレームを頼まない（kick で再開）
    var dt = Math.min(100, now - this.prev); this.prev = now;
    if (this.opt.ambient && now - this.lastAmb > this.opt.ambient) {
      this.lastAmb = now; this.drop(this.cw * (0.2 + 0.6 * Math.random()), this.ch * (0.2 + 0.6 * Math.random()), 26, 0.05);
    }
    var idle = now - (this.lastDrop || 0) > 8000;
    this.acc += dt; var n = 0;
    if (idle) { this.acc = 0; this.odd = !this.odd; } // 波が消えた後は計算を止め、描画も1フレームおき（ズームだけ動かす）
    else { while (this.acc >= STEP_MS && n < 8) { this.step(); this.acc -= STEP_MS; n++; } if (n === 8) this.acc = 0; }
    if (!idle || this.odd || this.onFirst) this.render((now - this.t0) / 1000);
    if (this.onFirst) { var f = this.onFirst; this.onFirst = null; f(); }
    var self = this; this.raf = requestAnimationFrame(function (t) { self.frame(t); });
  };
  Ripple.prototype.kick = function () {
    if (this.raf || !this.running || !this.inView || !this.tabOn) return;
    var self = this; this.prev = performance.now(); this.acc = 0;
    this.raf = requestAnimationFrame(function (t) { self.frame(t); });
  };
  Ripple.prototype.start = function (onReady) {
    var self = this, gl = this.gl, im = new Image();
    im.decoding = 'async';
    im.onload = function () {
      if (!self.ok) return;
      self.iw = im.naturalWidth; self.ih = im.naturalHeight;
      self.img = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, self.img);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
      self.t0 = performance.now(); self.lastAmb = 0; self.running = true;
      self.onFirst = onReady || null; // 最初の1枚を描いてから知らせる（写真が一瞬暗くならないように）
      self.kick();
    };
    im.src = this.src;
  };
  Ripple.prototype.setSrc = function (src) {
    if (!this.ok || !this.running || src === this.src) return;
    var self = this, gl = this.gl, im = new Image(); this.src = src;
    im.onload = function () { if (!self.ok) return; self.iw = im.naturalWidth; self.ih = im.naturalHeight; gl.bindTexture(gl.TEXTURE_2D, self.img); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im); };
    im.src = src;
  };
  Ripple.prototype.bind = function (target) {
    var self = this, lastMove = 0, last = {};
    function rel(x, y) { var r = self.c.getBoundingClientRect(); return [x - r.left, y - r.top]; }
    // マウス：動かすと連続して、クリックで大きく
    target.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var now = performance.now(); if (now - lastMove < 16) return; lastMove = now;
      var p = rel(e.clientX, e.clientY); self.drop(p[0], p[1], 16, 0.022);
    }, { passive: true });
    target.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') return; var p = rel(e.clientX, e.clientY); self.drop(p[0], p[1], 34, 0.16); }, { passive: true });
    // 指：触れた所に波紋。滑らせている間も波紋を立て続ける
    target.addEventListener('touchstart', function (e) {
      var now = performance.now();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i], p = rel(t.clientX, t.clientY);
        last[t.identifier] = { x: p[0], y: p[1], t: now }; lastTouch = { x: t.clientX, y: t.clientY, t: now }; self.drop(p[0], p[1], 32, 0.12);
      }
    }, { passive: true });
    target.addEventListener('touchmove', function (e) {
      // 縦にスクロールしている間は、写真が指と一緒に動くので、写真の上では指はほぼ同じ点にある。
      // その間も波紋が途切れないよう、指の下に一定の間隔で波紋を立てる（横に滑らせたときは通り道に並べる）
      var now = performance.now(), r = self.c.getBoundingClientRect();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i], q = last[t.identifier], bx = t.clientX - r.left, by = t.clientY - r.top;
        if (!q) { last[t.identifier] = { x: bx, y: by, t: now }; continue; }
        var dx = bx - q.x, dy = by - q.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 10) {
          if (now - q.t < 50) continue;
          self.drop(bx, by, 30, 0.05);
        } else {
          var n = Math.min(8, Math.ceil(dist / 16));
          for (var k = 1; k <= n; k++) self.drop(q.x + dx * k / n, q.y + dy * k / n, 28, 0.045);
        }
        last[t.identifier] = { x: bx, y: by, t: now };
        lastTouch = { x: t.clientX, y: t.clientY, t: now };
      }
    }, { passive: true });
    // 指を離したあとの慣性スクロールの間も、最後に指があった画面の位置に波紋を立て続ける（写真が流れるので、航跡のように残る）
    var lastTouch = null, lastScrollY = window.scrollY, lastScrollT = 0;
    window.addEventListener('scroll', function () {
      var now = performance.now(), y = window.scrollY, v = Math.abs(y - lastScrollY); lastScrollY = y;
      if (!lastTouch || now - lastTouch.t > 1600 || now - lastScrollT < 50 || !self.inView) return;
      lastScrollT = now;
      var r = self.c.getBoundingClientRect(), x = lastTouch.x - r.left, yy = lastTouch.y - r.top;
      if (yy < 0 || yy > r.height) return;
      self.drop(x, yy, 28, Math.min(0.05, 0.03 + v * 0.0008));
    }, { passive: true });
    var end = function (e) { for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; delete last[t.identifier]; lastTouch = { x: t.clientX, y: t.clientY, t: performance.now() }; } };
    target.addEventListener('touchend', end, { passive: true }); target.addEventListener('touchcancel', end, { passive: true });
    var pend = 0, onSize = function () { if (pend) return; pend = requestAnimationFrame(function () { pend = 0; var r = self.c.getBoundingClientRect(); if (self.ok && (Math.abs(r.width - self.cw) >= 1 || Math.abs(r.height - self.ch) >= 1)) self.resize(); }); };
    var ro = window.ResizeObserver ? new ResizeObserver(onSize) : null;
    if (ro) ro.observe(this.c); else window.addEventListener('resize', onSize);
    if (window.matchMedia) { try { window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)').addEventListener('change', function () { self.resize(); }); } catch (e) {} }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { self.inView = es[es.length - 1].isIntersecting; self.kick(); }, { threshold: 0 }).observe(this.c);
    document.addEventListener('visibilitychange', function () { self.tabOn = !document.hidden; self.kick(); });
  };
  window.EthicaRipple = Ripple;
})();
