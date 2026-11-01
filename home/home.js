// SPDX-License-Identifier: GPL-3.0-or-later
// The only script of the home page (inlined by scripts/home-build.ts): the language chosen with the switch, scroll progress for the sentence that lights up (--p), the bright
// step of the desk and the cards that rise into view. Without it the page is complete and still; with
// reduced motion, and on a touch screen (a phone, a tablet), where the scroll effects stutter and slow
// the scroll down, only the desk's steps follow the scroll.
(() => {
	const root = document.documentElement;
	root.classList.add("js");
	// the language switch is a choice, kept in the cookie the documentation and the public demo share
	// on biblioviva.org (ADR-047): the Italian page no longer follows the browser's language
	document.querySelectorAll(".lang a[hreflang]").forEach((a) =>
		a.addEventListener("click", () => {
			const host = location.hostname;
			const domain =
				host === "biblioviva.org" || host.endsWith(".biblioviva.org")
					? "; domain=biblioviva.org"
					: "";
			const secure = location.protocol === "https:" ? "; secure" : "";
			document.cookie = `bv_lang=${a.hreflang}; path=/; max-age=31536000; samesite=lax${domain}${secure}`;
		}),
	);
	const steppers = [...document.querySelectorAll("[data-steps]")];
	steppers.forEach((s) => (s.dataset.step = "2"));
	// The bright step is the one across the middle of the part of the window the reader sees: all
	// of it beside the pinned screen, only what is below it when the two stack (a narrow window, an
	// iPad held upright), where a step sliding under the screen is out of sight. A change of state,
	// not a movement: it follows the scroll with reduced motion too, without fading.
	const light = () => {
		const vh = innerHeight;
		for (const s of steppers) {
			const stage = s.querySelector(".desk-stage").getBoundingClientRect();
			const list = s.querySelector(".desk-steps").getBoundingClientRect();
			const from = list.left < stage.right ? Math.max(0, stage.bottom) : 0;
			const mid = (from + vh) / 2;
			for (const step of s.querySelectorAll("[data-n]")) {
				const r = step.getBoundingClientRect();
				if (r.top <= mid && r.bottom > mid) {
					s.dataset.step = step.dataset.n;
				}
			}
		}
	};
	let lighting = false;
	const relight = () => {
		if (!lighting) {
			lighting = true;
			requestAnimationFrame(() => {
				lighting = false;
				light();
			});
		}
	};
	addEventListener("scroll", relight, { passive: true });
	addEventListener("resize", relight);
	light();
	if (
		matchMedia("(prefers-reduced-motion: reduce), (hover: none) and (pointer: coarse)").matches
	) {
		return;
	}
	root.classList.add("anim");
	const scrubs = [...document.querySelectorAll("[data-scrub]")];
	const clamp = (v) => Math.min(1, Math.max(0, v));
	const pieces = [...document.querySelectorAll(".reveal")];
	const frame = () => {
		const vh = innerHeight;
		// a jump (Home key, a link to the top) skips the observer: put back what is now below
		for (const el of pieces) {
			if (el.classList.contains("in") && el.getBoundingClientRect().top > vh) {
				el.classList.remove("in");
			}
		}
		for (const el of scrubs) {
			const r = el.getBoundingClientRect();
			const p =
				el.dataset.scrub === "pin"
					? clamp(-r.top / Math.max(1, r.height - vh))
					: clamp((vh - r.top) / (vh + r.height));
			el.style.setProperty("--p", p.toFixed(4));
		}
	};
	let queued = false;
	addEventListener(
		"scroll",
		() => {
			if (!queued) {
				queued = true;
				requestAnimationFrame(() => {
					queued = false;
					frame();
				});
			}
		},
		{ passive: true },
	);
	addEventListener("resize", frame);
	frame();

	// A piece rises when it enters from below and is put back when it leaves downwards, so
	// scrolling back to the top and down again plays the effect again.
	const reveal = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (e.isIntersecting) {
					e.target.classList.add("in");
				} else if (e.boundingClientRect.top > 0) {
					e.target.classList.remove("in");
				}
			}
		},
		{ rootMargin: "0px 0px -12% 0px" },
	);
	document.querySelectorAll(".reveal").forEach((el) => reveal.observe(el));
})();
