/* ============================================
   孙勃帆 · 产品作品集 — 交互脚本
   桌面端：滚轮 / 键盘 / 触摸 / 导航刻度切换场景
   移动端：底部抽屉开关
   ============================================ */

(function () {
  'use strict';

  var TOTAL = 6;
  var current = 0;
  var locked = false;
  var accum = 0;
  var LOCK_MS = 900;
  var THRESHOLD = 60;

  var titles = document.querySelectorAll('[data-title]');
  var panels = document.querySelectorAll('[data-panel]');
  var layers = document.querySelectorAll('[data-layer]');
  var dashes = document.querySelectorAll('.dash');
  var navBtns = document.querySelectorAll('[data-nav]');
  var leftTop = document.getElementById('leftTop');
  var layout = document.querySelector('.desktop-layout');

  function isDesktop() {
    return window.matchMedia('(min-width:768px)').matches;
  }

  function setActive(list, index) {
    for (var i = 0; i < list.length; i++) {
      list[i].classList.toggle('active', Number(list[i].dataset.title || list[i].dataset.panel || list[i].dataset.layer) === index);
    }
  }

  function goTo(i) {
    if (i < 0) i = 0;
    if (i > TOTAL - 1) i = TOTAL - 1;
    if (i === current) return;
    current = i;
    setActive(titles, current);
    setActive(panels, current);
    setActive(layers, current);
    for (var d = 0; d < dashes.length; d++) {
      dashes[d].classList.toggle('active', d === current);
    }
    if (leftTop) leftTop.classList.toggle('visible', current > 0);
    if (layout) layout.classList.toggle('hero-on', current === 0);
  }

  function lock() {
    locked = true;
    setTimeout(function () { locked = false; }, LOCK_MS);
  }

  /* ---- 滚轮：累计位移 + 阈值 ---- */
  if (layout) {
    layout.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (locked) return;
      accum += e.deltaY;
      if (Math.abs(accum) >= THRESHOLD) {
        goTo(current + (accum > 0 ? 1 : -1));
        accum = 0;
        lock();
      }
    }, { passive: false });
  }

  /* ---- 键盘 ---- */
  window.addEventListener('keydown', function (e) {
    if (!isDesktop()) return;
    var next = ['ArrowDown', 'ArrowRight', 'PageDown', ' '];
    var prev = ['ArrowUp', 'ArrowLeft', 'PageUp'];
    if (next.indexOf(e.key) >= 0) { e.preventDefault(); goTo(current + 1); }
    else if (prev.indexOf(e.key) >= 0) { e.preventDefault(); goTo(current - 1); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(TOTAL - 1); }
  });

  /* ---- 触摸（桌面端触屏） ---- */
  if (layout) {
    var touchY = null;
    layout.addEventListener('touchstart', function (e) {
      touchY = e.touches[0].clientY;
    }, { passive: true });
    layout.addEventListener('touchend', function (e) {
      if (touchY === null) return;
      var dy = touchY - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 50) goTo(current + (dy > 0 ? 1 : -1));
      touchY = null;
    }, { passive: true });
  }

  /* ---- 导航点击（刻度 + Hero 顶栏 / 竖标签） ---- */
  for (var n = 0; n < navBtns.length; n++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        goTo(Number(btn.dataset.nav));
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
})();
