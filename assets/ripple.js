/* 水面の波紋（WebGL1）。写真をゆっくりズームしながら、ポインターの動き・クリック・タップで波紋を立てる。
   WebGLが使えない・動きを減らす設定の環境では何もしない（呼び出し側の静止画とCSSズームが残る）。
   画面外・別タブのあいだは描画を止める。GPUの文脈が失われたら静止画に戻す（opt.onLost）。 */
(function () {
  'use strict';
  var VS = 'attribute vec2 a;varying vec2 v;void main(){v=a*0.5+0.5;gl_Position=vec4(a,0.0,1.0);}';
  var DROP = 'precision highp float;uniform sampler2D t;uniform vec2 c;uniform float r;uniform float s;uniform vec2 px;varying vec2 v;' +
    'void main(){vec4 i=texture2D(t,v);float d=distance(v*px,c*px)/r;d=max(0.0,1.0-d);d=0.5-cos(d*3.14159265)*0.5;i.r+=d*s;gl_FragColor=i;}';
  var UPDATE = 'precision highp float;uniform sampler2D t;uniform vec2 dx;varying vec2 v;' +
    'void main(){vec4 i=texture2D(t,v);vec2 x=vec2(dx.x,0.0);vec2 y=vec2(0.0,dx.y);' +
    'float avg=(texture2D(t,v-x).r+texture2D(t,v-y).r+texture2D(t,v+x).r+texture2D(t,v+y).r)*0.25;' +
    'i.g+=(avg-i.r)*2.0;i.g*=0.986;i.r+=i.g;i.r*=0.9985;gl_FragColor=i;}';
  var RENDER = 'precision highp float;uniform sampler2D t;uniform sampler2D img;uniform vec2 dx;uniform vec2 cover;uniform float zoom;uniform vec2 pan;uniform float pert;uniform float dim;varying vec2 v;' +
    'void main(){float h=texture2D(t,v).r;float hx=texture2D(t,v+vec2(dx.x,0.0)).r;float hy=texture2D(t,v+vec2(0.0,dx.y)).r;' +
    'vec3 ddx=vec3(dx.x,hx-h,0.0);vec3 ddy=vec3(0.0,hy-h,dx.y);vec2 off=-normalize(cross(ddy,ddx)).xz;' +
    'float sp=pow(max(0.0,dot(off,normalize(vec2(-0.6,1.0)))),4.0);' +
    'vec2 iuv=(v-0.5)*cover/zoom+0.5+pan;iuv+=off*pert;iuv.y=1.0-iuv.y;' +
    'vec3 col=texture2D(img,clamp(iuv,0.001,0.999)).rgb*dim;' +
    'gl_FragColor=vec4(col+sp*vec3(0.95,0.82,0.55)*0.32,1.0);}';
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
    var cand = [], type = null;
    if (fl && fll) cand.push(gl.FLOAT); if (hf && hfl) cand.push(hf.HALF_FLOAT_OES); if (fl) cand.push(gl.FLOAT); if (hf) cand.push(hf.HALF_FLOAT_OES);
    for (var ci = 0; ci < cand.length; ci++) { if (this.testType(cand[ci])) { type = cand[ci]; break; } }
    if (!type) return false;
    this.type = type;
    this.pDrop = this.prog(DROP); this.pUpd = this.prog(UPDATE); this.pRen = this.prog(RENDER);
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
    var lin = (this.type === gl.FLOAT) ? gl.getExtension('OES_texture_float_linear') : gl.getExtension('OES_texture_half_float_linear');
    var f = lin ? gl.LINEAR : gl.NEAREST;
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
    var cap = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 2.6e6 : 3.5e6; // スマホは約260万画素まで
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
    gl.uniform2f(P.u.dx, 1 / this.sw, 1 / this.sh);
    var ca = this.cw / this.ch, ia = this.iw / this.ih;
    var cover = ca > ia ? [1, ia / ca] : [ca / ia, 1];
    var k = 0.5 - 0.5 * Math.cos((time / this.period) * Math.PI * 2 / 2); // 0→1→0 のゆっくりした往復
    var z = this.zoomFrom + (this.zoomTo - this.zoomFrom) * k;
    gl.uniform2f(P.u.cover, cover[0], cover[1]); gl.uniform1f(P.u.zoom, z);
    gl.uniform2f(P.u.pan, 0.01 * k * Math.sin(time / this.period * 1.3), -0.008 * k);
    gl.uniform1f(P.u.pert, 0.03); gl.uniform1f(P.u.dim, this.dim);
    this.quad();
  };
  Ripple.prototype.frame = function (now) {
    this.raf = 0;
    if (!this.running || !this.inView || !this.tabOn) return; // 止めるときは次のフレームを頼まない（kick で再開）
    var dt = Math.min(100, now - this.prev); this.prev = now;
    if (this.opt.ambient && now - this.lastAmb > this.opt.ambient) {
      this.lastAmb = now; this.drop(this.cw * (0.2 + 0.6 * Math.random()), this.ch * (0.2 + 0.6 * Math.random()), 26, 0.05);
    }
    this.acc += dt; var n = 0;
    while (this.acc >= STEP_MS && n < 8) { this.step(); this.acc -= STEP_MS; n++; }
    if (n === 8) this.acc = 0;
    this.render((now - this.t0) / 1000);
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
  Ripple.prototype.bind = function (target) {
    var self = this, lastMove = 0;
    function pos(e) { var r = self.c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    target.addEventListener('pointermove', function (e) {
      var now = performance.now(); if (now - lastMove < 16) return; lastMove = now;
      var p = pos(e); self.drop(p[0], p[1], e.pointerType === 'touch' ? 22 : 16, e.pointerType === 'touch' ? 0.035 : 0.022);
    }, { passive: true });
    target.addEventListener('pointerdown', function (e) { var p = pos(e); self.drop(p[0], p[1], 34, 0.16); }, { passive: true });
    var pend = 0, onSize = function () { if (pend) return; pend = requestAnimationFrame(function () { pend = 0; var r = self.c.getBoundingClientRect(); if (self.ok && (Math.abs(r.width - self.cw) >= 1 || Math.abs(r.height - self.ch) >= 1)) self.resize(); }); };
    var ro = window.ResizeObserver ? new ResizeObserver(onSize) : null;
    if (ro) ro.observe(this.c); else window.addEventListener('resize', onSize);
    if (window.matchMedia) { try { window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)').addEventListener('change', function () { self.resize(); }); } catch (e) {} }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { self.inView = es[es.length - 1].isIntersecting; self.kick(); }, { threshold: 0 }).observe(this.c);
    document.addEventListener('visibilitychange', function () { self.tabOn = !document.hidden; self.kick(); });
  };
  window.EthicaRipple = Ripple;
})();
