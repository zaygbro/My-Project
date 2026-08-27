// ---------- Mobile nav ----------
const navBurger = document.getElementById('navBurger');
const navMobile = document.getElementById('navMobile');
navBurger?.addEventListener('click', () => {
  navMobile.classList.toggle('open');
});
navMobile?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => navMobile.classList.remove('open'));
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

// ---------- Animated stat counters ----------
const statEls = document.querySelectorAll('.stat-num');
function formatNumber(n) {
  if (n >= 1000) return n.toLocaleString('en-US');
  return String(n);
}
function animateCount(el) {
  const target = parseInt(el.dataset.count, 10) || 0;
  const duration = 1400;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.floor(eased * target);
    el.textContent = formatNumber(value) + (el.dataset.suffix || '');
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = formatNumber(target) + (el.dataset.suffix || '');
  }
  requestAnimationFrame(tick);
}
const statObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCount(entry.target);
      statObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });
statEls.forEach(el => statObserver.observe(el));

// ---------- Hero prompt chips ----------
const heroInput = document.getElementById('heroInput');
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    heroInput.value = chip.dataset.fill;
    heroInput.focus();
  });
});

// ---------- Hero form (simulated generation) ----------
const heroForm = document.getElementById('heroForm');
heroForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = heroInput.value.trim();
  if (!val) {
    heroInput.focus();
    return;
  }
  const btn = heroForm.querySelector('button');
  const original = btn.innerHTML;
  btn.innerHTML = 'Assembling council…';
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = 'Draft ready ✦';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.disabled = false;
      document.getElementById('waitlist').scrollIntoView({ behavior: 'smooth' });
    }, 1200);
  }, 1600);
});

// ---------- Waitlist form ----------
const waitlistForm = document.getElementById('waitlistForm');
const waitlistNote = document.getElementById('waitlistNote');
waitlistForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('waitlistEmail').value.trim();
  if (!email) return;
  waitlistNote.textContent = `You're on the list — we'll email ${email} when your invite is ready.`;
  waitlistNote.classList.add('success');
  waitlistForm.reset();
});

// ---------- Sticky nav shrink shadow ----------
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 10) nav.style.boxShadow = '0 8px 30px -12px rgba(0,0,0,0.5)';
  else nav.style.boxShadow = 'none';
});

// ---------- Mock side items cycling ----------
const sideItems = document.querySelectorAll('.mock-side-item');
if (sideItems.length) {
  let idx = 0;
  setInterval(() => {
    sideItems.forEach(i => i.classList.remove('active'));
    idx = (idx + 1) % sideItems.length;
    sideItems[idx].classList.add('active');
  }, 1800);
}
