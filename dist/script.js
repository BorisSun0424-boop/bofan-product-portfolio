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

  render(progress);
})();
