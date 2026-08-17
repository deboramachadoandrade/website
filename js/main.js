/* Prosop.ai — shared behaviour for every page.
   Loaded with `defer`, so the DOM is ready by the time this runs. */

(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- Slide-out menu ------------------------------------------------ */

    var toggle = document.getElementById('menuToggle');
    var closeBtn = document.getElementById('menuClose');
    var menu = document.getElementById('slideMenu');
    var overlay = document.getElementById('menuOverlay');

    if (toggle && menu && overlay) {
        var lastFocused = null;

        var focusable = function () {
            return Array.prototype.filter.call(
                menu.querySelectorAll('a[href], button'),
                function (el) { return el.getClientRects().length > 0; }
            );
        };

        var focusFirst = function () {
            if (!menu.classList.contains('is-open')) { return; }
            var first = focusable()[0];
            if (first && document.activeElement !== first) { first.focus(); }
        };

        var openMenu = function () {
            lastFocused = document.activeElement;
            menu.classList.add('is-open');
            overlay.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            menu.removeAttribute('aria-hidden');
            document.body.style.overflow = 'hidden';

            // Try immediately, then re-assert after paint: focus() is a no-op
            // while the drawer is still visibility:hidden, and a pointer press
            // can hand focus back to the toggle after this handler returns.
            focusFirst();
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(focusFirst);
            });
        };

        var closeMenu = function () {
            menu.classList.remove('is-open');
            overlay.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
            menu.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';

            // Send focus back where it came from, not to the top of the page
            if (lastFocused && typeof lastFocused.focus === 'function') {
                lastFocused.focus();
            }
        };

        var isOpen = function () {
            return menu.classList.contains('is-open');
        };

        toggle.addEventListener('click', function () {
            if (isOpen()) { closeMenu(); } else { openMenu(); }
        });

        if (closeBtn) { closeBtn.addEventListener('click', closeMenu); }
        overlay.addEventListener('click', closeMenu);

        menu.addEventListener('click', function (event) {
            if (event.target.closest('a')) { closeMenu(); }
        });

        document.addEventListener('keydown', function (event) {
            if (!isOpen()) { return; }

            if (event.key === 'Escape') {
                closeMenu();
                return;
            }

            // Keep tabbing inside the drawer while it is open
            if (event.key === 'Tab') {
                var items = focusable();
                if (!items.length) { return; }

                var first = items[0];
                var last = items[items.length - 1];

                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });
    }

    /* ---- Header state and scroll ruler --------------------------------- */

    var header = document.querySelector('.header');
    var rulerFill = document.getElementById('scrollFill');
    var ticking = false;

    var onScroll = function () {
        var y = window.scrollY || window.pageYOffset;

        if (header) {
            header.classList.toggle('is-scrolled', y > 24);
        }

        if (rulerFill) {
            var doc = document.documentElement;
            var max = doc.scrollHeight - doc.clientHeight;
            var pct = max > 0 ? Math.min(y / max, 1) * 100 : 0;
            rulerFill.style.width = pct.toFixed(2) + '%';
        }

        ticking = false;
    };

    window.addEventListener('scroll', function () {
        if (!ticking) {
            window.requestAnimationFrame(onScroll);
            ticking = true;
        }
    }, { passive: true });

    onScroll();

    /* ---- Reveal on scroll ---------------------------------------------- */

    var revealTargets = document.querySelectorAll('.reveal');

    if (reduceMotion || !('IntersectionObserver' in window)) {
        Array.prototype.forEach.call(revealTargets, function (el) {
            el.classList.add('is-visible');
        });
    } else {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) { return; }
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

        Array.prototype.forEach.call(revealTargets, function (el, i) {
            // Cards in a row wake up one after another rather than all at once
            el.style.transitionDelay = (Math.min(i % 4, 3) * 90) + 'ms';
            observer.observe(el);
        });

        // The observer's bottom margin means anything sitting in the last slice
        // of a very tall window would wait for a scroll that never comes.
        var sweep = function () {
            Array.prototype.forEach.call(revealTargets, function (el) {
                if (el.classList.contains('is-visible')) { return; }
                var r = el.getBoundingClientRect();
                if (r.top < window.innerHeight && r.bottom > 0) {
                    el.classList.add('is-visible');
                    observer.unobserve(el);
                }
            });
        };
        window.addEventListener('load', sweep);
        window.addEventListener('resize', sweep, { passive: true });
    }

    /* ---- The owl blinks, because it is up late -------------------------- */

    var owl = document.querySelector('.header__logo img');

    if (owl && !reduceMotion) {
        var blink = function () {
            owl.classList.add('is-blinking');
            window.setTimeout(function () {
                owl.classList.remove('is-blinking');
            }, 360);
            window.setTimeout(blink, 6000 + Math.random() * 9000);
        };
        window.setTimeout(blink, 4000);
    }

    /* ---- Housekeeping --------------------------------------------------- */

    var year = document.getElementById('year');
    if (year) { year.textContent = String(new Date().getFullYear()); }

    /* ---- For anyone who opens the console ------------------------------- */

    if (window.console && console.log) {
        console.log(
            '%c   ,_,   \n  (o,o)   Prosop.ai\n  {`"`}   AI for forward thinkers\n  -"-"-   \n',
            'color:#FFB203;font-family:monospace;font-size:12px;line-height:1.4'
        );
        console.log(
            '%cLooking under the hood? We like you already. hello@prosop.ai',
            'color:#96660F;font-family:monospace'
        );
    }
}());
