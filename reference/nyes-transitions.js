/* NYES page transitions: content slides, header stays, a lime line sweeps across both pages. */
(function () {
  var KEY = 'nyes-nav', root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'cubic-bezier(.16,1,.3,1)', EASE_IN = 'cubic-bezier(.4,0,1,1)', DX = 28;
  var dir = 0;
  try { dir = +sessionStorage.getItem(KEY) || 0; sessionStorage.removeItem(KEY); } catch (e) {}

  function parts() {
    var h = document.querySelector('header');
    if (!h || !h.parentElement) return [];
    return [].filter.call(h.parentElement.children, function (c) { return c !== h && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE'; });
  }
  function bar() {
    var b = document.getElementById('nyes-nav-bar');
    if (!b) {
      b = document.createElement('div');
      b.id = 'nyes-nav-bar';
      b.setAttribute('aria-hidden', 'true');
      b.style.cssText = 'position:fixed;left:0;right:0;top:63px;height:2px;background:#0b0c0e;z-index:300;pointer-events:none;transform:scaleX(0)';
      document.body.appendChild(b);
    }
    return b;
  }
  function isOther(a) {
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
    var u; try { u = new URL(a.href, location.href); } catch (e) { return null; }
    if (u.origin !== location.origin || u.pathname === location.pathname) return null;
    return /\.(?!html?$)[a-z0-9]{2,5}$/i.test(u.pathname) ? null : u;
  }
  function rank(p) { p = decodeURIComponent(p).toLowerCase(); var o = ['docs', 'api', 'security', 'status', 'legal', '404']; for (var i = 0; i < o.length; i++) if (p.indexOf(o[i]) >= 0) return i + 1; return 0; }
  function dirForX(u) { return rank(u.pathname) > rank(location.pathname) ? 1 : -1; }
  function dirFor(u) { return dirForX(u); }

  var revealed = false;
  function reveal() {
    if (revealed) return; revealed = true;
    var ps = parts();
    root.classList.remove('nyes-enter');
    if (reduce || !dir) return;
    root.classList.add('nyes-anim');
    ps.slice(0, 4).forEach(function (p, i) {
      p.animate([{ opacity: 0, transform: 'translateX(' + dir * DX + 'px)' }, { opacity: 1, transform: 'none' }],
        { duration: 680, delay: i * 60, easing: EASE, fill: 'backwards' });
    });
    var b = bar();
    b.style.transformOrigin = dir > 0 ? 'right center' : 'left center';
    var an = b.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: 760, easing: EASE, fill: 'forwards' });
    an.onfinish = function () { root.classList.remove('nyes-anim'); };
  }
  function waitForContent(n) {
    var ps = parts(), h = document.querySelector('header');
    if (h && h.offsetHeight && ps.length) {
      var go = function () { requestAnimationFrame(function () { requestAnimationFrame(reveal); }); };
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go, go);
    } else if (n < 240) requestAnimationFrame(function () { waitForContent(n + 1); });
    else reveal();
  }

  var seen = false; try { seen = sessionStorage.getItem('nyes-seen') === '1'; sessionStorage.setItem('nyes-seen', '1'); } catch (e) {}
  if (!dir && !seen && !reduce) {
    var mk = function () {
      if (document.getElementById('nyes-loader') || !document.body) return;
      var l = document.createElement('div'); l.id = 'nyes-loader'; l.setAttribute('aria-hidden', 'true');
      l.innerHTML = '<div class="wrap"><div class="ring"></div><div class="ring sweep"></div><img src="assets/nyes-avatar-128.png" alt=""></div>';
      document.body.appendChild(l);
      var sw = l.querySelector('.sweep'), t0 = performance.now();
      sw.animate([{ '--a': '0deg' }, { '--a': '360deg' }], { duration: 900, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
      var done = function () { var wait = Math.max(0, 900 - (performance.now() - t0)); setTimeout(function () { l.classList.add('out'); setTimeout(function () { l.remove(); }, 600); }, wait); };
      var ready = function () { (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(done, done); };
      if (document.readyState === 'complete') ready(); else window.addEventListener('load', ready);
      setTimeout(done, 3000);
    };
    if (document.body) mk(); else document.addEventListener('DOMContentLoaded', mk);
  }
  if (dir && !reduce) {
    root.classList.add('nyes-enter');
    setTimeout(reveal, 2200);
    waitForContent(0);
  }

  window.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    var u = isOther(a); if (!u) return;
    var d = dirFor(u);
    try { sessionStorage.setItem(KEY, String(d)); } catch (err) {}
    if (reduce) return;
    e.preventDefault();
    root.classList.add('nyes-anim');
    parts().forEach(function (p) {
      p.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-d * DX) + 'px)' }],
        { duration: 260, easing: EASE_IN, fill: 'forwards' });
    });
    var b = bar();
    b.style.transformOrigin = d > 0 ? 'left center' : 'right center';
    b.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 300, easing: EASE, fill: 'forwards' });
    setTimeout(function () { location.href = u.href; }, 290);
  });

  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    root.classList.remove('nyes-anim', 'nyes-enter');
    parts().forEach(function (p) { p.getAnimations().forEach(function (an) { an.cancel(); }); });
    var b = document.getElementById('nyes-nav-bar');
    if (b) b.getAnimations().forEach(function (an) { an.cancel(); });
    if (!reduce) parts().slice(0, 4).forEach(function (p, i) {
      p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: i * 40, easing: EASE, fill: 'backwards' });
    });
  });
})();
