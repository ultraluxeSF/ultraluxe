/* Click tracking for Google Analytics 4 (G-FDHWKRH7W0) and Yandex Metrika (54894073).
   Every link click is sent as a "link_click" event with what was clicked and where it leads.
   Project thumbnails also send "select_project"; email/Telegram clicks also send "contact_click". */
(function () {
  "use strict";
  var YM_ID = 54894073;

  function send(name, params) {
    try { if (typeof window.gtag === "function") window.gtag("event", name, params); } catch (e) {}
  }
  function goal(name, params) {
    try { if (typeof window.ym === "function") window.ym(YM_ID, "reachGoal", name, params); } catch (e) {}
  }

  function labelFor(a) {
    var img = a.querySelector("img[alt]:not([alt=''])");
    var h = a.querySelector("h3");
    var text = (a.getAttribute("title") || (h && h.textContent) || (img && img.getAttribute("alt")) || a.textContent || "")
      .replace(/\s+/g, " ").trim();
    return text.slice(0, 100) || a.getAttribute("href");
  }

  function typeOf(a, url) {
    var href = a.getAttribute("href") || "";
    if (href.indexOf("mailto:") === 0) return "email";
    if (/(^|\.)t\.me$/.test(url.hostname)) return "telegram";
    if (/instagram|behance|linkedin|artstation|youtube|teepublic|fiverr/.test(url.hostname)) return "social";
    if (/google\.|goo\.gl/.test(url.hostname)) return "reviews";
    if (url.hostname === location.hostname || /(^|\.)ultraluxedesigns\.com$/.test(url.hostname)) {
      return href.charAt(0) === "#" ? "scroll" : "internal";
    }
    return "outbound";
  }

  function areaOf(a) {
    if (a.closest(".lang-switch")) return "language";
    if (a.closest(".grid, .index, .cases, .marquee")) return "project_grid";
    if (a.closest(".site-header")) return "navigation";
    if (a.closest(".cv-links")) return "cv";
    if (a.closest(".site-footer")) return "footer";
    if (a.closest(".contact, .cv-actions")) return "contact";
    return "content";
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }

    var type = typeOf(a, url);
    var area = areaOf(a);
    var label = labelFor(a);
    var params = {
      link_text: label,
      link_url: a.getAttribute("href").indexOf("mailto:") === 0 ? "mailto" : url.href,
      link_type: type,
      link_area: area,
      page_path: location.pathname
    };

    send("link_click", params);
    goal("link_click", params);

    if (area === "project_grid") {
      send("select_project", { project: label, link_area: area, page_path: location.pathname });
      goal("select_project", { project: label });
    }
    if (type === "email" || type === "telegram") {
      send("contact_click", { method: type, page_path: location.pathname });
      goal("contact_click", { method: type });
    }
  }, true);
})();
