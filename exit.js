// Postmark Archive (desktop): the space around a card is the exit. No close buttons are shown on the item card or the
// large photo; outside the white card (or the white photo board), the pointer becomes a small tracked-out CLOSE, and a
// click anywhere there closes it: the large photo first, then the item. Esc does the same (the pages' own handler).
// The old close buttons stay in the page, invisible, for keyboard and screen-reader users. The phone layout has its own.
(function () {
  if (document.documentElement.classList.contains('m')) return;
  var css = document.createElement('style');
  css.textContent =
    '#closeBtn, #fullClose { width: 1px !important; height: 1px !important; padding: 0 !important; overflow: hidden; clip-path: inset(50%); opacity: 0; }\n' +
    'html.sg-exiting, html.sg-exiting * { cursor: none !important; }\n' +
    '#sg-exit { position: fixed; left: 0; top: 0; z-index: 2147483646; pointer-events: none; user-select: none; transform: translate(-50%, -50%);\n' +
    '  font: 400 11px "Old Standard TT", serif; letter-spacing: 0.34em; padding-left: 0.34em; white-space: nowrap; color: #1a2433;\n' +
    '  opacity: 0; transition: opacity 120ms ease; }\n' +
    '#sg-exit.on { opacity: 1; }\n' +
    '#sg-exit.dark { color: #f5f2eb; }';
  document.head.appendChild(css);
  var label = document.createElement('div');
  label.id = 'sg-exit'; label.setAttribute('aria-hidden', 'true'); label.textContent = 'CLOSE';
  document.body.appendChild(label);

  function isOpen(id) { var el = document.getElementById(id); return !!(el && el.classList.contains('open')); }
  function inside(t, sel) { return !!(t && t.closest && t.closest(sel)); }
  // which view a point outside its card would close: 'full' (the large photo), 'item', or '' (not an exit)
  function zoneOf(t) {
    if (isOpen('full')) return inside(t, '.full-box, #sg-zoom') ? '' : 'full';
    if (isOpen('overlay')) return inside(t, '#overlay .panel') ? '' : 'item';
    return '';
  }
  var zone = '';
  function show(z, x, y) {
    zone = z;
    document.documentElement.classList.toggle('sg-exiting', !!z);
    label.classList.toggle('on', !!z);
    label.classList.toggle('dark', z === 'full');
    if (z && x != null) { label.style.left = x + 'px'; label.style.top = y + 'px'; }
  }
  document.addEventListener('mousemove', function (e) { show(zoneOf(e.target), e.clientX, e.clientY); }, true);
  document.documentElement.addEventListener('mouseleave', function () { show(''); });

  // a click that starts and ends outside the card closes it (a drag that began on the photo never does)
  var downZone = '';
  window.addEventListener('mousedown', function (e) { downZone = e.button === 0 ? zoneOf(e.target) : ''; }, true);
  window.addEventListener('click', function (e) {
    var z = zoneOf(e.target), start = downZone;
    downZone = '';
    if (!z || z !== start) return;
    e.preventDefault(); e.stopPropagation();
    if (z === 'full') window.closeFull(); else window.closeItem();
    var now = document.elementFromPoint(e.clientX, e.clientY);
    show(zoneOf(now), e.clientX, e.clientY);
  }, true);
  // Esc (handled by the page) closes a view: look again at what is under the pointer now
  document.addEventListener('keyup', function () {
    if (!zone) return;
    var x = parseFloat(label.style.left) || 0, y = parseFloat(label.style.top) || 0;
    show(zoneOf(document.elementFromPoint(x, y)), x, y);
  });
})();
