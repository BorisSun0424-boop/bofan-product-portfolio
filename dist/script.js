/* ============================================
   孙勃帆 · 产品作品集 — 交互脚本

   桌面端：连续滚动进度模型（参考 mclaneteitel.com）
     · 滚轮/触摸持续累加一个进度值（0 = 首屏，5 = 关于）
     · rAF 插值（lerp）让它平滑追随，形成带惯性的“翻页”手感
     · 每一屏的透明度 / 位移 / 过渡模糊都由进度实时派生
     · 停止输入后磁性吸附到最近整页
   移动端：原生 scroll-snap 分节 + 底部抽屉
   ============================================ */

(function () {
  'use strict';

  var TOTAL = 6;            /* 场景数（0 = Hero 首屏，1-5 = 作品与关于） */
  var EASE = 0.085;         /* 每帧插值系数：越小越顺滑、惯性越强 */
  var WHEEL_FACTOR = 3.4;   /* 滚轮位移 → 页面位移倍率 */
  var TOUCH_FACTOR = 1.5;   /* 触摸拖动倍率 */
  var SNAP_DELAY = 200;     /* 停止滚动多久后吸附到整页 */
  var FADE_IN = 0.28;       /* 完全可见区间半宽（页） */
  var FADE_OUT = 0.88;      /* 完全消失距离（页） */
  var BLUR_MAX = 10;        /* 过渡中的最大模糊（px），与参考站一致 */

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) EASE = 1;

  var layout = document.querySelector('.desktop-layout');
  var hero = document.querySelector('.hero');
  var leftTop = document.getElementById('leftTop');
  var dashes = document.querySelectorAll('.dash');
  var navBtns = document.querySelectorAll('[data-nav]');

  /* 按场景序号索引（场景 0 由 Hero 承担，中/左/右栏从 1 开始） */
  function indexBy(selector, key) {
    var map = {};
    var list = document.querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) map[Number(list[i].dataset[key])] = list[i];
    return map;
  }
  var titleMap = indexBy('[data-title]', 'title');
  var panelMap = indexBy('[data-panel]', 'panel');
  var layerMap = indexBy('[data-layer]', 'layer');

  var progress = 0;   /* 当前显示位置（连续） */
  var target = 0;     /* 目标位置（连续） */
  var rafId = null;
  var snapTimer = null;

  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
  function clamp01(v) { return clamp(v, 0, 1); }

  /* 距离某页 d 时的可见度：中心区间内 1，超过 FADE_OUT 为 0 */
  function fadeAt(d) {
    return clamp01((FADE_OUT - Math.abs(d)) / (FADE_OUT - FADE_IN));
  }

  function applyLayer(el, opacity, y, blur, centerOffset) {
    if (!el) return;
    if (opacity <= 0.002) {
      if (el.style.visibility !== 'hidden') {
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.filter = 'none';
      }
      return;
    }
    el.style.visibility = 'visible';
    el.style.opacity = opacity.toFixed(3);
    el.style.transform = 'translate3d(0,' +
      (centerOffset ? 'calc(-50% + ' + y.toFixed(2) + 'px)' : y.toFixed(2) + 'px') + ',0)';
    el.style.filter = blur > 0.05 ? 'blur(' + blur.toFixed(2) + 'px)' : 'none';
  }

  function render(p) {
    /* 首屏：淡出 + 轻微上移（视差） */
    if (hero) {
      var hop = fadeAt(p);
      hero.style.opacity = hop.toFixed(3);
      hero.style.transform = 'translate3d(0,' + (-p * 36).toFixed(2) + 'px,0)';
      hero.style.visibility = hop <= 0.002 ? 'hidden' : 'visible';
      hero.style.pointerEvents = hop > 0.85 ? 'auto' : 'none';
    }

    /* 各作品场景：透明度 / 位移 / 过渡模糊都由进度派生 */
    for (var i = 1; i < TOTAL; i++) {
      var d = p - i;
      var ad = Math.abs(d);
      var opacity = fadeAt(d);
      var y = d * 46;
      var blur = ad > 1.2 ? 0 : Math.min(BLUR_MAX, ad * 13);
      applyLayer(layerMap[i], opacity, y, blur, false);
      applyLayer(panelMap[i], opacity, y * 0.6, blur * 0.7, false);
      applyLayer(titleMap[i], opacity, y * 0.35, blur * 0.5, true);
    }

    /* 左栏静止信息（名字 / 刻度）随离开首屏淡入 */
    if (leftTop) leftTop.style.opacity = clamp01((p - 0.18) / 0.45).toFixed(3);

    /* 刻度激活项跟随最近的整页 */
    var near = Math.round(p);
    for (var k = 0; k < dashes.length; k++) dashes[k].classList.toggle('active', k === near);
  }

  function tick() {
    var diff = target - progress;
    if (Math.abs(diff) < 0.0008) {
      progress = target;
      render(progress);
      rafId = null;
      return;
    }
    progress += diff * EASE;
    render(progress);
    rafId = requestAnimationFrame(tick);
  }

  function kick() {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  function setTarget(v) {
    target = clamp(v, 0, TOTAL - 1);
    kick();
  }

  function jumpTo(index) {
    clearTimeout(snapTimer);
    setTarget(index);
  }

  /* 停止输入后吸附到最近的整页 */
  function scheduleSnap() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(function () {
      setTarget(Math.round(target));
    }, SNAP_DELAY);
  }

  /* ---- 滚轮：累加进度 ---- */
  if (layout) {
    layout.addEventListener('wheel', function (e) {
      e.preventDefault();
      setTarget(target + (e.deltaY / window.innerHeight) * WHEEL_FACTOR);
      scheduleSnap();
    }, { passive: false });
  }

  /* ---- 键盘 ---- */
  window.addEventListener('keydown', function (e) {
    if (window.matchMedia('(max-width:767px)').matches) return;
    var next = ['ArrowDown', 'ArrowRight', 'PageDown', ' '];
    var prev = ['ArrowUp', 'ArrowLeft', 'PageUp'];
    if (next.indexOf(e.key) >= 0) { e.preventDefault(); jumpTo(Math.round(target) + 1); }
    else if (prev.indexOf(e.key) >= 0) { e.preventDefault(); jumpTo(Math.round(target) - 1); }
    else if (e.key === 'Home') { e.preventDefault(); jumpTo(0); }
    else if (e.key === 'End') { e.preventDefault(); jumpTo(TOTAL - 1); }
  });

  /* ---- 触摸（桌面端触屏）：跟手拖动 + 松手吸附 ---- */
  if (layout) {
    var touchY = null;
    var touchBase = 0;
    layout.addEventListener('touchstart', function (e) {
      touchY = e.touches[0].clientY;
      touchBase = target;
      clearTimeout(snapTimer);
    }, { passive: true });
    layout.addEventListener('touchmove', function (e) {
      if (touchY === null) return;
      e.preventDefault();
      var dy = touchY - e.touches[0].clientY;
      setTarget(touchBase + (dy / window.innerHeight) * TOUCH_FACTOR);
    }, { passive: false });
    layout.addEventListener('touchend', function () {
      if (touchY === null) return;
      touchY = null;
      scheduleSnap();
    }, { passive: true });
  }

  /* ---- 导航点击（刻度 + Hero 顶栏 / 竖标签） ---- */
  for (var n = 0; n < navBtns.length; n++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        jumpTo(Number(btn.dataset.nav));
      });
    })(navBtns[n]);
  }

  /* ---- 移动端抽屉 ---- */
  var openers = document.querySelectorAll('[data-sheet-open]');
  for (var o = 0; o < openers.length; o++) {
    openers[o].addEventListener('click', function (e) {
      var section = e.currentTarget.closest('.mobile-section');
      if (section) section.classList.add('sheet-open');
    });
  }
  var closers = document.querySelectorAll('[data-sheet-close]');
  for (var c = 0; c < closers.length; c++) {
    closers[c].addEventListener('click', function (e) {
      var section = e.currentTarget.closest('.mobile-section');
      if (section) section.classList.remove('sheet-open');
    });
  }

  /* ---- 首屏大字：逐字母悬停放大（参考 mclaneteitel.com 的 HELLO 交互） ----
     鼠标靠近哪个字母，哪个字母就基于基线放大；邻近度按高斯衰减，
     每帧向目标弹性追随（lerp），鼠标离开后全部弹回 1 */
  (function () {
    var nameEl = document.querySelector('.hero-name');
    if (!nameEl || !window.matchMedia('(pointer: fine)').matches) return;
    var chs = nameEl.querySelectorAll('.hn-ch');
    var n = chs.length;
    if (!n) return;

    var cur = [], centers = [], stale = true;
    for (var i = 0; i < n; i++) { cur.push(1); centers.push(null); }

    var BOOST = 0.55;    /* 悬停峰值的额外放大倍数（1 + BOOST） */
    var RADIUS = 170;    /* 高斯衰减半径（px）：越大影响范围越宽 */
    var EASE_CH = 0.16;  /* 每帧追随系数：模拟弹簧的弹性手感 */
    var raf = null, mx = -1e4, my = -1e4, active = false;

    function measure() {
      var h = 0;
      for (var i = 0; i < n; i++) {
        var r = chs[i].getBoundingClientRect();
        centers[i] = { x: r.left + r.width / 2, y: r.top + r.height * 0.55 };
        h = Math.max(h, r.height);
      }
      /* 衰减半径跟随字母实际尺寸，避免不同窗口宽度下手感不一致 */
      if (h > 0) RADIUS = h * 0.58;
      stale = false;
    }

    function frame() {
      var settled = true;
      var heroVisible = progress < 0.35;
      for (var i = 0; i < n; i++) {
        var t = 1;
        if (heroVisible && active && centers[i]) {
          var dx = mx - centers[i].x;
          var dy = (my - centers[i].y) / 1.5;   /* 纵向影响范围收窄 */
          t = 1 + BOOST * Math.exp(-(dx * dx + dy * dy) / (2 * RADIUS * RADIUS));
        }
        cur[i] += (t - cur[i]) * EASE_CH;
        if (cur[i] < 0.999 || cur[i] > 1.001 || Math.abs(t - cur[i]) > 0.002) settled = false;
        chs[i].style.transform = 'scale(' + cur[i].toFixed(4) + ')';
      }
      raf = (settled && !(heroVisible && active)) ? null : requestAnimationFrame(frame);
    }
    function wake() { if (raf === null) raf = requestAnimationFrame(frame); }

    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (stale) measure();
      active = true;
      wake();
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () {
      mx = my = -1e4; active = false; wake();
    });
    window.addEventListener('resize', function () { stale = true; });
    /* 滚离首屏后字母矩形会随位移变化，回来时重新测量 */
    var staleCheck = setInterval(function () {
      if (progress > 0.5) stale = true;
    }, 400);
  })();

  render(progress);
})();
