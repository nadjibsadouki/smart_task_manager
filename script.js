/*
  Smart Task Manager — script.js (index.html)
  ----------------------------------------------------------
  Objectifs :
  - Animation douce des sections au chargement et au scroll.
  - Mise en évidence du lien de navigation correspondant à la page courante.
  - Animations légères : cartes au survol + compteur de stats.
  - Menu mobile : activé uniquement si un bouton de menu existe.
  - Bouton « retour en haut » : activé uniquement s’il existe.

  Contraintes respectées :
  - JavaScript vanilla uniquement.
  - Script non intrusif : ne casse pas les futures pages.
  - Toujours vérifier l’existence des éléments avant d’agir.
*/

(() => {
  'use strict';

  /**
   * Le fichier script.js est chargé sur index.html via <script defer>.
   * Par sécurité (futures pages), le script n’active ses comportements
   * que s’il détecte clairement l’UI de la home.
   */
  const isHomePage =
    document.querySelector('.home-main') &&
    document.querySelector('.home-header') &&
    document.querySelector('.home-nav__list');

  if (!isHomePage) return;

  /**
   * Respect de l’accessibilité : si l’utilisateur demande moins d’animations,
   * on évite autant que possible les mouvements.
   */
  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * Récupère le nom de la page courante (ex: "index.html", "tasks.html").
   */
  const getCurrentPage = () => {
    const path = window.location.pathname || '';
    return path.split('/').filter(Boolean).pop() || '';
  };

  /**
   * Normalise une URL relative vers un nom de fichier.
   */
  const normalizeHrefToFile = (href) => {
    if (!href) return '';
    try {
      const url = new URL(href, window.location.origin);
      return url.pathname.split('/').filter(Boolean).pop() || '';
    } catch {
      return href;
    }
  };

  /**
   * 1) Animation douce des sections au chargement / au scroll.
   * ---------------------------------------------------------
   * On cible uniquement les éléments présents sur index.html.
   * La mise à l’écran est pilotée par IntersectionObserver avec fallback.
   */
  const initScrollReveal = () => {
    const targets = [
      ...document.querySelectorAll(
        '.home-hero, .home-section, .home-footer, .home-roadmap__item'
      ),
      ...document.querySelectorAll('.home-card, .home-dashboard'),
      ...document.querySelectorAll('.home-mini-stat')
    ];

    const uniqueTargets = Array.from(new Set(targets));
    if (!uniqueTargets.length || reduceMotion) {
      // Fallback : affichage immédiat sans animation.
      uniqueTargets.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    uniqueTargets.forEach((el) => {
      // Etat initial.
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      el.style.willChange = 'transform, opacity';
      el.style.transition =
        'opacity 650ms ease, transform 720ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    });

    if (!('IntersectionObserver' in window)) {
      uniqueTargets.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          observer.unobserve(el);
        });
      },
      {
        root: null,
        threshold: 0.14,
        rootMargin: '0px 0px -12% 0px'
      }
    );

    uniqueTargets.forEach((el) => observer.observe(el));
  };

  /**
   * 2) Lien de navigation actif.
   * ----------------------------
   * index.html a un aria-current="page" déjà présent sur Home.
   * Ici on le met à jour correctement pour les autres pages.
   */
  const initActiveNavLink = () => {
    const navList = document.querySelector('.home-nav__list');
    if (!navList) return;

    const currentFile = getCurrentPage() || 'index.html';

    const links = Array.from(navList.querySelectorAll('a[href]'));
    if (!links.length) return;

    // Effacer aria-current.
    links.forEach((a) => {
      if (a.hasAttribute('aria-current')) a.removeAttribute('aria-current');
    });

    // Appliquer aria-current sur le lien correspondant.
    let matched = false;
    links.forEach((a) => {
      const hrefFile = normalizeHrefToFile(a.getAttribute('href'));
      if (hrefFile && hrefFile === currentFile) {
        a.setAttribute('aria-current', 'page');
        matched = true;
      }
    });

    // Sécurité : si aucun match, on force index.
    if (!matched && currentFile === 'index.html') {
      links.forEach((a) => {
        const hrefFile = normalizeHrefToFile(a.getAttribute('href'));
        if (!hrefFile || hrefFile === 'index.html') {
          a.setAttribute('aria-current', 'page');
        }
      });
    }
  };

  /**
   * 4) Animation légère des cartes au survol.
   * ----------------------------------------
   * Même si style.css gère déjà un hover, on ajoute une micro-interaction
   * (inclinaison) uniquement pour améliorer l’expérience.
   */
  const initCardHover = () => {
    const cards = Array.from(document.querySelectorAll('.home-card'));
    if (!cards.length || reduceMotion) return;

    const onPointerMove = (e, card) => {
      const rect = card.getBoundingClientRect();
      const x = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
      const y = rect.height ? (e.clientY - rect.top) / rect.height : 0.5;

      const rotateX = (0.5 - y) * 3.5; // deg
      const rotateY = (x - 0.5) * 4.5; // deg

      card.style.transform = `translateY(-3px) perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const onPointerEnter = (e) => {
      const card = e.currentTarget;
      card.style.transition = card.style.transition || 'transform 160ms ease';
      card.style.willChange = 'transform';
      card.style.transform = 'translateY(-3px)';
    };

    const onPointerLeave = (e) => {
      const card = e.currentTarget;
      // On laisse le hover CSS faire le reste.
      card.style.transform = '';
    };

    cards.forEach((card) => {
      card.addEventListener('pointerenter', onPointerEnter);
      card.addEventListener(
        'pointermove',
        (e) => onPointerMove(e, card),
        { passive: true }
      );
      card.addEventListener('pointerleave', onPointerLeave);
    });
  };

  /**
   * 5) Animation des statistiques de la preview.
   * --------------------------------------------
   * - cible .home-dashboard__stats
   * - anime les valeurs numériques dans .home-mini-stat__value
   */
  const animateNumber = (from, to, durationMs, onUpdate) => {
    const start = performance.now();
    const delta = to - from;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const value = from + delta * easeOutCubic(t);
      onUpdate(value, t);
      if (t < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  const initStatsAnimation = () => {
    const statsWrap = document.querySelector('.home-dashboard__stats');
    if (!statsWrap) return;

    if (reduceMotion) {
      // Accessibilité : on n’anime pas, on garde la valeur telle quelle.
      return;
    }

    const valueEls = Array.from(
      statsWrap.querySelectorAll('.home-mini-stat__value')
    );

    const parsed = valueEls
      .map((el) => {
        const raw = (el.textContent || '').trim();
        const target = Number(raw.replace(',', '.'));
        return Number.isFinite(target) ? { el, target } : null;
      })
      .filter(Boolean);

    if (!parsed.length) return;

    let started = false;

    const startAnimation = () => {
      if (started) return;
      started = true;

      parsed.forEach(({ el, target }, index) => {
        const from = 0;
        const delay = index * 120;

        // On stocke un état (utile si re-rendu futur).
        el.dataset.animatedFrom = String(from);

        window.setTimeout(() => {
          animateNumber(from, target, 900, (value) => {
            // Les stats sont des entiers dans la maquette.
            el.textContent = String(Math.round(value));
          });
        }, delay);
      });
    };

    if (!('IntersectionObserver' in window)) {
      startAnimation();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            startAnimation();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.25, rootMargin: '0px 0px -10% 0px' }
    );

    observer.observe(statsWrap);
  };

  /**
   * 6) Menu mobile si un bouton de menu existe.
   * -------------------------------------------
   * index.html actuel n’a pas de bouton explicitement identifié.
   * On implémente un comportement générique et non intrusif.
   *
   * Candidats détectés (flexibles pour futures pages) :
   * - bouton[data-menu-toggle]
   * - #menu-toggle, .menu-toggle
   * - et un menu ciblé via [data-menu], #menu, .menu
   */
  const initMobileMenu = () => {
    // Détecter un bouton.
    const toggleBtn =
      document.querySelector('[data-menu-toggle]') ||
      document.querySelector('#menu-toggle') ||
      document.querySelector('.menu-toggle');

    if (!toggleBtn) return;

    // Détecter la cible menu.
    const menu =
      document.querySelector('[data-menu]') ||
      document.querySelector('#menu') ||
      document.querySelector('.menu');

    // Si pas de menu trouvé, on ne fait rien.
    if (!menu) return;

    const openClass = 'is-open';

    const setOpen = (isOpen) => {
      menu.classList.toggle(openClass, isOpen);
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
    };

    // Etat initial.
    if (!toggleBtn.hasAttribute('aria-expanded')) {
      toggleBtn.setAttribute('aria-expanded', 'false');
    }

    toggleBtn.addEventListener('click', () => {
      const isOpen = menu.classList.contains(openClass);
      setOpen(!isOpen);
    });

    // Fermer au clic en dehors.
    document.addEventListener('click', (e) => {
      const isClickInside = menu.contains(e.target) || toggleBtn.contains(e.target);
      if (isClickInside) return;
      if (!menu.classList.contains(openClass)) return;
      setOpen(false);
    });

    // Fermer au ESC.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!menu.classList.contains(openClass)) return;
      setOpen(false);
    });
  };

  /**
   * 7) Bouton « retour en haut » si nécessaire.
   * -------------------------------------------
   * index.html ne contient pas cet élément dans la maquette.
   * On le gère de façon générique.
   */
  const initBackToTop = () => {
    const backBtn =
      document.querySelector('[data-back-to-top]') ||
      document.querySelector('#back-to-top') ||
      document.querySelector('.back-to-top');

    if (!backBtn) return;

    const showAt = 450;

    const setVisible = (visible) => {
      backBtn.classList.toggle('is-visible', visible);
      backBtn.setAttribute('aria-hidden', String(!visible));
    };

    setVisible(false);

    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setVisible(y > showAt);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (reduceMotion) {
        window.scrollTo(0, 0);
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  /**
   * Initialisation : tout au démarrage DOM.
   */
  const init = () => {
    initActiveNavLink();
    initScrollReveal();
    initCardHover();
    initStatsAnimation();
    initMobileMenu();
    initBackToTop();
  };

  // Sécurité : exécution DOM-ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

