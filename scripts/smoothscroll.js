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
     Colour under the pointer. Each image is drawn once into a small
     canvas (max 160px side) and its pixels are cached per image URL,
     because thumbnails swap their src on hover.
  --------------------------------------------------------------- */
  var SAMPLE = 160;
  var maps = {}; // url -> {w, h, data} | "blend" | "pending"

  function readMap(source) {
    var nw = source.naturalWidth || source.width, nh = source.naturalHeight || source.height;
    var k = Math.min(1, SAMPLE / Math.max(nw, nh));
    var w = Math.max(1, Math.round(nw * k)), h = Math.max(1, Math.round(nh * k));
    var canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, w, h);
    return { w: w, h: h, data: ctx.getImageData(0, 0, w, h).data }; // throws if cross-origin
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

  // Returns {r, g, b}, "blend" (pixels unreadable) or null (pointer not over the picture)
  function imageColor(img, x, y) {
    var m = mapFor(img);
    if (!m) return null;
    if (typeof m === "string") return "blend";
    var r = img.getBoundingClientRect();
    var nw = img.naturalWidth, nh = img.naturalHeight;
    var fit = getComputedStyle(img).objectFit;
    var scale = fit === "cover" ? Math.max(r.width / nw, r.height / nh)
      : fit === "contain" || fit === "scale-down" ? Math.min(r.width / nw, r.height / nh) : 0;
    var dw = scale ? nw * scale : r.width, dh = scale ? nh * scale : r.height;
    var u = (x - r.left - (r.width - dw) / 2) / dw;
    var v = (y - r.top - (r.height - dh) / 2) / dh;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    var px = Math.min(m.w - 1, Math.floor(u * m.w));
    var py = Math.min(m.h - 1, Math.floor(v * m.h));
    var i = (py * m.w + px) * 4;
    if (m.data[i + 3] < 77) return null; // transparent: look at what's behind
    return { r: m.data[i], g: m.data[i + 1], b: m.data[i + 2] };
  }

  function parseColor(str) {
    var m = str && str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function lum(c) { return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255; }
  function hex(c) {
    return [c.r, c.g, c.b].map(function (v) {
      return ("0" + Math.round(v).toString(16)).slice(-2);
    }).join("").toUpperCase();
  }

  var waitingForImage = false; // a hovered thumbnail swapped src and is still loading

  function colorAt(x, y) {
    waitingForImage = false;
    var stack = document.elementsFromPoint(x, y);
    for (var i = 0; i < stack.length; i++) {
      var el = stack[i];
      if (el.closest && el.closest(".cursor")) continue;
      if (el.tagName === "IMG") {
        if (!el.complete || !el.naturalWidth) waitingForImage = true;
        var v = imageColor(el, x, y);
        if (v !== null) return v;
        continue;
      }
      // the first solid background hides everything beneath it
      var c = parseColor(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0.4) return c;
    }
    var b = parseColor(getComputedStyle(document.body).backgroundColor);
    return b && b.a > 0.4 ? b : { r: 0, g: 0, b: 0 }; // the site is dark by default
  }

  /* ---------------------------------------------------------------
     Cursor: ring + centre dot, with a swatch and hex code of the
     colour under the dot
  --------------------------------------------------------------- */
  function initCursor() {
    root.classList.add("has-cursor");
    var cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = '<span class="cursor-ring"></span><span class="cursor-dot"></span>' +
      '<span class="cursor-info"><span class="cursor-swatch"></span><span class="cursor-hex"></span></span>';
    document.body.appendChild(cursor);
    var info = cursor.querySelector(".cursor-info");
    var swatch = cursor.querySelector(".cursor-swatch");
    var label = cursor.querySelector(".cursor-hex");

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

    var lastCheck = 0, lastHex = "";
    (function loop(t) {
      var k = reduceMotion ? 1 : 0.32;
      cx += (mx - cx) * k;
      cy += (my - cy) * k;
      cursor.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
      // keep the label on screen near the right edge
      info.classList.toggle("is-left", cx > window.innerWidth - 150);

      // re-check the colour under the pointer ~25 times a second
      if (dirty && t - lastCheck > 40) {
        lastCheck = t;
        dirty = false;
        var c = colorAt(mx, my);
        if (c === "blend") {
          cursor.style.mixBlendMode = "difference";
          cursor.classList.remove("on-light");
          cursor.classList.add("no-color");
          dirty = true; // keep checking until the pixels can be read
        } else {
          cursor.style.mixBlendMode = "";
          cursor.classList.remove("no-color");
          cursor.classList.toggle("on-light", lum(c) > 0.55);
          var h = hex(c);
          if (h !== lastHex) {
            lastHex = h;
            swatch.style.backgroundColor = "#" + h;
            label.textContent = h;
          }
        }
        if (waitingForImage) dirty = true; // re-check once the new image has loaded
      }
      requestAnimationFrame(loop);
    })(0);
  }

  if (document.body) initCursor();
  else document.addEventListener("DOMContentLoaded", initCursor);
})();
