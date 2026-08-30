// ---------- Mobile nav ----------
const navBurger = document.getElementById('navBurger');
const navMobile = document.getElementById('navMobile');
navBurger?.addEventListener('click', () => {
  const open = navMobile.classList.toggle('open');
  navBurger.classList.toggle('open', open);
  navBurger.setAttribute('aria-expanded', String(open));
});
navMobile?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    navMobile.classList.remove('open');
    navBurger.classList.remove('open');
    navBurger.setAttribute('aria-expanded', 'false');
  });
});

// ---------- Reveal on scroll ----------
const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => revealObserver.observe(el));

// ---------- Council mechanism (engine status -> merge -> reconciled preview) ----------
const councilMechanism = document.getElementById('councilMechanism');
const councilReplay = document.getElementById('councilReplay');
if (councilMechanism) {
  const councilObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        councilMechanism.classList.add('council-run');
        councilObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.35 });
  councilObserver.observe(councilMechanism);

  councilReplay?.addEventListener('click', () => {
    councilMechanism.classList.remove('council-run');
    // Force reflow so re-adding the class restarts the CSS animations.
    void councilMechanism.offsetWidth;
    councilMechanism.classList.add('council-run');
  });
}

// ---------- Reference brief chips ----------
const briefInput = document.getElementById('briefInput');
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    briefInput.value = chip.dataset.fill;
    briefInput.focus();
  });
});

// ---------- Billing toggle (monthly / annual) ----------
const pricingSection = document.querySelector('.pricing');
document.querySelectorAll('.billing-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.billing-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pricingSection?.classList.toggle('annual', btn.dataset.period === 'annual');
  });
});

// ---------- Brief form (simulated drafting run) ----------
const briefForm = document.getElementById('briefForm');
briefForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = briefInput.value.trim();
  if (!val) {
    briefInput.focus();
    return;
  }
  const btn = briefForm.querySelector('button');
  btn.innerHTML = 'Drafting…';
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = 'Issued ✓';
    setTimeout(() => {
      window.location.href = `https://my-project-five-ochre-25.vercel.app/try?brief=${encodeURIComponent(val)}`;
    }, 1100);
  }, 1500);
});

// ---------- Sticky nav shadow ----------
// A scroll listener toggling an inline style on every tick forces a style
// recalc + repaint of the sticky nav per scroll event. A sentinel + observer
// gets the same "have we scrolled past the top" signal for free, off the
// scroll thread entirely.
const nav = document.getElementById('nav');
const navSentinel = document.getElementById('navSentinel');
if (nav && navSentinel) {
  const navShadowObserver = new IntersectionObserver((entries) => {
    nav.classList.toggle('nav-scrolled', !entries[0].isIntersecting);
  });
  navShadowObserver.observe(navSentinel);
}
