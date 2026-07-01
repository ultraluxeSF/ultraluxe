/**
 * Smooth Scroll with Inertia
 * Uses a velocity + friction decay physics model for premium, glitch-free scrolling.
 * Each wheel tick adds to a velocity, which decays exponentially every frame.
 */
(function () {
	'use strict';

	// ── Tuning knobs ────────────────────────────────────────────────────────────
	const SCROLL_SPEED = 10;   // pixels of velocity added per wheel "tick"
	const FRICTION = 0.97;  // velocity multiplied by this each frame (0–1; lower = shorter coast)
	const MIN_VELOCITY = 0.1;   // stop animating below this threshold (px/frame)
	// ────────────────────────────────────────────────────────────────────────────

	let velocity = 0;   // current scroll velocity in px/frame
	let rafId = null; // requestAnimationFrame handle
	let scrollEl = null; // the actual scrollable element

	function init() {
		// Resolve the true scrolling element (cross-browser)
		scrollEl = document.scrollingElement || document.documentElement || document.body;

		window.addEventListener('wheel', onWheel, { passive: false });
	}

	function onWheel(e) {
		e.preventDefault(); // hand full control to our engine

		// Normalise delta across deltaMode values
		let rawDelta = e.deltaY;
		if (e.deltaMode === 1) rawDelta *= 40;   // "lines" mode
		if (e.deltaMode === 2) rawDelta *= 800;  // "pages" mode

		// Convert raw delta to a normalised ±1 direction, then scale
		// Using sign + sqrt gives lighter weights to very large trackpad deltas
		// so fast trackpad / magic mouse swipes don't feel rocket-powered
		const sign = rawDelta > 0 ? 1 : -1;
		velocity += sign * SCROLL_SPEED;

		// Kick off the animation loop only if not already running
		if (!rafId) animate();
	}

	function animate() {
		// Apply friction every frame → exponential decay = natural "coast"
		velocity *= FRICTION;

		// Clamp position to page bounds
		const maxScroll = scrollEl.scrollHeight - window.innerHeight;
		const nextScroll = Math.max(0, Math.min(scrollEl.scrollTop + velocity, maxScroll));

		// If we hit a hard boundary, kill velocity to avoid a sticky stuck loop
		if (nextScroll === 0 || nextScroll === maxScroll) {
			velocity = 0;
		}

		scrollEl.scrollTop = nextScroll;

		// Stop the loop when velocity becomes imperceptibly small
		if (Math.abs(velocity) > MIN_VELOCITY) {
			rafId = requestAnimationFrame(animate);
		} else {
			velocity = 0;
			rafId = null;
		}
	}

	// Initialise after DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();