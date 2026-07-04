/* Jia Xu — site behaviour: reveal on scroll, mobile menu, language memory */
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

  /* magpie easter egg: click the bird to hear its chatter */
  var bird = document.querySelector('.hero-flourish .bird');
  if (bird) {
    bird.addEventListener('click', function () {
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
      bird.classList.remove('sing');
      void bird.getBoundingClientRect();
      bird.classList.add('sing');
      setTimeout(function () { bird.classList.remove('sing'); }, 700);
    });
  }
})();
