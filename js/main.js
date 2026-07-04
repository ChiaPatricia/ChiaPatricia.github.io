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
})();
