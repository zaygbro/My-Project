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
