// Postmark Archive: phone layout (screens narrower than 760px). Uses the page's own data and stamp code
// (ITEMS, stampHTML, esc). Desktop is untouched: nothing here runs unless html has class "m".
(function () {
  if (!document.documentElement.classList.contains('m')) return;
  var ARCHIVE = !!document.getElementById('drops');            // past-drops page vs homepage
  var root = document.createElement('div'); root.id = 'm-root';
  document.body.appendChild(root);
  var sheetScroll = 0, fromSheet = false;

  function slug(d) {                                             // same addresses as desktop
    var s = String(d.nameEn || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return (d.drop ? 'no' + d.drop.no + '-' : '') + s;
  }
  function indexFor(hash) {
    var h = decodeURIComponent(String(hash || '').replace(/^#/, ''));
    for (var i = 0; i < ITEMS.length; i++) if (h && slug(ITEMS[i]) === h) return i;
    return -1;
  }
  function stamp(d, view, tall) { return stampHTML(d, view, tall ? { tall: true, postmark: false } : { postmark: false }); }
  function titleHTML(t) {                                         // hyphenated words stay whole
    return String(t).split(' ').map(function (w) { return /-/.test(w) ? '<span class="nb">' + esc(w) + '</span>' : esc(w); }).join(' ');
  }
  function cityOf(d) { return String(d.city).replace(/ ([A-Z]{2})$/, ', $1'); }
  function dropLabel(d) { return '第' + (d.drop ? d.drop.no : DROP.no) + '便'; }
  function scaleCells() {
    root.querySelectorAll('.m-cell').forEach(function (c) {
      c.querySelector('.m-scale').style.transform = 'scale(' + (c.clientWidth / 156) + ')';
    });
  }
  function cell(i) {
    var d = ITEMS[i];
    return '<button class="m-cell" data-i="' + i + '" aria-label="' + esc(d.nameJa + ' ' + (d.sold ? '売約済' : d.price)) + '">' +
      '<div class="m-scale">' + stamp(d, d.views[0], false) + '</div></button>';
  }

  // ---------- the sheet ----------
  function renderSheet() {
    var html = '';
    if (!ARCHIVE) {
      html += '<a class="m-mast" href="index.html">POSTMARK ARCHIVE</a>' +
        '<div class="m-head"><h1>アメリカから、一点もの。</h1>' +
        '<div class="m-dropline"><b>' + esc(DROP_LABEL) + ' 公開中</b>　·　<a href="drops.html">過去の便を見る →</a></div>' +
        '<div class="m-count">全' + ITEMS.length + '点</div></div>' +
        '<div class="m-sheet">' + ITEMS.map(function (_, i) { return cell(i); }).join('') + '</div>' +
        '<div class="m-foot"><a href="drops.html">過去の便を見る →</a><div class="m-brand">POSTMARK ARCHIVE</div></div>';
    } else {
      var groups = [], seen = {};
      ITEMS.forEach(function (d, i) {
        var k = d.drop.no;
        if (!seen[k]) { seen[k] = { drop: d.drop, ix: [] }; groups.push(seen[k]); }
        seen[k].ix.push(i);
      });
      html += '<a class="m-mast" href="index.html">POSTMARK ARCHIVE</a>' +
        '<div class="m-arch-back"><a href="index.html">← 第' + CURRENT_DROP_NO + '便 公開中</a></div>' +
        '<div class="m-arch-title">過去の便</div><div class="m-arch-sub">すべて売約済。</div>' +
        groups.map(function (g) {
          return '<section class="m-drop"><div class="m-drop-head"><b>第' + g.drop.no + '便</b>　·　' + esc(g.drop.date) +
            ' 公開　·　' + g.ix.length + '点 完売</div><div class="m-sheet">' + g.ix.map(cell).join('') + '</div></section>';
        }).join('') +
        '<div class="m-foot"><a href="index.html">第' + CURRENT_DROP_NO + '便を見る →</a><div class="m-brand">POSTMARK ARCHIVE</div></div>';
    }
    root.innerHTML = html;
    scaleCells();
    root.querySelectorAll('.m-cell').forEach(function (c) {
      c.addEventListener('click', function () {
        sheetScroll = window.scrollY; fromSheet = true;
        location.hash = slug(ITEMS[+c.getAttribute('data-i')]);   // the listing opens from the address (Back works)
      });
    });
    window.scrollTo(0, sheetScroll);
  }

  // ---------- the listing ----------
  function renderListing(i) {
    var d = ITEMS[i];
    var views = d.views.map(function (v, j) {
      return '<button class="m-view" data-j="' + j + '" aria-label="写真を大きく表示"><div class="m-box"><div class="m-scale" style="transform:scale(1.3)">' +
        stamp(d, v, true) + '</div></div></button>';
    }).join('');
    var dots = d.views.length > 1 ? d.views.map(function (_, j) { return '<i class="' + (j ? '' : 'on') + '"></i>'; }).join('') : '';
    var rows = d.meas.map(function (m) { return '<div class="m-row"><span class="k">' + esc(m[0]) + '</span><span class="v">' + esc(m[1]) + '</span></div>'; }).join('');
    if (d.grade) rows += '<div class="m-row"><span class="k">状態ランク</span><span class="v m-jp"><b>' + esc(d.grade) + '</b>' + esc(d.gradeNote || '') + '</span></div>';
    if (d.sold) {
      var who = !d.owner ? '<span class="m-jp">個人蔵</span> <span class="tag">(PRIVATE COLLECTION)</span>'
        : (d.demo ? '<span>@' + esc(d.owner) + '</span>'
          : '<a href="https://www.instagram.com/' + encodeURIComponent(d.owner) + '/" target="_blank" rel="noopener">@' + esc(d.owner) + '</a>') +
          ' <span class="tag">(CONSIGNEE)</span>';
      rows += '<div class="m-row"><span class="k">収蔵先</span><span class="v spec-value-consignee">' + who + '</span></div>';
    }
    var found = dropLabel(d) + '  ·  FOUND: ' + cityOf(d) + ' (' + String(d.date).split(' ')[0] + ' ' + d.year + ')';
    root.innerHTML =
      '<div class="m-bar"><button class="m-back" aria-label="戻る">←</button><a class="m-mast" href="index.html">POSTMARK ARCHIVE</a><span style="width:44px"></span></div>' +
      '<div class="m-views">' + views + '</div><div class="m-dots">' + dots + '</div>' +
      '<div class="m-info"><div class="m-found">' + esc(found) + '</div>' +
      '<h2 class="m-title">' + titleHTML(d.nameJa) + '</h2><div class="m-en">' + esc(d.nameEn) + '</div>' + rows + '</div>' +
      '<div class="m-buy"><div><div class="p">' + esc(d.price) + '</div><div class="s">送料込み</div></div>' +
      (d.sold ? '<button class="sold" disabled>売約済</button>' : '<button class="m-cart">購入する</button>') + '</div>' +
      '<div class="m-photo" role="dialog" aria-modal="true" aria-label="写真"><button class="m-close" aria-label="閉じる">×</button>' +
      '<div class="m-strip">' + d.views.map(function (v) { return '<div class="m-pane"><img src="' + v.full + '" alt="' + esc(d.nameEn) + '"></div>'; }).join('') + '</div>' +
      '<div class="m-dots">' + dots + '</div><div class="m-help">細部や素材の質感まで、鮮明に。</div></div>';
    window.scrollTo(0, 0);
    root.querySelector('.m-back').addEventListener('click', function () {
      if (fromSheet) { fromSheet = false; history.back(); }              // back to the sheet, same scroll spot
      else { history.replaceState(null, '', location.pathname + location.search); route(); }   // opened from a shared link
    });
    var strip = root.querySelector('.m-views');
    function syncDots(el, sel) {
      var n = Math.round(el.scrollLeft / el.clientWidth);
      root.querySelectorAll(sel + ' i').forEach(function (dot, k) { dot.className = k === n ? 'on' : ''; });
    }
    strip.addEventListener('scroll', function () { syncDots(strip, '.m-dots:not(.m-photo .m-dots)'); });
    var photo = root.querySelector('.m-photo'), pstrip = photo.querySelector('.m-strip');
    root.querySelectorAll('.m-view').forEach(function (b) {
      b.addEventListener('click', function () {
        photo.classList.add('open');
        pstrip.scrollLeft = (+b.getAttribute('data-j')) * pstrip.clientWidth;
      });
    });
    pstrip.addEventListener('scroll', function () { syncDots(pstrip, '.m-photo .m-dots'); });
    photo.querySelector('.m-close').addEventListener('click', function () {
      photo.classList.remove('open'); photo.querySelectorAll('img').forEach(function (im) { im.classList.remove('zoom'); });
    });
    photo.querySelectorAll('img').forEach(function (im) {
      var last = 0;
      im.addEventListener('click', function (e) {                   // double-tap (or double-click) to zoom at that spot
        var now = Date.now();
        if (now - last < 350) {
          var r = im.getBoundingClientRect();
          im.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%';
          im.classList.toggle('zoom');
        }
        last = now;
      });
    });
  }

  function route() {
    var i = indexFor(location.hash);
    if (i >= 0) renderListing(i); else renderSheet();
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', scaleCells);
  var mq = window.matchMedia('(max-width: 759px)');
  (mq.addEventListener ? mq.addEventListener('change', function () { location.reload(); }) : mq.addListener(function () { location.reload(); }));
  route();
})();
