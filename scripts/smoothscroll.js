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
     Colour under the pointer. Images are sampled at full resolution,
     one pixel at a time, from a 1x1 canvas.
  --------------------------------------------------------------- */
  var probeCanvas = null, probeCtx = null;
  var unreadable = {}; // url -> true when the browser won't let us read it (other domain)
  function newProbe() {
    probeCanvas = document.createElement("canvas");
    probeCanvas.width = probeCanvas.height = 1;
    probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
  }
  // Chrome can't sample a 1px region straight from an SVG, so vector images are
  // drawn once into a canvas (at up to 2x their natural size) and read from there
  var rasters = {};
  function raster(src, url) {
    var c = rasters[url];
    if (c) return c;
    var k = Math.max(1, Math.min(2, 600 / Math.max(src.naturalWidth, src.naturalHeight)));
    c = document.createElement("canvas");
    c.width = Math.round(src.naturalWidth * k); c.height = Math.round(src.naturalHeight * k);
    c.scale = k;
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    return (rasters[url] = c);
  }

  function pixel(src, sx, sy) {
    var url = src.currentSrc || src.src;
    if (unreadable[url]) return "blend";
    if (/\.svg(\?|#|$)/i.test(url) && src.naturalWidth) {
      var rc = raster(src, url);
      sx = Math.min(rc.width - 1, Math.floor(sx * rc.scale));
      sy = Math.min(rc.height - 1, Math.floor(sy * rc.scale));
      src = rc;
    }
    if (!probeCtx) newProbe();
    try {
      probeCtx.clearRect(0, 0, 1, 1);
      probeCtx.drawImage(src, sx, sy, 1, 1, 0, 0, 1, 1);
      var d = probeCtx.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    } catch (err) {
      unreadable[url] = true;
      newProbe(); // a canvas stays locked after reading another domain's image
      return "blend";
    }
  }

  // Pixel of an image-like source drawn into the box of "el" (an <img> or an
  // element with CSS `content: url(...)`). Returns {r,g,b,a}, "blend" or null.
  function imageColor(src, el, x, y) {
    if (!src.complete) return null;
    var r = el.getBoundingClientRect();
    var nw = src.naturalWidth || r.width, nh = src.naturalHeight || r.height;
    if (!nw || !nh) return null;
    var fit = getComputedStyle(el).objectFit;
    var scale = fit === "cover" ? Math.max(r.width / nw, r.height / nh)
      : fit === "contain" || fit === "scale-down" ? Math.min(r.width / nw, r.height / nh) : 0;
    var dw = scale ? nw * scale : r.width, dh = scale ? nh * scale : r.height;
    var u = (x - r.left - (r.width - dw) / 2) / dw;
    var v = (y - r.top - (r.height - dh) / 2) / dh;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
    var isSvg = /\.svg(\?|#|$)/i.test(src.currentSrc || src.src || "");
    return pixel(src, isSvg ? u * nw : Math.floor(u * nw), isSvg ? v * nh : Math.floor(v * nh));
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

  // Images referenced from CSS (`content: url()` or `background-image: url()`)
  var cssImages = {};
  function cssImage(url) {
    var img = cssImages[url];
    if (!img) { img = cssImages[url] = new Image(); img.src = url; }
    return img;
  }
  function cssUrl(value) {
    var m = value && value.match(/url\(["']?([^"')]+)["']?\)/);
    return m ? m[1] : null;
  }

  // Split on top-level commas (not the ones inside rgb(...))
  function splitTop(str) {
    var out = [], depth = 0, cur = "";
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  // Colour of a linear-gradient() at a point inside the element's box
  function gradientColor(value, el, x, y) {
    var m = value.match(/linear-gradient\((.*)\)\s*$/);
    if (!m) return null;
    var parts = splitTop(m[1]);
    var angle = 180;
    var first = parts[0];
    var dirs = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270 };
    if (/deg$/.test(first)) { angle = parseFloat(first); parts.shift(); }
    else if (dirs[first] !== undefined) { angle = dirs[first]; parts.shift(); }
    var stops = parts.map(function (p) {
      var c = parseColor(p);
      var pos = p.match(/\)\s+([\d.]+)%/);
      return { c: c, pos: pos ? parseFloat(pos[1]) / 100 : null };
    }).filter(function (st) { return st.c; });
    if (!stops.length) return null;
    if (stops[0].pos === null) stops[0].pos = 0;
    if (stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 1;
    for (var i = 1; i < stops.length - 1; i++) {
      if (stops[i].pos === null) {
        var j = i; while (stops[j].pos === null) j++;
        var a = stops[i - 1].pos, b = stops[j].pos;
        for (var k = i; k < j; k++) stops[k].pos = a + (b - a) * (k - i + 1) / (j - i + 1);
      }
    }
    var r = el.getBoundingClientRect();
    var rad = angle * Math.PI / 180, sin = Math.sin(rad), cos = Math.cos(rad);
    var len = Math.abs(r.width * sin) + Math.abs(r.height * cos) || 1;
    var t = ((x - r.left - r.width / 2) * sin - (y - r.top - r.height / 2) * cos) / len + 0.5;
    t = Math.max(0, Math.min(1, t));
    var lo = stops[0], hi = stops[stops.length - 1];
    for (var s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s].pos && t <= stops[s + 1].pos) { lo = stops[s]; hi = stops[s + 1]; break; }
    }
    var f = hi.pos > lo.pos ? (t - lo.pos) / (hi.pos - lo.pos) : 0;
    if (t <= stops[0].pos) { lo = hi = stops[0]; f = 0; }
    return {
      r: lo.c.r + (hi.c.r - lo.c.r) * f, g: lo.c.g + (hi.c.g - lo.c.g) * f,
      b: lo.c.b + (hi.c.b - lo.c.b) * f, a: lo.c.a + (hi.c.a - lo.c.a) * f
    };
  }

  // Combined opacity of an element and all its parents
  function opacityOf(el) {
    var o = 1;
    while (el && el.nodeType === 1) { o *= parseFloat(getComputedStyle(el).opacity) || 0; el = el.parentElement; }
    return o;
  }

  // The text character (if any) directly under the point: its parent element
  function textUnder(x, y) {
    var node, offset;
    if (document.caretPositionFromPoint) {
      var pos = document.caretPositionFromPoint(x, y);
      if (pos) { node = pos.offsetNode; offset = pos.offset; }
    } else if (document.caretRangeFromPoint) {
      var rng = document.caretRangeFromPoint(x, y);
      if (rng) { node = rng.startContainer; offset = rng.startOffset; }
    }
    if (!node || node.nodeType !== 3 || !node.parentElement) return null;
    if (node.parentElement.closest(".cursor")) return null;
    var range = document.createRange();
    for (var k = Math.max(0, offset - 1); k <= Math.min(node.length - 1, offset); k++) {
      if (/\s/.test(node.data[k])) continue;
      range.setStart(node, k); range.setEnd(node, k + 1);
      var rects = range.getClientRects();
      for (var i = 0; i < rects.length; i++) {
        var b = rects[i];
        if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return node.parentElement;
      }
    }
    return null;
  }

  // Elements the browser skips when hit-testing (pointer-events: none) but that
  // still paint something, e.g. the floating head on the home page
  var ghosts = [];
  function findGhosts() {
    ghosts = [];
    var all = document.body.getElementsByTagName("*");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest(".cursor")) continue;
      var cs = getComputedStyle(el);
      if (cs.pointerEvents !== "none") continue;
      if (el.tagName === "IMG" || cssUrl(cs.content) || cssUrl(cs.backgroundImage) ||
          (parseColor(cs.backgroundColor) || { a: 0 }).a > 0) ghosts.push(el);
    }
  }

  var waitingForImage = false; // a hovered image swapped src or is still loading

  // Border colour if the point lies on the element's border (dividers, outlines of
  // cards and buttons), else null. Rounded corners follow the curve.
  var SIDES = ["Top", "Right", "Bottom", "Left"];
  function borderColor(el, cs, x, y) {
    var w = {}, any = false;
    SIDES.forEach(function (sd) {
      w[sd] = cs["border" + sd + "Style"] !== "none" && cs["border" + sd + "Style"] !== "hidden"
        ? parseFloat(cs["border" + sd + "Width"]) || 0 : 0;
      if (w[sd]) any = true;
    });
    if (!any) return null;
    var r = el.getBoundingClientRect();
    // allow half a pixel either side so 1px lines are easy to land on
    var dl = x - r.left, dr = r.right - x, dt = y - r.top, db = r.bottom - y;
    if (dl < -0.5 || dr < -0.5 || dt < -0.5 || db < -0.5) return null;
    var side = null;
    if (w.Top && dt <= w.Top + 0.5) side = "Top";
    else if (w.Bottom && db <= w.Bottom + 0.5) side = "Bottom";
    else if (w.Left && dl <= w.Left + 0.5) side = "Left";
    else if (w.Right && dr <= w.Right + 0.5) side = "Right";
    // inside a rounded corner the border follows the curve
    var rad = parseFloat(cs.borderTopLeftRadius) || 0;
    if (rad > 0) {
      var cx = dl < rad ? r.left + rad : dr < rad ? r.right - rad : null;
      var cy = dt < rad ? r.top + rad : db < rad ? r.bottom - rad : null;
      if (cx !== null && cy !== null) {
        var d = Math.hypot(x - cx, y - cy);
        var bw = Math.max(w.Top, w.Bottom, w.Left, w.Right);
        side = d >= rad - bw - 0.5 && d <= rad + 0.5 ? (dt < rad ? "Top" : "Bottom") : null;
      }
    }
    if (!side) return null;
    return parseColor(cs["border" + side + "Color"]);
  }

  // Layers one element paints at the point, top to bottom: text, border, image, background
  function layersOf(el, x, y, textEl) {
    var out = [];
    var cs = getComputedStyle(el);
    if (cs.visibility === "hidden") return out;
    if (el === textEl) {
      var tc = parseColor(cs.webkitTextFillColor) || parseColor(cs.color);
      if (tc) out.push(tc);
    }
    var bc = borderColor(el, cs, x, y);
    if (bc && bc.a > 0) { out.push(bc); if (bc.a >= 1) return out; }
    var src = null;
    if (el.tagName === "IMG") src = el;
    else {
      var cu = cssUrl(cs.content);
      if (cu) src = cssImage(cu);
    }
    if (src) {
      if (!src.complete) waitingForImage = true;
      var ic = imageColor(src, el, x, y);
      if (ic === "blend") return ["blend"];
      if (ic) out.push(ic);
      return out; // a replaced image hides its own background
    }
    var bi = cs.backgroundImage;
    if (bi && bi !== "none") {
      splitTop(bi).forEach(function (layer) {
        if (/^linear-gradient/.test(layer)) {
          var g = gradientColor(layer, el, x, y);
          if (g) out.push(g);
        }
      });
    }
    var bg = parseColor(cs.backgroundColor);
    if (bg && bg.a > 0) out.push(bg);
    return out;
  }

  // withText=false gives the backdrop only (used to pick the cursor's own ink)
  function colorAt(x, y, withText) {
    waitingForImage = false;
    var stack = document.elementsFromPoint(x, y).filter(function (el) {
      return !(el.closest && el.closest(".cursor"));
    });
    // pointer-events:none paints sit on top of what they overlap
    var extra = ghosts.filter(function (el) {
      if (stack.indexOf(el) !== -1) return false;
      var r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    stack = extra.concat(stack);
    var textEl = withText === false ? null : textUnder(x, y);

    // composite front to back
    var R = 0, G = 0, B = 0, A = 0;
    for (var i = 0; i < stack.length && A < 0.995; i++) {
      var op = opacityOf(stack[i]);
      if (op <= 0) continue;
      var layers = layersOf(stack[i], x, y, textEl);
      for (var j = 0; j < layers.length && A < 0.995; j++) {
        var c = layers[j];
        if (c === "blend") { if (A < 0.5) return "blend"; continue; }
        var a = c.a * op * (1 - A);
        R += c.r * a; G += c.g * a; B += c.b * a; A += a;
      }
    }
    // whatever is left shows the page behind (the site is dark)
    var rest = 1 - A;
    var page = parseColor(getComputedStyle(document.body).backgroundColor);
    if (!page || page.a < 0.4) page = { r: 0, g: 0, b: 0 };
    return { r: R + page.r * rest, g: G + page.g * rest, b: B + page.b * rest };
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
    // A twin layer drawn with mix-blend-mode: difference carries the hex text and the
    // swatch outline, so they invert against whatever is behind them, pixel by pixel.
    // (Blending has to happen on its own top-level layer; the swatch fill stays exact.)
    var ink = cursor.cloneNode(true);
    document.body.appendChild(ink);
    var info = cursor.querySelector(".cursor-info");
    var inkInfo = ink.querySelector(".cursor-info");
    var swatch = cursor.querySelector(".cursor-swatch");
    var label = ink.querySelector(".cursor-hex");
    var sizer = cursor.querySelector(".cursor-hex"); // invisible copy keeps both layouts identical
    var solidInk = "", inkClass = "";

    var mx = -100, my = -100, cx = -100, cy = -100;
    var dirty = true;
    var HOVERABLE = "a, button, [onclick], [data-cursor-hover]";

    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      settleUntil = performance.now() + 1100; // follow hover transitions and the floating head (1s ease)
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

    var lastCheck = 0, lastHex = "", settleUntil = 0;
    findGhosts();
    window.addEventListener("load", findGhosts);
    window.addEventListener("resize", findGhosts);
    (function loop(t) {
      var k = reduceMotion ? 1 : 0.32;
      cx += (mx - cx) * k;
      cy += (my - cy) * k;
      cursor.style.transform = ink.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
      // keep the label on screen near the right edge
      var left = cx > window.innerWidth - 150;
      info.classList.toggle("is-left", left);
      inkInfo.classList.toggle("is-left", left);
      var ic = cursor.className + " cursor-ink" + (solidInk ? " solid" : "");
      if (ic !== inkClass) { ink.className = inkClass = ic; }

      // re-check the colour under the pointer ~25 times a second
      if (dirty && t - lastCheck > 40) {
        lastCheck = t;
        dirty = false;
        var c = colorAt(mx, my);
        var imageLoading = waitingForImage;
        if (c === "blend") {
          cursor.style.mixBlendMode = "difference";
          cursor.classList.remove("on-light");
          cursor.classList.add("no-color");
          dirty = true; // keep checking until the pixels can be read
        } else {
          cursor.style.mixBlendMode = "";
          cursor.classList.remove("no-color");
          // ink follows the backdrop, not the text under the dot
          var back = colorAt(mx, my, false);
          cursor.classList.toggle("on-light", lum(back === "blend" ? c : back) > 0.55);
          var h = hex(c);
          if (h !== lastHex) {
            lastHex = h;
            swatch.style.backgroundColor = "#" + h;
            label.textContent = sizer.textContent = h;
          }
          // Inverting fails on flat mid-tones (grey on grey, khaki): there, use plain
          // white or near-black text, whichever contrasts more. Busy or mixed areas
          // keep the per-pixel invert.
          var lr = label.getBoundingClientRect();
          solidInk = "";
          if (lr.width) {
            var ls = [], lo = 1, hi = 0, sum = 0;
            for (var q = 0; q < 5; q++) {
              var u = colorAt(lr.left + lr.width * (0.1 + q * 0.2), lr.top + lr.height / 2, false);
              if (u === "blend") { ls = null; break; }
              var l = lum(u); ls.push(l); sum += l;
              lo = Math.min(lo, l); hi = Math.max(hi, l);
            }
            var avg = ls ? sum / ls.length : 0;
            if (ls && hi - lo < 0.08 && avg > 0.33 && avg < 0.67) {
              solidInk = avg < 0.5 ? "#ffffff" : "#1b1b1d";
            }
          }
          ink.style.setProperty("--solid", solidInk || "#ffffff");
        }
        if (imageLoading || t < settleUntil) dirty = true; // image loading / hover transition
      }
      requestAnimationFrame(loop);
    })(0);
  }

  if (document.body) initCursor();
  else document.addEventListener("DOMContentLoaded", initCursor);
})();
