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
  const duration = 1200;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.floor(eased * target);
    el.textContent = formatNumber(value);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = formatNumber(target);
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

// ---------- Reference brief chips ----------
const briefInput = document.getElementById('briefInput');
document.querySelectorAll('.tag-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    briefInput.value = chip.dataset.fill;
    briefInput.focus();
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
  const original = btn.innerHTML;
  btn.innerHTML = 'Drafting…';
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = 'Issued ✓';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.disabled = false;
      document.getElementById('waitlist').scrollIntoView({ behavior: 'smooth' });
    }, 1100);
  }, 1500);
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

// ---------- Sticky nav shadow ----------
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 10) nav.style.boxShadow = '0 8px 24px -14px rgba(0,0,0,0.6)';
  else nav.style.boxShadow = 'none';
});
