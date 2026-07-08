/* Jia Xu — site behaviour: reveal on scroll, mobile menu, language memory,
   and little doodle interactions (magpie chirps, tomato squishes) */
(function () {
  document.documentElement.classList.add('js');

  /* scroll reveal */
  var revealed = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' });
    revealed.forEach(function (el) { io.observe(el); });
  } else {
    revealed.forEach(function (el) { el.classList.add('in'); });
  }

  /* mobile menu */
  var btn = document.querySelector('.menu-btn');
  var nav = document.querySelector('.site-nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* remember language choice */
  document.querySelectorAll('.lang-switch a').forEach(function (a) {
    a.addEventListener('click', function () {
      try { localStorage.setItem('lang', a.dataset.lang); } catch (e) {}
    });
  });

  /* magpie chatter, synthesised — no audio file needed */
  function magpieChirp() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = window.__magpieCtx || (window.__magpieCtx = new Ctx());
      if (ctx.state === 'suspended') ctx.resume();
      var t = ctx.currentTime + 0.02;
      for (var i = 0; i < 6; i++) {              /* rapid "chak-chak-chak" */
        var o = ctx.createOscillator();
        var f = ctx.createBiquadFilter();
        var g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(1950 - i * 70, t);
        o.frequency.exponentialRampToValueAtTime(1250, t + 0.055);
        f.type = 'bandpass';
        f.frequency.value = 1700;
        f.Q.value = 2.2;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
        o.connect(f); f.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.09);
        t += 0.098;
      }
    } catch (e) {}
  }

  function pop(el) {
    el.classList.remove('pop');
    void el.getBoundingClientRect();
    el.classList.add('pop');
    setTimeout(function () { el.classList.remove('pop'); }, 600);
  }

  /* hero magpie: click to hear it */
  var heroBird = document.querySelector('.hero-flourish .bird');
  if (heroBird) {
    heroBird.addEventListener('click', function () {
      magpieChirp();
      heroBird.classList.remove('sing');
      void heroBird.getBoundingClientRect();
      heroBird.classList.add('sing');
      setTimeout(function () { heroBird.classList.remove('sing'); }, 700);
    });
  }

  /* doodles: tomatoes squish, birds chirp */
  document.querySelectorAll('.doodle').forEach(function (d) {
    d.addEventListener('click', function () {
      pop(d);
      if (d.classList.contains('doodle-bird')) magpieChirp();
    });
  });

  /* garden emoji hop on click */
  document.querySelectorAll('.garden span').forEach(function (g) {
    g.addEventListener('click', function () { pop(g); });
  });

  /* margin fruits live below the News section, spread down the page */
  var edge = document.querySelector('.edge-art');
  if (edge) {
    var fruits = edge.querySelectorAll('svg');
    var placeFruits = function () {
      var news = document.getElementById('news');
      var start = (news ? news.offsetTop : 420) + 80;
      var end = document.documentElement.scrollHeight - 440;
      var span = Math.max(end - start, 240);
      fruits.forEach(function (s, i) {
        s.style.top = Math.round(start + span * (i / Math.max(fruits.length - 1, 1))) + 'px';
      });
    };
    placeFruits();
    window.addEventListener('load', placeFruits);
    window.addEventListener('resize', placeFruits);
  }

  /* cute visitor counter — today's + total, via CounterAPI */
  (function () {
    var bar = document.getElementById('visitorBar');
    if (!bar || !window.fetch) return;
    var base = 'https://api.counterapi.dev/v1/chiapatricia-github-io/';
    var day = new Date().toISOString().slice(0, 10);
    var incToday = false, incTotal = false;
    try {
      if (!localStorage.getItem('seen-' + day)) { localStorage.setItem('seen-' + day, '1'); incToday = true; }
      if (!sessionStorage.getItem('seen')) { sessionStorage.setItem('seen', '1'); incTotal = true; }
    } catch (e) {}
    function counter(key, inc) {
      return fetch(base + key + (inc ? '/up' : '/'))
        .then(function (r) { return r.json(); })
        .then(function (d) { return d.count; });
    }
    function countUp(el, n) {
      var t0 = null;
      function step(t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / 700, 1);
        el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3))).toLocaleString();
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    Promise.all([counter('today-' + day, incToday), counter('total', incTotal)])
      .then(function (v) {
        bar.hidden = false;
        countUp(bar.querySelector('[data-v="today"]'), v[0]);
        countUp(bar.querySelector('[data-v="total"]'), v[1]);
      })
      .catch(function () { /* counter service unavailable: keep the bar hidden */ });
  })();

  /* ---- shared helpers ---- */
  var ZH = (document.documentElement.lang || '').slice(0, 2) === 'zh';
  function onScroll(fn) {
    var ticking = false;
    function run() { fn(); ticking = false; }
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(run); ticking = true; }
    }, { passive: true });
    fn();
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        resolve();
      } catch (e) { reject(e); }
    });
  }

  /* ---- scroll progress bar (five-colour signature) ---- */
  (function () {
    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.appendChild(bar);
    onScroll(function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? h.scrollTop / max : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    });
  })();

  /* ---- back to top ---- */
  (function () {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'to-top';
    b.setAttribute('aria-label', ZH ? '回到顶部' : 'Back to top');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    document.body.appendChild(b);
    b.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    onScroll(function () { b.classList.toggle('show', window.pageYOffset > 600); });
  })();

  /* ---- contact email: click to copy ---- */
  (function () {
    var el = document.querySelector('.contact-email');
    if (!el) return;
    var email = el.textContent.trim();
    var copyIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>';
    var checkIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    var ic = document.createElement('span');
    ic.style.display = 'inline-flex';
    ic.innerHTML = copyIc;
    var tx = document.createElement('span');
    tx.textContent = email;
    el.textContent = '';
    el.appendChild(ic); el.appendChild(tx);
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.title = ZH ? '点击复制邮箱' : 'Click to copy';
    var busy = false;
    function copy() {
      if (busy) return;
      copyText(email).then(function () {
        busy = true;
        el.classList.add('copied');
        ic.innerHTML = checkIc;
        tx.textContent = ZH ? '已复制' : 'Copied';
        setTimeout(function () {
          el.classList.remove('copied');
          ic.innerHTML = copyIc;
          tx.textContent = email;
          busy = false;
        }, 1400);
      }, function () {});
    }
    el.addEventListener('click', copy);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy(); }
    });
  })();

  /* ---- photo lightbox ---- */
  (function () {
    var imgs = Array.prototype.slice.call(document.querySelectorAll('.photo-grid img'));
    if (!imgs.length) return;
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML =
      '<button class="lb-btn lb-close" aria-label="' + (ZH ? '关闭' : 'Close') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
      '<button class="lb-btn lb-prev" aria-label="' + (ZH ? '上一张' : 'Previous') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<button class="lb-btn lb-next" aria-label="' + (ZH ? '下一张' : 'Next') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>' +
      '<img alt="">';
    document.body.appendChild(lb);
    var big = lb.querySelector('img');
    var idx = 0;
    function show(i) {
      idx = (i + imgs.length) % imgs.length;
      big.src = imgs[idx].currentSrc || imgs[idx].src;
      big.alt = imgs[idx].alt || '';
    }
    function open(i) { show(i); lb.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function close() { lb.classList.remove('open'); document.body.style.overflow = ''; }
    imgs.forEach(function (im, i) { im.addEventListener('click', function () { open(i); }); });
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
    });
  })();

  /* ---- projects: filter by research area ---- */
  (function () {
    var sections = Array.prototype.slice.call(document.querySelectorAll('main .section'))
      .filter(function (s) { return s.querySelector('.area-head'); });
    if (sections.length < 2) return;
    var bar = document.createElement('div');
    bar.className = 'filter-bar';
    var btns = [];
    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.textContent = ZH ? '全部' : 'All';
    allBtn.setAttribute('aria-pressed', 'true');
    bar.appendChild(allBtn); btns.push(allBtn);
    sections.forEach(function (s, i) {
      var head = s.querySelector('.area-head');
      var num = head.querySelector('.area-num');
      var title = head.querySelector('h2').textContent.trim();
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.dataset.idx = i;
      if (num && num.style.getPropertyValue('--ac')) b.style.setProperty('--fc', num.style.getPropertyValue('--ac'));
      b.innerHTML = '<span class="dot"></span>' + title;
      bar.appendChild(b); btns.push(b);
    });
    var host = document.createElement('div');
    host.className = 'container';
    host.style.paddingTop = '8px';
    host.appendChild(bar);
    sections[0].parentNode.insertBefore(host, sections[0]);
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var sel = b.dataset.idx;
        btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        sections.forEach(function (s, i) { s.classList.toggle('is-hidden', sel !== undefined && String(i) !== sel); });
      });
    });
  })();

  /* ---- publications: topic filter + copy BibTeX ---- */
  (function () {
    var pubs = Array.prototype.slice.call(document.querySelectorAll('.pub'));
    if (!pubs.length) return;
    var LABELS = {
      llm:      { en: 'LLMs & Mental Health', zh: '大模型与心理健康', c: 'var(--green-deep)' },
      imaging:  { en: 'Medical Imaging',      zh: '医学影像',         c: 'var(--blue-deep)' },
      fairness: { en: 'Fairness',             zh: '公平性',           c: 'var(--tomato-deep)' },
      aging:    { en: 'Aging & Population Health', zh: '衰老与人群健康', c: 'var(--orange-deep)' }
    };
    var order = ['llm', 'imaging', 'fairness', 'aging'];
    var present = {};
    pubs.forEach(function (p) {
      (p.dataset.topic || '').split(/\s+/).forEach(function (t) { if (t) present[t] = 1; });
    });
    var topics = order.filter(function (t) { return present[t] && LABELS[t]; });
    if (topics.length > 1) {
      var bar = document.createElement('div');
      bar.className = 'filter-bar';
      var btns = [];
      var allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.textContent = ZH ? '全部' : 'All';
      allBtn.setAttribute('aria-pressed', 'true');
      bar.appendChild(allBtn); btns.push(allBtn);
      topics.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-pressed', 'false');
        b.dataset.topic = t;
        b.style.setProperty('--fc', LABELS[t].c);
        b.innerHTML = '<span class="dot"></span>' + (ZH ? LABELS[t].zh : LABELS[t].en);
        bar.appendChild(b); btns.push(b);
      });
      var firstSection = document.querySelector('main .section');
      var host = document.createElement('div');
      host.className = 'container';
      host.style.paddingTop = '8px';
      host.appendChild(bar);
      firstSection.parentNode.insertBefore(host, firstSection);
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          var topic = b.dataset.topic;
          btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          pubs.forEach(function (p) {
            var list = (p.dataset.topic || '').split(/\s+/);
            p.classList.toggle('is-hidden', !!topic && list.indexOf(topic) === -1);
          });
          document.querySelectorAll('main .section').forEach(function (sec) {
            var secPubs = sec.querySelectorAll('.pub');
            if (secPubs.length) {
              var any = Array.prototype.some.call(secPubs, function (p) { return !p.classList.contains('is-hidden'); });
              sec.classList.toggle('is-hidden', !any);
            }
          });
        });
      });
    }

    /* copy BibTeX per paper, generated from the citation shown */
    function bibtex(p) {
      var year = (p.querySelector('.pub-year') || {}).textContent || '';
      year = year.trim();
      var title = (p.querySelector('.pub-title') || {}).textContent || '';
      title = title.trim();
      var venue = (p.querySelector('.pub-venue') || {}).textContent || '';
      venue = venue.trim();
      var authorsRaw = (p.querySelector('.pub-authors') || {}).textContent || '';
      var toks = authorsRaw.match(/[A-Z][A-Za-z'’-]+,\s*(?:[A-Z]\.\s*)+/g) || [];
      var authors = toks.map(function (s) { return s.replace(/\s+/g, ' ').trim().replace(/,\s*$/, ''); }).join(' and ');
      var badges = Array.prototype.map.call(p.querySelectorAll('.pub-badges .tag'), function (t) { return t.textContent; }).join(' ');
      var isJournal = /journal/i.test(badges) || /journal|informatics for health|international journal/i.test(venue);
      var surname = (toks[0] || 'xu').split(',')[0].replace(/[^A-Za-z]/g, '').toLowerCase();
      var firstWord = 'ref';
      title.split(/\s+/).some(function (w) {
        var c = w.replace(/[^A-Za-z]/g, '');
        if (c.length > 3) { firstWord = c.toLowerCase(); return true; }
        return false;
      });
      var key = surname + year + firstWord;
      var type = isJournal ? 'article' : 'inproceedings';
      var field = isJournal ? 'journal' : 'booktitle';
      var lines = [
        '@' + type + '{' + key + ',',
        '  author = {' + authors + '},',
        '  title = {' + title + '},',
        '  ' + field + ' = {' + venue + '},',
        '  year = {' + year + '}',
        '}'
      ];
      return lines.join('\n');
    }
    var copyIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>';
    var checkIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    pubs.forEach(function (p) {
      var content = p.querySelector('.pub-year') ? p.querySelector('.pub-year').nextElementSibling : p;
      if (!content) return;
      var wrap = document.createElement('div');
      wrap.className = 'pub-cite';
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = copyIc + '<span>' + (ZH ? '引用' : 'Cite') + '</span>';
      wrap.appendChild(b);
      content.appendChild(wrap);
      var busy = false;
      b.addEventListener('click', function () {
        if (busy) return;
        copyText(bibtex(p)).then(function () {
          busy = true;
          b.classList.add('copied');
          b.innerHTML = checkIc + '<span>' + (ZH ? '已复制 BibTeX' : 'BibTeX copied') + '</span>';
          setTimeout(function () {
            b.classList.remove('copied');
            b.innerHTML = copyIc + '<span>' + (ZH ? '引用' : 'Cite') + '</span>';
            busy = false;
          }, 1500);
        }, function () {});
      });
    });
  })();
})();
