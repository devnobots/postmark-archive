// Postmark Archive (desktop): closing the item card and the large photo.
// - A visible, typographic [ 閉じる ] inside each card, part of its text grid, instead of an icon:
//   the item card: at the right end of the eyebrow line (第12便 · FOUND: …), same baseline, font and color;
//   the large photo: on the caption's baseline, in the caption's type, at the right edge of the photo frame.
// - Clicking the space around a card still closes it (the large photo first, then the item); Esc as before.
//   A drag that starts on the photo (panning the zoom) and ends outside never closes.
// The phone layout has its own close and back buttons.
(function () {
  if (document.documentElement.classList.contains('m')) return;
  var css = document.createElement('style');
  css.textContent =
    '.sg-head { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; }\n' +
    '.sg-head #found { flex: 1 1 auto; min-width: 0; }\n' +
    '.sg-close { position: static; width: auto; height: auto; flex: none; padding: 0; margin: 0; border: 0; background: none;\n' +
    '  font-family: inherit; font-weight: normal; line-height: inherit; cursor: pointer; white-space: nowrap; transition: opacity 120ms ease; }\n' +
    '.sg-close:hover { opacity: 0.55; }\n' +
    '.sg-close:focus-visible { outline: none; }\n' +
    'html.sg-kbd .sg-close:focus-visible { outline: 1px solid currentColor; outline-offset: 4px; }\n' +   // only for keyboard users
    '#full .full-box #fullClose { position: absolute; top: auto; right: 48px; bottom: 32px; height: 18px; font-size: 12px; line-height: 1.5;\n' +
    '  letter-spacing: 0.08em; color: #666666; font-family: "Shippori Mincho", serif; }';
  document.head.appendChild(css);
  var LABEL = '[ 閉じる ]';
  // the focus ring shows only once the keyboard is used (a card opened from a link focuses its close button)
  document.addEventListener('keydown', function (e) { if (e.key === 'Tab') document.documentElement.classList.add('sg-kbd'); }, true);
  document.addEventListener('mousedown', function () { document.documentElement.classList.remove('sg-kbd'); }, true);
  function asText(btn) { btn.textContent = LABEL; btn.classList.remove('icon-btn'); btn.classList.add('sg-close'); }

  // the item card: the eyebrow line becomes a row, the close at its right end
  var found = document.getElementById('found'), closeBtn = document.getElementById('closeBtn');
  if (found && closeBtn) {
    var head = document.createElement('div');
    head.className = 'sg-head';
    found.parentNode.insertBefore(head, found);
    head.appendChild(found);
    var hadFocus = document.activeElement === closeBtn;   // a shared link opened the card before this script ran
    asText(closeBtn);
    closeBtn.classList.add('found');                  // the eyebrow's own size, color and letter-spacing
    head.appendChild(closeBtn);
    if (hadFocus || isOpen('overlay')) closeBtn.focus({ preventScroll: true });
    // a sold piece's eyebrow that no longer fits beside the close: CONSIGNEE goes to a second line, cleanly
    // (第11便 · FOUND: ASHEVILLE, NC   [ 閉じる ] / CONSIGNEE: PRIVATE COLLECTION) instead of wrapping mid-phrase
    var SEP = '  ·  CONSIGNEE:';
    var fit = function () {
      if (found.querySelector('br') || !found.textContent.includes('CONSIGNEE:')) return;
      if (found.getBoundingClientRect().height <= parseFloat(getComputedStyle(found).fontSize) * 2) return;   // one line: fine
      for (var n = found.firstChild; n; n = n.nextSibling) {
        if (n.nodeType !== 3) continue;
        var k = n.data.indexOf(SEP);
        if (k < 0) continue;
        var rest = n.splitText(k);
        rest.data = rest.data.slice(SEP.length - 'CONSIGNEE:'.length);
        found.insertBefore(document.createElement('br'), rest);
        return;
      }
    };
    new MutationObserver(fit).observe(found, { childList: true });
    fit();
  }
  // the large photo: on the caption's line, at the right edge of the photo frame
  var fullClose = document.getElementById('fullClose'), box = document.querySelector('#full .full-box');
  if (fullClose && box) { asText(fullClose); box.appendChild(fullClose); }

  // clicking the space around a card closes it
  function isOpen(id) { var el = document.getElementById(id); return !!(el && el.classList.contains('open')); }
  function inside(t, sel) { return !!(t && t.closest && t.closest(sel)); }
  function zoneOf(t) {                                // 'full', 'item', or '' (inside a card, or nothing open)
    if (isOpen('full')) return inside(t, '.full-box, #sg-zoom') ? '' : 'full';
    if (isOpen('overlay')) return inside(t, '#overlay .panel') ? '' : 'item';
    return '';
  }
  var downZone = '';
  window.addEventListener('mousedown', function (e) { downZone = e.button === 0 ? zoneOf(e.target) : ''; }, true);
  window.addEventListener('click', function (e) {
    var z = zoneOf(e.target), start = downZone;
    downZone = '';
    if (!z || z !== start) return;
    e.preventDefault(); e.stopPropagation();
    if (z === 'full') window.closeFull(); else window.closeItem();
  }, true);
})();
