// Postmark Archive: deep zoom in the full-size photo view, with OpenSeadragon (BSD-3, the same viewer Grade A Vinyl uses).
// Desktop: click to zoom in, scroll to zoom, drag to look around. Phone: pinch or double-tap to zoom, drag to look
// around, swipe sideways (when not zoomed in) or tap a dot for the next photo.
// It takes over only inside the open full view; nothing else on the page changes. OpenSeadragon is downloaded the
// first time a full view opens, so ordinary page loads stay as light as before.
// Each photo zooms its biggest version: views[].zoom when the piece has one (up to ~5000px), otherwise views[].full.
(function () {
  var OSD_URL = 'assets/vendor/openseadragon-4.1.0.min.js';   // kept in the site, so no outside server is involved
  var BASE = {
    showNavigationControl: false, showZoomControl: false, showHomeControl: false, showFullPageControl: false,
    visibilityRatio: 1, constrainDuringPan: true, minZoomLevel: 1, defaultZoomLevel: 1, homeFillsViewer: false,
    maxZoomPixelRatio: 1.5,        // stop where the photo's own pixels run out (1 photo pixel = 1.5 screen pixels)
    zoomPerClick: 2.2, zoomPerScroll: 1.25, animationTime: 0.45, immediateRender: true,
    gestureSettingsMouse: { clickToZoom: true, dblClickToZoom: false, pinchToZoom: false, flickEnabled: false, pinchRotate: false },
    gestureSettingsTouch: { clickToZoom: false, dblClickToZoom: true, pinchToZoom: true, flickEnabled: false, pinchRotate: false },
  };
  var loading = null;

  function loadOSD() {
    if (window.OpenSeadragon) return Promise.resolve();
    if (!loading) loading = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = OSD_URL; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
    return loading;
  }
  // the biggest version of a photo, found by its full-size address
  function zoomUrl(fullUrl) {
    var items = window.ITEMS || [];
    for (var i = 0; i < items.length; i++) {
      var views = items[i].views || [];
      for (var j = 0; j < views.length; j++) {
        var v = views[j];
        if (v.full && fullUrl && (fullUrl === v.full || fullUrl.slice(-v.full.length) === v.full)) return v.zoom || v.full;
      }
    }
    return fullUrl;
  }

  // ---------------- desktop ----------------
  var desk = null;                                   // { el, viewer, raf, last }
  // keep the viewer exactly over the photo frame, every frame while open (the page may scroll, scale or resize)
  function placeDesk() {
    var frame = document.querySelector('#full .full-frame');
    if (!desk || !frame) return;
    var r = frame.getBoundingClientRect(), key = [r.left, r.top, r.width, r.height].join(',');
    if (key !== desk.last) {
      desk.last = key;
      desk.el.style.left = r.left + 'px'; desk.el.style.top = r.top + 'px';
      desk.el.style.width = r.width + 'px'; desk.el.style.height = r.height + 'px';
    }
    desk.raf = requestAnimationFrame(placeDesk);
  }
  function openDesk() {
    var img = document.getElementById('fullImg');
    if (!img || !img.src) return;
    var url = zoomUrl(img.getAttribute('src'));
    loadOSD().then(function () {
      if (!document.getElementById('full').classList.contains('open')) return;
      closeDesk();
      // outside the scaled page, so the viewer's own pointer math is exact; it sits exactly over the photo frame
      var el = document.createElement('div');
      el.id = 'sg-zoom';
      el.style.cssText = 'position:fixed;z-index:2147483000;background:#fff;cursor:zoom-in';
      var inner = document.createElement('div');            // the viewer sets its own element to position:relative,
      inner.style.cssText = 'width:100%;height:100%';       // so it gets an inner box and the outer one stays fixed
      el.appendChild(inner);
      document.body.appendChild(el);
      desk = { el: el };
      placeDesk();
      desk.viewer = OpenSeadragon(Object.assign({ element: inner, tileSources: { type: 'image', url: url } }, BASE));
      desk.viewer.addHandler('zoom', function (e) { el.style.cursor = e.zoom > desk.viewer.viewport.getHomeZoom() * 1.01 ? 'grab' : 'zoom-in'; });
      img.style.visibility = 'hidden';
    }).catch(function () { /* no network for the viewer: the plain photo stays */ });
  }
  function closeDesk() {
    if (!desk) return;
    cancelAnimationFrame(desk.raf);
    if (desk.viewer) desk.viewer.destroy();
    desk.el.remove(); desk = null;
    var img = document.getElementById('fullImg');
    if (img) img.style.visibility = '';
  }

  // ---------------- phone ----------------
  var phone = null;                                  // { el, viewer, photo, urls, index }
  function phoneShow(i) {
    if (!phone) return;
    phone.index = (i + phone.urls.length) % phone.urls.length;
    phone.viewer.open({ type: 'image', url: phone.urls[phone.index] });
    phone.photo.querySelectorAll('.m-dots i').forEach(function (d, k) { d.className = k === phone.index ? 'on' : ''; });
  }
  function openPhone(photo) {
    var strip = photo.querySelector('.m-strip');
    var urls = Array.prototype.map.call(photo.querySelectorAll('.m-strip img'), function (im) { return zoomUrl(im.getAttribute('src')); });
    if (!strip || !urls.length) return;
    var start = Math.round(strip.scrollLeft / (strip.clientWidth || 1));
    loadOSD().then(function () {
      if (!photo.classList.contains('open')) return;
      closePhone();
      var el = document.createElement('div');
      el.className = 'sg-zoom-phone';
      el.style.cssText = 'position:absolute;left:0;right:0;top:' + strip.offsetTop + 'px;height:' + strip.offsetHeight + 'px;background:#fffdf6';
      var inner = document.createElement('div');            // same as desktop: the viewer gets an inner box
      inner.style.cssText = 'width:100%;height:100%';
      el.appendChild(inner);
      photo.appendChild(el);
      strip.style.visibility = 'hidden';
      phone = { el: el, photo: photo, urls: urls, index: start, dx: 0 };
      phone.viewer = OpenSeadragon(Object.assign({ element: inner, tileSources: { type: 'image', url: urls[start] } }, BASE));
      // swipe sideways for the next photo, only when not zoomed in (zoomed in, a drag looks around the photo)
      phone.viewer.addHandler('canvas-press', function () { phone.dx = 0; });
      phone.viewer.addHandler('canvas-drag', function (e) { phone.dx += e.delta.x; });
      phone.viewer.addHandler('canvas-release', function () {
        if (!phone || phone.urls.length < 2) return;
        var vp = phone.viewer.viewport;
        if (vp.getZoom() > vp.getHomeZoom() * 1.05) return;
        if (phone.dx < -50) phoneShow(phone.index + 1);
        else if (phone.dx > 50) phoneShow(phone.index - 1);
      });
      // the dots become buttons
      photo.querySelectorAll('.m-dots i').forEach(function (d, k) {
        d.onclick = function () { phoneShow(k); };
      });
      phoneShow(start);
    }).catch(function () { /* no network for the viewer: the plain photos stay */ });
  }
  function closePhone() {
    if (!phone) return;
    phone.viewer.destroy(); phone.el.remove();
    var strip = phone.photo.querySelector('.m-strip');
    if (strip) strip.style.visibility = '';
    phone = null;
  }

  // ---------------- start loading early ----------------
  // as soon as a piece's page opens, the viewer and the shown photo's biggest version download in the background,
  // so the full view opens straight onto a photo that is already here (the viewer reuses the downloaded image)
  var warm = {};
  function preload(url) {
    if (!url || warm[url]) return;
    if (document.readyState !== 'complete') {         // after the page's own photos, so it never slows the page itself
      warm[url] = 'queued';
      window.addEventListener('load', function () { delete warm[url]; preload(url); });
      return;
    }
    var im = new Image();
    im.decoding = 'async';
    im.src = url;
    warm[url] = im;                                   // kept, so the browser keeps it ready
    loadOSD().catch(function () {});
  }
  function preloadDesk() {                            // the listing's shown photo (desktop)
    var s = window.state, items = window.ITEMS;
    if (!s || !items || s.open < 0 || !items[s.open]) return;
    var v = items[s.open].views[s.view] || items[s.open].views[0];
    if (v) preload(v.zoom || v.full);
  }
  function preloadPhone() {                           // the piece page's shown photo (phone)
    var views = document.querySelector('#m-root .m-views');
    if (!views) return;
    var k = Math.round(views.scrollLeft / (views.clientWidth || 1));
    var im = document.querySelectorAll('#m-root .m-photo .m-strip img')[k];
    if (im) preload(zoomUrl(im.getAttribute('src')));
    if (!views.sgWarm) {                              // swiping to another photo loads that one too
      views.sgWarm = true;
      var t = 0;
      views.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(preloadPhone, 150); });
    }
  }
  // desktop: switching thumbnails
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#thumbs')) setTimeout(preloadDesk, 0);
  }, true);
  // phone: the piece page is drawn by mobile.js on load and on each address change (after this script's listeners)
  function phoneRoute() { setTimeout(preloadPhone, 0); }
  window.addEventListener('hashchange', phoneRoute);
  // a shared link may have opened a piece before this script loaded
  function warmNow() { preloadDesk(); preloadPhone(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', warmNow); else setTimeout(warmNow, 0);

  // ---------------- watch the full views open and close ----------------
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      var t = m.target;
      if (t.id === 'overlay' && t.classList.contains('open')) preloadDesk();
      if (t.id === 'full') { if (t.classList.contains('open')) openDesk(); else closeDesk(); }
      else if (t.classList && t.classList.contains('m-photo')) { if (t.classList.contains('open')) openPhone(t); else if (phone && phone.photo === t) closePhone(); }
    });
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  // the phone page is rebuilt on each route; drop a viewer whose page is gone
  window.addEventListener('hashchange', function () { if (phone && !document.body.contains(phone.photo)) { phone.viewer.destroy(); phone = null; } });
})();
