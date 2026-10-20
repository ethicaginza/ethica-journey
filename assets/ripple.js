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
    return 'precision highp float;uniform sampler2D t;uniform sampler2D img;uniform vec2 dx;uniform vec2 res;uniform vec2 cover;uniform float zoom;uniform vec2 pan;uniform float pert;uniform float dim;uniform float asp;uniform sampler2D msk;uniform float um;uniform float live;uniform float thr;uniform float glint;varying vec2 v;' +
      (manual
        // 補間できないテクスチャ（iPhoneなど）では、4点を自分で混ぜて滑らかにする
        ? 'float H(vec2 uv){vec2 p=uv*res-0.5;vec2 f=fract(p);vec2 b=(floor(p)+0.5)/res;float a=texture2D(t,b).r;float c=texture2D(t,b+vec2(dx.x,0.0)).r;float e=texture2D(t,b+vec2(0.0,dx.y)).r;float g=texture2D(t,b+dx).r;return mix(mix(a,c,f.x),mix(e,g,f.x),f.y);}'
        : 'float H(vec2 uv){return texture2D(t,uv).r;}') +
      'void main(){if(live<0.5){vec2 q=(v-0.5)*cover/zoom+0.5+pan;q.y=1.0-q.y;gl_FragColor=vec4(texture2D(img,clamp(q,0.001,0.999)).rgb*dim,1.0);return;}float h=H(v);float hx=H(v+vec2(dx.x,0.0));float hy=H(v+vec2(0.0,dx.y));' +
      // 傾きはマス目あたりで縦横同じに扱い、ずらす量は画面のピクセルで縦横同じにする（波紋が楕円にならない）
      'vec3 ddx=vec3(1.0,(hx-h)*res.x,0.0);vec3 ddy=vec3(0.0,(hy-h)*res.x,1.0);vec2 off=-normalize(cross(ddy,ddx)).xz;' +
      'off*=smoothstep(thr,thr*4.0,length(off));' +
      // 型（1=青いレジン、0=木・皿）。写真と同じ位置合わせで読み、型の外では写真をずらさず、光も出さない
      'vec2 muv=(v-0.5)*cover/zoom+0.5+pan;muv.y=1.0-muv.y;float mk=um>0.5?texture2D(msk,clamp(muv,0.001,0.999)).r:1.0;off*=mk;' +
      // ずらした先が木や皿なら、ずらさない（木や皿の色をレジンの側へ引き込まない）
      'vec2 o2=off*pert*vec2(1.0,asp)*cover;float mk2=um>0.5?texture2D(msk,clamp(muv+vec2(o2.x,-o2.y),0.001,0.999)).r:1.0;off*=mk2*mk2;' +
      'float sp=pow(max(0.0,dot(off,normalize(vec2(-0.6,1.0)))),4.0);' +
      'vec2 iuv=(v-0.5)*cover/zoom+0.5+pan;iuv+=off*pert*vec2(1.0,asp)*cover;iuv.y=1.0-iuv.y;' +
      'vec3 col=texture2D(img,clamp(iuv,0.001,0.999)).rgb*dim;' +
      'gl_FragColor=vec4(col+sp*vec3(0.95,0.82,0.55)*glint,1.0);}';
  }
  var STEP_MS = 1000 / 120; // 1秒に120回シミュレーションを進める（画面の更新頻度によらず波の速さをそろえる）

  function Ripple(canvas, src, opt) {
    opt = opt || {};
    this.c = canvas; this.src = src; this.opt = opt;
    this.zoomFrom = opt.zoomFrom == null ? 1.0 : opt.zoomFrom; this.zoomTo = opt.zoomTo || 1.12; this.period = opt.period || 26;
    this.dim = opt.dim == null ? 1.0 : opt.dim;
    this.maxDpr = opt.dpr || 1.5;
    this.vid = opt.video ? src : null; // 動画を水面にする（src が video 要素）
    this.panAmp = opt.pan == null ? 1 : opt.pan;
    this.panY = opt.panY == null ? -0.008 : opt.panY; // 寄るときの縦のずれ（正＝写真の上の方へ寄る）
    this.raf = 0; this.running = false; this.inView = true; this.tabOn = !document.hidden;
    this.ok = this.init();
    if (this.ok && opt.mask) { this.maskImg(opt.mask.landscape); this.maskImg(opt.mask.portrait); }
  }
  Ripple.prototype.init = function () {
    // 深さ・ステンシルのバッファは使わない（GPUのメモリを減らし、文脈を失いにくくする）
    var gl = this.c.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return false;
    this.gl = gl;
    var self = this;
    // GPUの文脈が失われたら、いったん静止画に戻し（opt.onLost）、戻ってきたら作り直して再開する（opt.onBack）
    this.c.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); // これが無いと文脈は二度と戻らない
      self.running = false; self.ok = false; self.maskOn = false;
      if (self.raf) { cancelAnimationFrame(self.raf); self.raf = 0; }
      if (self.opt.onLost) self.opt.onLost();
    }, false);
    this.c.addEventListener('webglcontextrestored', function () { self.restore(); }, false);
    return this.setup();
  };
  Ripple.prototype.setup = function () {
    var gl = this.gl;
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
    this.resize();
    return true;
  };
  /* 文脈が戻ったら、プログラム・波の格子・写真・型を作り直して再開する（写真と型の画像は読み直さない） */
  Ripple.prototype.restore = function () {
    if (this.dead || this.gl.isContextLost()) return;
    this.a = this.b = null; this.sw = this.sh = 0; this.msk = null; this.maskUrl = null; this.maskOn = false; this.img = null;
    if (!this.setup()) return;
    this.ok = true;
    if (!this.imEl) return; // 写真がまだ届いていなかった：start の onload が続きをする
    if (this.t0 == null) { this.t0 = performance.now(); this.lastAmb = 0; }
    this.upImg(this.imEl); this.loadMask();
    if (this.pend && this.pend !== this.imEl.src) { var p = this.pend; this.pend = null; this.src = null; this.running = true; this.setSrc(p); }
    this.lastDrop = 0; this.running = true; this.onFirst = this.opt.onBack || null; this.kick();
  };
  Ripple.prototype.upImg = function (im) {
    var gl = this.gl;
    this.iw = im.naturalWidth || im.videoWidth; this.ih = im.naturalHeight || im.videoHeight; this.imEl = im;
    if (!this.img) {
      this.img = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else gl.bindTexture(gl.TEXTURE_2D, this.img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
    this.dirty = true;
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
    this.c.width = this.W; this.c.height = this.H; this.dirty = true;
    this.cw = r.width; this.ch = r.height;
    var sw = r.width > 900 ? 384 : 256, sh = Math.max(64, Math.round(sw * r.height / Math.max(1, r.width)));
    if (sh > 640) { sh = 640; sw = Math.round(sh * r.width / r.height); }
    if (!(sw === this.sw && Math.abs(sh - this.sh) < 24 && this.a)) {
      this.sw = sw; this.sh = sh;
      this.free(this.a); this.free(this.b);
      this.a = this.makeTarget(sw, sh); this.b = this.makeTarget(sw, sh);
    }
    // 大きさを変えると描画面は黒に戻る。次のコマを待たずにこの場で描き直す（スマホでアドレスバーが出入りするたびに、写真が一瞬黒くなっていた）
    if (this.running && this.ok && this.a && this.iw) { try { this.render((performance.now() - this.t0) / 1000); this.dirty = false; } catch (e) {} }
  };
  /* 型（マスク）。写真の向き（縦長か横長か）に合う型を読み、GPU用のテクスチャと、点の判定用の小さな配列を作る */
  Ripple.prototype.loadMask = function () {
    var m = this.opt.mask; if (!m || !this.ok) return;
    var url = this.ih > this.iw ? m.portrait : m.landscape; if (!url) return;
    if (url === this.maskUrl) { if (this.msk && this.mcpu) this.maskOn = true; return; } // 同じ型なら、そのまま使う
    var self = this, gl = this.gl; this.maskUrl = url; this.maskOn = false; // 新しい型が届くまでは波紋を立てない
    var im = this.maskImg(url);
    var use = function () {
      if (!self.ok || self.maskUrl !== url) return;
      if (!self.msk) self.msk = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, self.msk);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, im);
      try {
        var cw = 192, ch = Math.max(1, Math.round(cw * im.naturalHeight / im.naturalWidth)), c2 = document.createElement('canvas');
        c2.width = cw; c2.height = ch; var x2 = c2.getContext('2d'); x2.drawImage(im, 0, 0, cw, ch);
        var d = x2.getImageData(0, 0, cw, ch).data, a = new Uint8Array(cw * ch);
        for (var i = 0; i < a.length; i++) a[i] = d[i * 4];
        self.mcpu = { w: cw, h: ch, a: a };
      } catch (e) { self.mcpu = null; }
      self.maskOn = true;
      var q = self.qTap; self.qTap = null;
      if (q && self.tapAt && performance.now() - q.t < 1500) self.tapAt(q.x, q.y);
    };
    if (im.__ok) use(); else if (!im.__bad) { im.addEventListener('load', use); }
    // 読めなかったときは maskOn が false のまま＝波紋を立てない（木や皿まで揺らさない）
  };
  /* 型の画像は、写真と同時に読み始める（写真が届いてから読むと、その間のタップで皿まで揺れる） */
  Ripple.prototype.maskImg = function (url) {
    this.mimgs = this.mimgs || {};
    if (this.mimgs[url]) return this.mimgs[url];
    var im = new Image(), tries = 0;
    im.onload = function () { im.__ok = true; };
    im.onerror = function () { if (++tries > 2) { im.__bad = true; return; } setTimeout(function () { im.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'r=' + tries; }, 1500 * tries); };
    im.src = url; this.mimgs[url] = im; return im;
  };
  /* 描画面の点（CSSピクセル）が型のどこに当たるか（0〜1）。型が無ければ 1 */
  Ripple.prototype.maskAt = function (x, y) {
    var M = this.mcpu, V = this.view; if (!M || !V) return 1;
    var vx = x / this.cw, vy = 1 - y / this.ch;
    var u = (vx - 0.5) * V.cover[0] / V.zoom + 0.5 + V.pan[0], t = 1 - ((vy - 0.5) * V.cover[1] / V.zoom + 0.5 + V.pan[1]);
    if (!(u >= 0 && u <= 1 && t >= 0 && t <= 1)) return 0; // 範囲外と NaN は 0
    return M.a[Math.min(M.h - 1, Math.floor(t * M.h)) * M.w + Math.min(M.w - 1, Math.floor(u * M.w))] / 255;
  };
  Ripple.prototype.snap = function (x, y) {
    if (!this.opt.mask) return [x, y]; // 型の無い水面（動画の背景）は、触れた点そのまま
    if (!this.maskOn) return null;
    var best = this.maskAt(x, y), bx = x, by = y;
    if (best >= 0.6) return [x, y];
    // 指の腹は直径1cm（約40px）ほど。中心が型の縁の外なら、半径14pxと28pxの円の上で、いちばん青いレジンらしい点を探す
    for (var ring = 14; ring <= 28; ring += 14) {
      for (var k = 0; k < 8; k++) {
        var a = (k + ring / 28) * Math.PI / 4, px = x + Math.cos(a) * ring, py = y + Math.sin(a) * ring, m = this.maskAt(px, py);
        if (m > best + 0.05) { best = m; bx = px; by = py; }
      }
      if (best >= 0.6) break;
    }
    return best >= 0.35 ? [bx, by] : null;
  };
  Ripple.prototype.quad = function () { var gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  Ripple.prototype.swap = function () { var t = this.a; this.a = this.b; this.b = t; };
  Ripple.prototype.drop = function (x, y, radiusPx, strength) {
    if (!this.ok || !this.running) return;
    if (this.opt.mask && (!this.maskOn || this.maskAt(x, y) < 0.35)) return; // 型が届くまでと、木や皿の上では波紋を立てない
    if (this.opt.skip) { var sb = this.c.getBoundingClientRect(); if (this.opt.skip(sb.left + x, sb.top + y)) return; } // 別の水面が重なっている所では立てない
    this.lastDrop = performance.now();
    if (this.sleeping) { this.sleeping = false; this.vNew = true; this.onFirst = this.opt.onWake || null; this.prev = performance.now(); this.kick(); } // 眠っていたら起きる（最初の1枚を描いてから見せる）
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
    var gl = this.gl, P = this.pRen, v = this.vid;
    if (v && this.vNew && v.readyState >= 2 && v.videoWidth) {
      this.vNew = false;
      if (v.videoWidth !== this.iw || v.videoHeight !== this.ih) { this.iw = v.videoWidth; this.ih = v.videoHeight; }
      gl.bindTexture(gl.TEXTURE_2D, this.img); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v); } catch (e) {}
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.W, this.H); gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.a.t); gl.uniform1i(P.u.t, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.img); gl.uniform1i(P.u.img, 1);
    gl.uniform2f(P.u.dx, 1 / this.sw, 1 / this.sh); gl.uniform2f(P.u.res, this.sw, this.sh); gl.uniform1f(P.u.asp, this.cw / this.ch);
    var ca = this.cw / this.ch, ia = this.iw / this.ih;
    var cover = ca > ia ? [1, ia / ca] : [ca / ia, 1];
    var k = 0.5 - 0.5 * Math.cos((time / this.period) * Math.PI * 2 / 2); // 0→1→0 のゆっくりした往復
    var z = this.zoomFrom + (this.zoomTo - this.zoomFrom) * k;
    gl.uniform2f(P.u.cover, cover[0], cover[1]); gl.uniform1f(P.u.zoom, z);
    var pan = [0.01 * k * Math.sin(time / this.period * 1.3) * this.panAmp, this.panY * k * this.panAmp];
    gl.uniform2f(P.u.pan, pan[0], pan[1]);
    this.view = { cover: cover, zoom: z, pan: pan };
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.maskOn ? this.msk : this.img); gl.uniform1i(P.u.msk, 2); gl.uniform1f(P.u.um, this.maskOn ? 1 : 0);
    gl.uniform1f(P.u.pert, this.opt.pert || 0.03); gl.uniform1f(P.u.dim, this.dim);
    if (P.u.live) gl.uniform1f(P.u.live, (this.opt.lite && this.idle) ? 0 : 1);
    if (P.u.thr) gl.uniform1f(P.u.thr, this.opt.thr || 0.03);
    if (P.u.glint) gl.uniform1f(P.u.glint, this.opt.glint == null ? 0.32 : this.opt.glint);
    this.quad();
  };
  Ripple.prototype.frame = function (now) {
    this.raf = 0;
    if (!this.running || !this.inView || !this.tabOn) return; // 止めるときは次のフレームを頼まない（kick で再開）
    if (this.opt.sleep && !this.onFirst && now - (this.lastDrop || 0) > this.opt.sleep) { // 波が消えたら眠る（描かない）
      if (!this.sleeping) { this.sleeping = true; if (this.opt.onSleep) this.opt.onSleep(); }
      return;
    }
    var dt = Math.min(100, now - this.prev); this.prev = now;
    if (this.opt.ambient && now - this.lastAmb > this.opt.ambient) {
      this.lastAmb = now;
      for (var tries = 0; tries < 8; tries++) { var ax = this.cw * (0.1 + 0.8 * Math.random()), ay = this.ch * (0.1 + 0.8 * Math.random()); if (!this.opt.mask || (this.maskOn && this.maskAt(ax, ay) >= 0.6)) { this.drop(ax, ay, 26, 0.05); break; } }
    }
    var idle = now - (this.lastDrop || 0) > 8000; this.idle = idle;
    this.acc += dt; var n = 0;
    if (idle) { this.acc = 0; this.odd = !this.odd; } // 波が消えた後は計算を止め、描画も1フレームおき（ズームだけ動かす）
    else { while (this.acc >= STEP_MS && n < 8) { this.step(); this.acc -= STEP_MS; n++; } if (n === 8) this.acc = 0; }
    if (this.vid && !this.vfc && !this.vid.paused) this.vNew = true; // 動画のコマの知らせが無いブラウザは、毎フレーム写す
    if (!idle || this.odd || this.onFirst || this.dirty || (this.vid && this.vNew)) { this.render((now - this.t0) / 1000); this.dirty = false; }
    if (this.onFirst) { var f = this.onFirst; this.onFirst = null; f(); }
    var self = this; this.raf = requestAnimationFrame(function (t) { self.frame(t); });
  };
  Ripple.prototype.kick = function () {
    if (this.dead || this.raf || !this.running || !this.inView || !this.tabOn) return;
    var self = this; this.prev = performance.now(); this.acc = 0;
    this.raf = requestAnimationFrame(function (t) { self.frame(t); });
  };
  Ripple.prototype.start = function (onReady) {
    var self = this;
    if (this.vid) { // 動画：最初のコマが来てから始める。新しいコマが来るたびに写す（requestVideoFrameCallback があれば使う）
      var v = this.vid, go = function () {
        if (self.running || self.dead || !v.videoWidth) return;
        self.imEl = v; if (!self.ok) return;
        self.upImg(v); self.t0 = performance.now(); self.lastAmb = 0; self.running = true; self.onFirst = onReady || null;
        if (v.requestVideoFrameCallback) { self.vfc = true; var cb = function () { self.vNew = true; if (!self.dead) v.requestVideoFrameCallback(cb); }; v.requestVideoFrameCallback(cb); }
        self.kick();
      };
      if (v.readyState >= 2 && v.videoWidth) go(); else { v.addEventListener('loadeddata', go); v.addEventListener('playing', go); }
      return;
    }
    var gl = this.gl, im = new Image();
    im.decoding = 'async';
    im.onload = function () {
      self.imEl = im;
      if (!self.ok) return; // 文脈が失われている間に届いた：restore が続きをする
      self.upImg(im);
      self.loadMask();
      self.t0 = performance.now(); self.lastAmb = 0; self.running = true;
      self.onFirst = onReady || null; // 最初の1枚を描いてから知らせる（写真が一瞬暗くならないように）
      self.kick();
    };
    im.src = this.src;
  };
  Ripple.prototype.setSrc = function (src) {
    if (!this.ok) { this.pend = src; return; } // 文脈が戻ったら読む
    if (!this.running || src === this.src) return;
    var self = this, im = new Image(); this.src = src;
    // 解像度だけが替わる（スマホのツールバーの伸縮で srcset が選び直す）ことが多い。型は向きが変わるときだけ読み替える（loadMask）
    im.onload = function () { if (self.src !== src) return; if (!self.ok) { self.imEl = im; return; } self.upImg(im); self.loadMask(); };
    im.src = src;
  };
  /* 指とマウスの受け取り。window で受け、描画面の矩形の中かどうかを座標で決める（透明なヘッダーの帯の下でも揺れる）。
     accept(要素) が false を返す所（開いたメニューなど）では立てない */
  Ripple.prototype.bind = function (target, accept) {
    var self = this, lastMove = 0, last = {}, T = this.opt.touch || {}, ls = this._ls = [];
    function on(t, type, fn, o) { t.addEventListener(type, fn, o); ls.push([t, type, fn, o]); }
    var TR = T.r || 32, TS = T.s || 0.12, MS = T.move || 0.045;
    function rel(x, y) { var r = self.c.getBoundingClientRect(); return [x - r.left, y - r.top, r]; }
    function inside(p) { return p[0] >= 0 && p[1] >= 0 && p[0] <= p[2].width && p[1] <= p[2].height; }
    function ok(e, touch) { return !self.dead && self.inView && (target.contains(e.target) || (touch && accept && accept(e.target))); } // ヘッダーの帯の下は指だけ（マウスは今までどおり）
    // マウス：動かすと連続して、クリックで大きく
    on(window, 'pointermove', function (e) {
      if (e.pointerType === 'touch' || !ok(e)) return;
      var now = performance.now(); if (now - lastMove < 16) return; lastMove = now;
      var p = rel(e.clientX, e.clientY); if (inside(p)) self.drop(p[0], p[1], 16, 0.022);
    }, { passive: true });
    on(window, 'pointerdown', function (e) { if (e.pointerType === 'touch' || !ok(e)) return; var p = rel(e.clientX, e.clientY); if (inside(p)) self.drop(p[0], p[1], 34, 0.16); }, { passive: true });
    // 指：触れた所に、はっきり見える波紋（少し遅れて2つの余韻）。型の縁なら近くの青いレジンへ寄せる。型が届く前のタップは覚えておく
    function tapAt(x, y) {
      var q = self.snap(x, y);
      if (!q) { if (self.opt.mask && !self.maskOn) self.qTap = { x: x, y: y, t: performance.now() }; return; }
      self.drop(q[0], q[1], TR, TS);
      if (self.opt.onTap) { var rr = self.c.getBoundingClientRect(); self.opt.onTap(rr.left + q[0], rr.top + q[1]); }
      if (T.echo) { setTimeout(function () { self.drop(q[0], q[1], TR * 0.75, TS * 0.45); }, 110); setTimeout(function () { self.drop(q[0], q[1], TR * 0.6, TS * 0.3); }, 240); }
    }
    this.tapAt = tapAt;
    on(window, 'touchstart', function (e) {
      if (!ok(e, true)) return;
      var now = performance.now();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i], p = rel(t.clientX, t.clientY);
        if (!inside(p)) continue;
        last[t.identifier] = { x: p[0], y: p[1], t: now, sx: p[0], sy: p[1], moved: 0 }; lastTouch = { x: t.clientX, y: t.clientY, t: now };
        if (!T.onEnd) tapAt(p[0], p[1]);
      }
    }, { passive: true });
    on(window, 'touchmove', function (e) {
      // 縦にスクロールしている間は、写真が指と一緒に動くので、写真の上では指はほぼ同じ点にある。
      // その間も波紋が途切れないよう、指の下に一定の間隔で波紋を立てる（横に滑らせたときは通り道に並べる）
      if (self.dead || !self.inView) return;
      var now = performance.now(), r = self.c.getBoundingClientRect();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i], q = last[t.identifier], bx = t.clientX - r.left, by = t.clientY - r.top;
        if (!q) continue; // 描画面の外で始まった指は追わない
        var dx = bx - q.x, dy = by - q.y, dist = Math.sqrt(dx * dx + dy * dy);
        q.moved = Math.max(q.moved || 0, Math.abs(bx - q.sx) + Math.abs(by - q.sy));
        if (dist < 10) {
          if (now - q.t < 50) continue;
          self.drop(bx, by, 30, MS * 1.1);
        } else {
          var n = Math.min(8, Math.ceil(dist / 16));
          for (var k = 1; k <= n; k++) self.drop(q.x + dx * k / n, q.y + dy * k / n, 28, MS);
        }
        last[t.identifier] = { x: bx, y: by, t: now, sx: q.sx, sy: q.sy, moved: q.moved, t0: q.t0 || q.t };
        lastTouch = { x: t.clientX, y: t.clientY, t: now };
      }
    }, { passive: true });
    // 指を離したあとの慣性スクロールの間も、最後に指があった画面の位置に波紋を立て続ける（写真が流れるので、航跡のように残る）
    var lastTouch = null, lastScrollY = window.scrollY, lastScrollT = 0;
    on(window, 'scroll', function () {
      var now = performance.now(), y = window.scrollY, v = Math.abs(y - lastScrollY); lastScrollY = y;
      if (self.dead || !lastTouch || now - lastTouch.t > 1600 || now - lastScrollT < 50 || !self.inView) return;
      lastScrollT = now;
      var r = self.c.getBoundingClientRect(), x = lastTouch.x - r.left, yy = lastTouch.y - r.top;
      if (yy < 0 || yy > r.height) return;
      self.drop(x, yy, 28, Math.min(MS * 1.1, 0.03 + v * 0.0008));
    }, { passive: true });
    var end = function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i], q = last[t.identifier];
        if (q) {
          lastTouch = { x: t.clientX, y: t.clientY, t: performance.now() };
          if (T.onEnd && e.type === 'touchend' && (q.moved || 0) < 12 && performance.now() - (q.t0 || q.t) < 600) { var p = rel(t.clientX, t.clientY); if (inside(p)) tapAt(p[0], p[1]); }
        }
        delete last[t.identifier];
      }
    };
    on(window, 'touchend', end, { passive: true }); on(window, 'touchcancel', end, { passive: true });
    var pend = 0, onSize = function () { if (pend) return; pend = requestAnimationFrame(function () { pend = 0; var r = self.c.getBoundingClientRect(); if (self.ok && (Math.abs(r.width - self.cw) >= 1 || Math.abs(r.height - self.ch) >= 1)) self.resize(); }); };
    var ro = this._ro = window.ResizeObserver ? new ResizeObserver(onSize) : null;
    if (ro) ro.observe(this.c); else on(window, 'resize', onSize);
    if (window.matchMedia) { try { window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)').addEventListener('change', function () { if (!self.dead && self.ok) self.resize(); }); } catch (e) {} }
    if ('IntersectionObserver' in window) { this._io = new IntersectionObserver(function (es) { self.inView = es[es.length - 1].isIntersecting; self.kick(); }, { threshold: 0 }); this._io.observe(this.c); }
    on(document, 'visibilitychange', function () { self.tabOn = !document.hidden; self.kick(); });
  };
  /* 作り直す前に、古い個体を止めて手放す */
  Ripple.prototype.destroy = function () {
    this.dead = true; this.running = false; this.ok = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    (this._ls || []).forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); this._ls = [];
    if (this._ro) this._ro.disconnect(); if (this._io) this._io.disconnect();
    this.imEl = null; this.mimgs = {}; this.mcpu = null; this.qTap = null;
  };
  window.EthicaRipple = Ripple;
})();
