/* Ultraluxe Designs: inertia scroll + background-aware circle cursor
   (same behaviour as the new ultraluxedesigns portfolio) */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------------------------------------------------------------
     Smooth scroll: the mouse wheel adds velocity, friction lets the
     page glide to a soft stop. Touch, keys and the scrollbar stay native.
  --------------------------------------------------------------- */
  var SPEED = 0.11;     // velocity added per pixel of wheel delta
  var MAX_KICK = 14;    // cap per event so one hard flick isn't a jump
  var FRICTION = 0.955; // per 60fps frame: lower = shorter glide

  function makeScroller() {
    var velocity = 0, pos = 0, target = null, running = false, ownScroll = false, last = 0;
    function read() { return window.scrollY; }
    function max() { return document.documentElement.scrollHeight - window.innerHeight; }
    function write(y) { ownScroll = true; window.scrollTo(0, y); }
    function tick(now) {
      var dt = last ? Math.min(64, now - last) / 16.667 : 1;
      last = now;
      var m = max();
      if (target !== null) {
        // anchor jumps: ease toward a fixed point
        pos += (target - pos) * (1 - Math.pow(1 - 0.1, dt));
        if (Math.abs(target - pos) < 0.5) { pos = target; target = null; }
      } else {
        pos += velocity * dt;
        velocity *= Math.pow(FRICTION, dt);
      }
      if (pos <= 0) { pos = 0; velocity = 0; }
      if (pos >= m) { pos = m; velocity = 0; }
      write(pos);
      if (target !== null || Math.abs(velocity) > 0.05) requestAnimationFrame(tick);
      else { running = false; velocity = 0; }
    }
    function start() {
      if (!running) { running = true; last = 0; requestAnimationFrame(tick); }
    }
    window.addEventListener("scroll", function () {
      if (ownScroll) { ownScroll = false; return; }
      // scrollbar drag, keyboard or find-in-page: hand control back
      pos = read(); velocity = 0; target = null;
    }, { passive: true });
    return {
      by: function (d) {
        if (!running) pos = read();
        target = null;
        var kick = Math.max(-MAX_KICK, Math.min(MAX_KICK, d * SPEED));
        // reversing direction cancels the glide immediately
        if (velocity && (kick > 0) !== (velocity > 0)) velocity = 0;
        velocity += kick;
        start();
      },
      to: function (y) { if (!running) pos = read(); velocity = 0; target = Math.max(0, Math.min(max(), y)); start(); }
    };
  }

  var smooth = null;
  if (!reduceMotion && finePointer) {
    root.classList.add("has-smooth");
    smooth = makeScroller();
    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey || e.defaultPrevented) return; // pinch-zoom
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;
      else if (e.deltaMode === 2) d *= window.innerHeight;
      e.preventDefault();
      smooth.by(d);
    }, { passive: false });
  }

  // In-page anchors (the ↑ buttons) use the same easing
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href");
    var el = id === "#" || id === "#top" ? document.body : document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    var y = el === document.body ? 0 : el.getBoundingClientRect().top + window.scrollY;
    if (smooth) smooth.to(y);
    else window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
  });

  if (!finePointer) return;

  /* ---------------------------------------------------------------
     Brightness under the pointer. Each image is reduced to a 24x24
     brightness map; maps are cached per image URL because thumbnails
     swap their src on hover.
  --------------------------------------------------------------- */
  var GRID = 24;
  var maps = {}; // url -> Float32Array | "blend" | "pending"

  function readMap(source) {
    var canvas = document.createElement("canvas");
    canvas.width = canvas.height = GRID;
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, GRID, GRID);
    var data = ctx.getImageData(0, 0, GRID, GRID).data; // throws if cross-origin
    var out = new Float32Array(GRID * GRID);
    for (var i = 0; i < out.length; i++) {
      var r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3] / 255;
      out[i] = a < 0.3 ? -1 : (0.299 * r + 0.587 * g + 0.114 * b) / 255; // -1 = transparent
    }
    return out;
  }

  function mapFor(img) {
    var url = img.currentSrc || img.src;
    if (maps[url]) return maps[url];
    if (!img.complete || !img.naturalWidth) return null;
    try {
      maps[url] = readMap(img);
    } catch (err) {
      // cross-origin image: try a CORS copy once, otherwise invert over it
      maps[url] = "pending";
      var probe = new Image();
      probe.crossOrigin = "anonymous";
      probe.onload = function () {
        try { maps[url] = readMap(probe); } catch (e2) { maps[url] = "blend"; }
      };
      probe.onerror = function () { maps[url] = "blend"; };
      probe.src = url;
    }
    return maps[url];
  }

  function imageBrightness(img, x, y) {
    var m = mapFor(img);
    if (!m) return null;
    if (typeof m === "string") return "blend";
    var r = img.getBoundingClientRect();
    var nw = img.naturalWidth, nh = img.naturalHeight;
    var fit = getComputedStyle(img).objectFit;
    var scale = fit === "cover" ? Math.max(r.width / nw, r.height / nh)
      : fit === "fill" ? 0 : Math.min(r.width / nw, r.height / nh);
    var dw = scale ? nw * scale : r.width, dh = scale ? nh * scale : r.height;
    var u = (x - r.left - (r.width - dw) / 2) / dw;
    var v = (y - r.top - (r.height - dh) / 2) / dh;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    var cx = Math.min(GRID - 1, Math.floor(u * GRID));
    var cy = Math.min(GRID - 1, Math.floor(v * GRID));
    var sum = 0, n = 0;
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        var gx = cx + dx, gy = cy + dy;
        if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) continue;
        var val = m[gy * GRID + gx];
        if (val >= 0) { sum += val; n++; }
      }
    }
    return n ? sum / n : null;
  }

  function parseColor(str) {
    var m = str && str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function lum(c) { return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255; }

  var waitingForImage = false; // a hovered thumbnail swapped src and is still loading

  function brightnessAt(x, y) {
    waitingForImage = false;
    var stack = document.elementsFromPoint(x, y);
    for (var i = 0; i < stack.length; i++) {
      var el = stack[i];
      if (el.classList && el.classList.contains("cursor")) continue;
      if (el.tagName === "IMG") {
        if (!el.complete || !el.naturalWidth) waitingForImage = true;
        var v = imageBrightness(el, x, y);
        if (v !== null) return v;
        continue;
      }
      // the first solid background hides everything beneath it
      var c = parseColor(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0.4) return lum(c);
    }
    var b = parseColor(getComputedStyle(document.body).backgroundColor);
    return b && b.a > 0.4 ? lum(b) : 0; // the site is dark by default
  }

  /* ---------------------------------------------------------------
     Cursor
  --------------------------------------------------------------- */
  function initCursor() {
    root.classList.add("has-cursor");
    var cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.setAttribute("aria-hidden", "true");
    document.body.appendChild(cursor);

    var mx = -100, my = -100, cx = -100, cy = -100;
    var dirty = true;
    var HOVERABLE = "a, button, [onclick], [data-cursor-hover]";

    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      if (!cursor.classList.contains("is-visible")) { cx = mx; cy = my; cursor.classList.add("is-visible"); }
      dirty = true;
      var h = e.target.closest && e.target.closest(HOVERABLE);
      cursor.classList.toggle("is-hover", !!h);
      cursor.classList.toggle("on-media", !!(h && h.querySelector && h.querySelector("img")));
    }, { passive: true });
    window.addEventListener("scroll", function () { dirty = true; }, { passive: true });
    document.addEventListener("mouseleave", function () { cursor.classList.remove("is-visible"); });
    document.addEventListener("mouseenter", function () { cursor.classList.add("is-visible"); });
    window.addEventListener("mousedown", function () { cursor.classList.add("is-down"); });
    window.addEventListener("mouseup", function () { cursor.classList.remove("is-down"); });

    var lastCheck = 0;
    (function loop(t) {
      var k = reduceMotion ? 1 : 0.32;
      cx += (mx - cx) * k;
      cy += (my - cy) * k;
      cursor.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";

      // re-check the colour under the pointer ~25 times a second
      if (dirty && t - lastCheck > 40) {
        lastCheck = t;
        dirty = false;
        var b = brightnessAt(mx, my);
        if (b === "blend") {
          cursor.style.mixBlendMode = "difference";
          cursor.classList.remove("on-light");
          dirty = true; // keep checking until the pixels can be read
        } else {
          cursor.style.mixBlendMode = "";
          cursor.classList.toggle("on-light", b > 0.55);
        }
        if (waitingForImage) dirty = true; // re-check once the new image has loaded
      }
      requestAnimationFrame(loop);
    })(0);
  }

  if (document.body) initCursor();
  else document.addEventListener("DOMContentLoaded", initCursor);
})();
