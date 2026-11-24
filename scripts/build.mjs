// Builds the whole site in three languages from data/*.json.
// English lives at the root, Russian in /ru/, Uzbek in /uz/.
// Run: node scripts/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const projects = read("data/projects.json");
const baseSite = read("data/site.json");
const I18N = read("data/i18n.json");
const LANGS = I18N.langs;

// Canonical address of the live site (used for canonical, hreflang, Open Graph, sitemap).
const SITE_URL = "https://ultraluxedesigns.com/";
// Images live in /images once mirrored; until then they load from the current site.
const REMOTE = "https://ultraluxedesigns.com/";
const asset = (p, R) => (fs.existsSync(path.join(ROOT, decodeURIComponent(p))) ? R + p : REMOTE + p);
const OG_IMAGE = SITE_URL + "images/og-image.jpg";
const GA_ID = "G-FDHWKRH7W0";
const YM_ID = 54894073;

const LOGO = fs.readFileSync(path.join(ROOT, "assets/logo-inline.svg"), "utf8");
// branding and graphic work first, UI/UX last; original order kept within each group
const RANK = { branding: 0, social: 1, "3d": 2, ui: 3 };
projects.sort((a, b) => RANK[a.category] - RANK[b.category]);
const bySlug = Object.fromEntries(projects.map((p) => [p.slug, p]));
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]);
const dirOf = (lang) => (lang === "en" ? "" : lang + "/");
const LOCALE = { en: "en_US", ru: "ru_RU", uz: "uz_UZ" };

// ---------- dates ----------
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const RU_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const RU_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const UZ_M = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const monthIndex = (m) => MONTHS.findIndex((x) => x.startsWith(m.toLowerCase().slice(0, 3)));
function tDate(s, lang) {
  if (!s || lang === "en") return s;
  const fixed = I18N.dates[lang] && I18N.dates[lang][s];
  if (fixed) return fixed;
  let m = s.match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/);
  if (m) {
    const i = monthIndex(m[2]);
    return lang === "ru" ? `${m[1]} ${RU_GEN[i]} ${m[3]}` : `${m[3]}-yil ${m[1]}-${UZ_M[i]}`;
  }
  m = s.match(/^([A-Za-z]+) (\d{4})$/);
  if (m) {
    const i = monthIndex(m[1]);
    return lang === "ru" ? `${RU_NOM[i]} ${m[2]}` : `${m[2]}-yil ${UZ_M[i]}`;
  }
  return s;
}
function tSection(title, lang) {
  if (lang === "en") return title;
  const map = I18N.sections[lang];
  const m = title.match(/^Vol\. (\d+)$/);
  if (m) return lang === "uz" ? `${m[1]}${map["Vol."]}` : `${map["Vol."]} ${m[1]}`;
  return map[title] || title;
}

// ---------- per-language content ----------
function content(lang) {
  const t = I18N.ui[lang];
  const cats = I18N.cats[lang];
  const o = lang === "en" ? {} : I18N.site[lang];
  const site = { ...baseSite, ...o };
  site.featured = baseSite.featured.map((f) => ({ ...f, line: (o.featured && o.featured[f.slug]) || f.line }));
  let cv = baseSite.cv;
  if (lang !== "en") {
    const c = I18N.cv[lang];
    const ll = c.linkLabels || {};
    cv = {
      ...cv,
      role: c.role,
      bio: c.bio,
      expertise: cv.expertise.map(([n, d], i) => [c.expertise[i] || n, d]),
      jobs: cv.jobs.map((j, i) => ({ ...j, ...c.jobs[i], links: j.links.map(([l, s]) => [ll[l] || l, s]) })),
      awards: cv.awards.map((a, i) => [...c.awards[i], a[3]]),
      education: c.education,
      languages: c.languages,
    };
  }
  const desc = (p) => (lang === "en" ? p.description : I18N.projects[lang][p.slug] || p.description);
  return { lang, t, cats, site, cv, desc };
}

// ---------- shared parts ----------
// ctx: { lang, R (path to site root), page (path inside a language, e.g. "work/x/") }
const langHref = (ctx, l) => ctx.R + dirOf(l) + ctx.page || "./";
const L = (ctx) => ctx.R + dirOf(ctx.lang);

function analyticsHead(R) {
  // Counters only run on the live domain, so test builds don't pollute the stats.
  return `<script>
  (function () {
    if (!/(^|\\.)ultraluxedesigns\\.com$/.test(location.hostname)) return;
    var g = document.createElement("script"); g.async = true;
    g.src = "https://www.googletagmanager.com/gtag/js?id=${GA_ID}";
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag("js", new Date()); gtag("config", "${GA_ID}");
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date(); k = e.createElement(t), a = e.getElementsByTagName(t)[0], k.async = 1, k.src = r, a.parentNode.insertBefore(k, a);
    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    ym(${YM_ID}, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  })();
</script>
<script src="${R}assets/js/analytics.js" defer></script>`;
}

function head(ctx, { title, description, image = OG_IMAGE, jsonld = "", robots = "index, follow, max-image-preview:large" }) {
  const url = SITE_URL + dirOf(ctx.lang) + ctx.page;
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE_URL + dirOf(l) + ctx.page}">`).join("\n");
  return `<!doctype html>
<html lang="${ctx.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${url}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${SITE_URL + ctx.page}">
<meta name="author" content="Iskandar Norkulov, Ultraluxe Designs">
<meta name="geo.region" content="UZ-TK">
<meta name="geo.placename" content="Tashkent, Uzbekistan">
<meta name="geo.position" content="41.2995;69.2401">
<meta name="ICBM" content="41.2995, 69.2401">
<meta name="format-detection" content="telephone=no, address=no, date=no, email=no">
<meta name="theme-color" content="#ffffff">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ultraluxe Designs">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(image)}">
${image === OG_IMAGE ? '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n' : ""}<meta property="og:locale" content="${LOCALE[ctx.lang]}">
${LANGS.filter((l) => l !== ctx.lang).map((l) => `<meta property="og:locale:alternate" content="${LOCALE[l]}">`).join("\n")}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="icon" href="${ctx.R}assets/favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${ctx.R}assets/css/style.css">
${jsonld}${analyticsHead(ctx.R)}
</head>`;
}

const header = (ctx, C, current) => {
  const t = C.t;
  const base = current === "home" ? "" : L(ctx) + "index.html";
  const langs = LANGS.map(
    (l) => `<a href="${langHref(ctx, l)}" hreflang="${l}" lang="${l}" data-lang="${l}"${l === ctx.lang ? ' aria-current="true"' : ""}>${l.toUpperCase()}</a>`
  ).join("");
  return `
<a class="skip" href="#main">${t.skip}</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${current === "home" ? "#top" : L(ctx) + "index.html"}" aria-label="${esc(t.homeAria)}">${LOGO}<span class="brand-name">Ultraluxe <span>Designs</span></span></a>
    <nav class="nav" aria-label="Main">
      <a href="${base}#work"${current === "work" ? ' aria-current="page"' : ""}>${t.navWork}</a>
      <a class="nav-hide-sm" href="${base}#services">${t.navServices}</a>
      <a class="nav-hide-sm" href="${base}#about">${t.navAbout}</a>
      <a class="nav-cta" href="${base}#contact">${t.navCta}</a>
      <span class="lang-switch" role="group" aria-label="${esc(t.langAria)}">${langs}</span>
    </nav>
  </div>
</header>`;
};

const contact = (ctx, C) => {
  const { t, site } = C;
  return `
<section class="contact accent" id="contact">
  <div class="wrap">
    <h2>${t.contactH2}</h2>
    <p class="ask">${esc(t.contactAsk)}</p>
    <div class="contact-actions">
      <a class="btn btn-solid" href="${site.telegram.url}">${t.btnTelegram}</a>
      <a class="btn btn-line" href="mailto:${site.email}">${t.btnEmail}</a>
    </div>
    <a class="mail" href="mailto:${site.email}">${site.email}</a>
    <div class="contact-grid">
      <div>
        <h3>Telegram</h3>
        <a href="${site.telegram.url}">${site.telegram.handle}</a>
      </div>
      <div>
        <h3>${t.basedIn}</h3>
        <p>${esc(site.location)}</p>
      </div>
      <div>
        <h3>${t.myCv}</h3>
        <a href="${L(ctx)}cv/">${t.readCv}</a>
      </div>
      <div>
        <h3>${t.elsewhere}</h3>
        <ul>${site.social.map(([n, u]) => `<li><a href="${u}">${n}</a></li>`).join("")}</ul>
      </div>
    </div>
    <footer class="site-footer">
      <span class="footer-brand">${LOGO}<span>© ${new Date().getFullYear()} Ultraluxe Designs</span></span>
      <span class="footer-links"><a href="${L(ctx)}cv/">${t.myCv}</a><a href="#top">${t.backTop}</a></span>
    </footer>
  </div>
</section>
<script src="${ctx.R}assets/js/main.js" defer></script>
</body>
</html>`;
};

const toTop = (t) =>
  `<button type="button" class="to-top" data-to-top aria-label="${esc(t.toTopAria)}" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
const imageAlt = (t, label, k, n) => `${label}, ${fill(t.imageOf, { i: k + 1, n })}`;

// Projects split into sections (Inter Nation volumes): a cover index, then the
// sections next to a sticky text rail that highlights the one being viewed.
function sectionsHTML(p, R, idPrefix, C) {
  const { t, lang } = C;
  const img = (src, d, alt, k) =>
    `<img src="${asset(src, R)}" width="${d[0]}" height="${d[1]}" alt="${esc(alt)}" ${k > 1 ? 'loading="lazy" ' : ""}decoding="async">`;
  const secs = p.sections.map((s) => ({ ...s, title: tSection(s.title, lang), date: tDate(s.date, lang) }));
  const index = secs
    .map(
      (s, i) => `<a href="#${idPrefix}${i + 1}" class="${s.hover ? "has-hover" : ""}">
        <img class="cover" src="${asset(s.cover, R)}" alt="" loading="lazy">${
          s.hover ? `<img class="cover-hover" src="${asset(s.hover, R)}" alt="" loading="lazy">` : ""
        }
        <span class="cover-label"><strong>${esc(s.title)}</strong><small>${esc(s.date)}</small></span>
      </a>`
    )
    .join("");
  const body = secs
    .map(
      (s, i) => `<section class="gallery-section" id="${idPrefix}${i + 1}" data-section="${i}">
        <header class="section-label"><h3>${esc(s.title)}</h3><span>${esc(s.date)}</span></header>
        ${s.images.map((src, k) => img(src, s.dims[k], imageAlt(t, `${p.title} ${s.title}`, k, s.images.length), k)).join("")}
      </section>`
    )
    .join("");
  const rail = secs.map((s, i) => `<li><a href="#${idPrefix}${i + 1}" data-rail="${i}">${esc(s.title)}</a></li>`).join("");
  return `<nav class="sections-index" aria-label="${esc(t.sectionsAria)}">${index}</nav>
    <div class="sections-body">
      <div class="sections-list">${body}</div>
      <nav class="section-rail" aria-label="${esc(t.railAria)}"><ol>${rail}</ol></nav>
    </div>`;
}

function writePage(lang, page, html) {
  const dir = path.join(ROOT, dirOf(lang), page);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}

// ---------------- Home ----------------
function homeJsonLd(C) {
  const s = baseSite.social.map((x) => x[1]).filter((u) => !/teepublic|goo\.gl/.test(u)).concat(baseSite.telegram.url);
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": SITE_URL + "#website", url: SITE_URL, name: "Ultraluxe Designs", inLanguage: LANGS },
      {
        "@type": "ProfessionalService", "@id": SITE_URL + "#business", name: "Ultraluxe Designs", url: SITE_URL,
        image: OG_IMAGE, logo: SITE_URL + "images/LogoThumbnail.jpg", description: C.site.description, email: baseSite.email,
        address: { "@type": "PostalAddress", addressLocality: "Tashkent", addressCountry: "UZ" },
        geo: { "@type": "GeoCoordinates", latitude: 41.2995, longitude: 69.2401 },
        areaServed: ["Uzbekistan", "Russia", "Austria", "Germany", "Switzerland", "United Kingdom", "Canada", "Thailand", "Cyprus", "Turkey", "Chile"].map((name) => ({ "@type": "Country", name })),
        knowsAbout: ["Logo design", "Brand identity", "Graphic design", "Social media design", "Packaging design", "Motion design", "3D visualisation"],
        founder: { "@id": SITE_URL + "#iskandar" }, sameAs: s,
      },
      {
        "@type": "Person", "@id": SITE_URL + "#iskandar", name: "Iskandar Norkulov", jobTitle: "Graphic & Brand Designer",
        worksFor: { "@id": SITE_URL + "#business" }, address: { "@type": "PostalAddress", addressLocality: "Tashkent", addressCountry: "UZ" },
        url: SITE_URL + "cv/", sameAs: s,
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>\n`;
}

function buildHome(lang) {
  const C = content(lang);
  const { t, cats, site } = C;
  const ctx = { lang, R: lang === "en" ? "" : "../", page: "" };
  const R = ctx.R;
  const groups = I18N.groups[lang];
  const count = (c) => projects.filter((p) => p.category === c).length;
  const startsGroup = (p, i) => i === 0 || projects[i - 1].category !== p.category;
  const cards = projects
    .map(
      (p, i) => `${startsGroup(p, i) ? `
      <div class="group-head" data-cat="${p.category}"><h3>${esc(groups[p.category])}</h3><span>${count(p.category)}</span></div>` : ""}
      <article class="card" data-cat="${p.category}">
        <a href="work/${p.slug}/" data-project="${p.slug}">
          <div class="media${p.hover ? " has-hover" : ""}">
            <img class="thumb" data-fade src="${asset(p.thumb, R)}" alt="${esc(p.title)}" loading="lazy" decoding="async">${
              p.hover ? `\n            <img class="thumb-hover" src="${asset(p.hover, R)}" alt="" loading="lazy" decoding="async">` : ""
            }
            <div class="caption"><h3>${esc(p.title)}</h3><span>${cats[p.category]}${p.year ? ", " + p.year : ""}</span></div>
          </div>
        </a>
      </article>`
    )
    .join("");
  const data = projects.map((p) => ({
    slug: p.slug, title: p.title, category: cats[p.category], date: tDate(p.date, lang), description: C.desc(p),
    tags: p.tags, links: p.links, images: p.images.map((i) => asset(i, R)), dims: p.dims,
    sectionsHtml: p.sections ? sectionsHTML(p, R, "viewer-section-", C) : undefined,
  }));
  const jsStrings = { date: t.date, links: t.links, imageOf: t.imageOf };

  const rows = projects
    .map(
      (p, i) => `${startsGroup(p, i) ? `
        <li class="group-head" data-cat="${p.category}"><h3>${esc(groups[p.category])}</h3><span>${count(p.category)}</span></li>` : ""}
        <li class="row" data-cat="${p.category}" data-thumb="${asset(p.thumb, R)}">
          <a href="work/${p.slug}/" data-project="${p.slug}"><span>${esc(p.title)}</span><span>${cats[p.category]}</span><span>${esc(p.tags.slice(0, 2).map((x) => "#" + x).join(" "))}</span><span>${p.year || "–"}</span></a>
        </li>`
    )
    .join("");

  const filters = ["all", ...Object.keys(cats)]
    .map((c, i) => `<button type="button" data-filter="${c}" aria-pressed="${i === 0}">${c === "all" ? t.all : cats[c]}</button>`)
    .join("");

  const mainServices = site.services
    .filter((s) => s[2] === "main")
    .map(([h, d]) => `<article class="service-card"><h3>${esc(h)}</h3><p>${esc(d)}</p></article>`)
    .join("");
  const moreServices = site.services
    .filter((s) => s[2] !== "main")
    .map(([h, d]) => `<li class="${h.startsWith("UI") ? "secondary" : ""}"><h3>${esc(h)}</h3><p>${esc(d)}</p></li>`)
    .join("");
  const featured = site.featured
    .map((f) => {
      const p = bySlug[f.slug];
      return `
        <article class="case">
          <a href="work/${p.slug}/" data-project="${p.slug}">
            <div class="case-media">
              <img src="${asset(f.image, R)}" alt="${esc(p.title)}" loading="lazy" decoding="async">
              <span class="pill">${cats[p.category]}</span>
              <span class="case-open">${t.viewProject}</span>
            </div>
            <div class="case-text"><h3>${esc(p.title)}</h3><span>${p.year || ""}</span><p>${esc(f.line)}</p></div>
          </a>
        </article>`;
    })
    .join("");

  const html = `${head(ctx, { title: t.homeTitle, description: site.description, jsonld: homeJsonLd(C) })}
<body id="top">
${header(ctx, C, "home")}
<main id="main">
  <section class="hero">
    <div class="hero-head" aria-hidden="true">
      <img class="head" src="${R}images/head.webp" alt="" width="820" height="1100" fetchpriority="high">
      <span class="hero-badge"><i></i>${t.badge}</span>
    </div>
    <div class="wrap">
      <h1 aria-label="${esc(site.heroPlain)}">${site.heroLines
        .map((l) => `<span class="reveal-line" aria-hidden="true"><span>${esc(l)}</span></span>`)
        .join("")}</h1>
      <div class="hero-foot">
        <p>${esc(site.intro)}</p>
        <div class="hero-actions">
          <a class="btn btn-solid" href="#contact"><span class="dot"></span>${t.navCta}</a>
          <a class="btn btn-line" href="#cases">${t.heroWork}</a>
        </div>
      </div>
    </div>
  </section>

  <nav class="marquee" aria-label="${esc(t.clientsAria)}">
    <div class="marquee-track">${[0, 1]
      .map(
        (k) => `<ul${k ? ' aria-hidden="true"' : ""}>${site.clients
          .map(([c, slug]) => `<li><a href="work/${slug}/" data-project="${slug}"${k ? ' tabindex="-1"' : ""}>${esc(c)}</a>${LOGO}</li>`)
          .join("")}</ul>`
      )
      .join("")}</div>
  </nav>

  <section class="section" id="cases">
    <div class="wrap">
      <div class="section-head">
        <h2>${t.casesH2}</h2>
        <p>${esc(t.casesP)}</p>
      </div>
      <div class="cases">${featured}</div>
    </div>
  </section>

  <section class="section mist works" id="work" data-view="grid">
    <div class="wrap">
      <div class="section-head">
        <h2>${t.allWork}<sup>${projects.length}</sup></h2>
        <p>${esc(t.allWorkP)}</p>
      </div>
      <div class="controls">
        <div class="filters" role="group" aria-label="${esc(t.filterAria)}">${filters}</div>
        <div class="views" role="group" aria-label="${esc(t.layoutAria)}">
          <button type="button" data-view-btn="grid" aria-pressed="true">${t.grid}</button>
          <button type="button" data-view-btn="index" aria-pressed="false">${t.list}</button>
        </div>
      </div>
      <div class="grid">${cards}
      </div>
      <div class="index">
        <div class="index-head" aria-hidden="true"><span>${t.colProject}</span><span>${t.colDiscipline}</span><span>${t.colNotes}</span><span style="text-align:right">${t.colYear}</span></div>
        <ul>${rows}
        </ul>
      </div>
    </div>
    <div class="preview" aria-hidden="true"><img alt=""></div>
  </section>

  <section class="section" id="services">
    <div class="wrap">
      <div class="section-head">
        <h2>${t.servicesH2}</h2>
        <p>${esc(t.servicesP)}</p>
      </div>
      <div class="services-main">${mainServices}</div>
      <ul class="services-more">${moreServices}</ul>
    </div>
  </section>

  <section class="section mist" id="process">
    <div class="wrap">
      <div class="section-head"><h2>${t.processH2}</h2></div>
      <ol class="process">${site.process.map(([h, d]) => `<li><h3>${esc(h)}</h3><p>${esc(d)}</p></li>`).join("")}</ol>
    </div>
  </section>

  <section class="section" id="about">
    <div class="wrap about-grid">
      <figure><img data-fade src="${asset("images/me.webp", R)}" alt="${esc(t.meAlt)}" loading="lazy"></figure>
      <div class="about-text">
        <p class="lead">${esc(site.about[0])}</p>
        <p>${esc(site.about[1])}</p>
        <a class="btn btn-line btn-sm about-cv" href="cv/">${t.readCv}</a>
        <dl class="facts">
          ${site.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}
        </dl>
      </div>
    </div>
  </section>
</main>
<div class="viewer" id="viewer" role="dialog" aria-modal="true" aria-labelledby="viewer-title" hidden>
  <div class="viewer-scroll" data-native-scroll>
    <div class="viewer-inner wrap">
      <aside class="viewer-info">
        <button type="button" class="viewer-close" data-close>${t.close}</button>
        <p class="viewer-cat"></p>
        <h2 id="viewer-title"></h2>
        <p class="viewer-desc"></p>
        <ul class="viewer-tags" aria-label="${esc(t.tagsAria)}"></ul>
        <dl class="viewer-meta"></dl>
        <nav class="viewer-nav" aria-label="${esc(t.projectsAria)}">
          <button type="button" data-step="-1">${t.prev}</button>
          <button type="button" data-step="1">${t.next}</button>
        </nav>
      </aside>
      <div class="viewer-images"></div>
    </div>
  </div>
  ${toTop(t)}
</div>
<script type="application/json" id="projects-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
<script type="application/json" id="i18n">${JSON.stringify(jsStrings).replace(/</g, "\\u003c")}</script>
${contact(ctx, C)}`;
  writePage(lang, "", html);
}

// ---------------- Project pages ----------------
function buildProjects(lang) {
  const C = content(lang);
  const { t, cats } = C;
  projects.forEach((p, i) => {
    const ctx = { lang, R: lang === "en" ? "../../" : "../../../", page: `work/${p.slug}/` };
    const R = ctx.R;
    const next = projects[(i + 1) % projects.length];
    const date = tDate(p.date, lang);
    const description = C.desc(p);
    const metaRows = [[t.discipline, cats[p.category]], date ? [t.date, date] : null].filter(Boolean);
    const tagList = p.tags.length ? `<ul class="tags">${p.tags.map((x) => `<li>#${esc(x)}</li>`).join("")}</ul>` : "";
    const links = p.links.length
      ? `<dt>${t.links}</dt><dd>${p.links.map(([n, u]) => `<a href="${u}">${esc(n)}</a>`).join(", ")}</dd>`
      : "";
    const imgs = (list, dims, label) =>
      list
        .map(
          (src, k) =>
            `<img src="${asset(src, R)}" width="${dims[k][0]}" height="${dims[k][1]}" alt="${esc(imageAlt(t, label, k, list.length))}" ${k > 1 ? 'loading="lazy" ' : ""}decoding="async">`
        )
        .join("\n      ");
    const gallery = p.sections ? sectionsHTML(p, R, "section-", C) : imgs(p.images, p.dims, p.title);

    const html = `${head(ctx, {
      title: `${p.title}, ${cats[p.category]} | Ultraluxe Designs`,
      description: description || `${p.title}: ${cats[p.category]} ${t.byline}.`,
      image: asset(p.thumb, REMOTE),
    })}
<body id="top">
${header(ctx, C, "work")}
<main id="main">
  <section class="project-hero">
    <div class="wrap">
      <a class="back" href="${L(ctx)}index.html#work">${t.allWork}</a>
      <h1>${esc(p.title)}</h1>
      <div class="project-meta">
        <dl>${metaRows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}${links}</dl>
        <div class="summary-wrap">${description ? `<p class="summary">${esc(description)}</p>` : ""}${tagList}</div>
      </div>
    </div>
  </section>
  <section class="gallery-wrap">
    <div class="wrap gallery">
      ${gallery}
    </div>
  </section>
  <a class="next mist" href="${L(ctx)}work/${next.slug}/">
    <div class="wrap"><small>${t.nextProject}</small><strong>${esc(next.title)}</strong></div>
  </a>
</main>
${toTop(t)}
${contact(ctx, C)}`;
    writePage(lang, ctx.page, html);
  });
}

// ---------------- CV ----------------
function buildCV(lang) {
  const C = content(lang);
  const { t, cv, site } = C;
  const ctx = { lang, R: lang === "en" ? "../" : "../../", page: "cv/" };
  const work = (slug, label) => `<a href="${L(ctx)}work/${slug}/">${esc(label)}</a>`;
  const jobs = cv.jobs
    .map(
      (j) => `
        <li class="cv-row">
          <p class="cv-when">${esc(j.period)}</p>
          <div class="cv-what">
            <h3>${esc(j.company)}</h3>
            <p class="cv-role">${esc(j.role)}</p>
            <p class="cv-tags">${esc(j.tags)}</p>
            <ul class="cv-points">${j.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
            ${j.links.length ? `<p class="cv-links">${t.seeWork} ${j.links.map(([l, s]) => work(s, l)).join(", ")}</p>` : ""}
          </div>
        </li>`
    )
    .join("");
  const simple = (rows) =>
    rows
      .map(
        ([h, when, d, slug]) => `
        <li class="cv-row">
          <p class="cv-when">${esc(when)}</p>
          <div class="cv-what"><h3>${esc(h)}</h3><p class="cv-role">${esc(d)}</p>${slug ? `<p class="cv-links">${work(slug, t.seeLogo)}</p>` : ""}</div>
        </li>`
      )
      .join("");
  const html = `${head(ctx, {
    title: `${cv.name}, ${t.cvTitle} | Ultraluxe Designs`,
    description: fill(t.cvDesc, { name: cv.name, role: cv.role.toLowerCase() }),
  })}
<body id="top" class="cv-page">
${header(ctx, C, "cv")}
<main id="main">
  <section class="cv-hero">
    <div class="wrap">
      <a class="back" href="${L(ctx)}index.html#about">${t.home}</a>
      <h1>${esc(cv.name)}</h1>
      <p class="cv-sub">${esc(cv.role)}, ${t.city}</p>
      <div class="cv-actions">
        <a class="btn btn-solid" href="mailto:${site.email}"><span class="dot"></span>${site.email}</a>
        <a class="btn btn-line" href="${site.telegram.url}">Telegram ${site.telegram.handle}</a>
        <button class="btn btn-line" type="button" data-print>${t.savePdf}</button>
      </div>
    </div>
  </section>

  <section class="cv-block">
    <div class="wrap cv-grid">
      <h2>${t.cvAbout}</h2>
      <div class="cv-body">
        ${cv.bio.map((x, i) => `<p class="${i ? "" : "cv-lead"}">${esc(x)}</p>`).join("")}
        <dl class="cv-stats">
          ${cv.expertise.map(([h, since]) => `<div><dt>${esc(h)}</dt><dd><strong data-years-since="${since}"></strong> ${t.years}</dd></div>`).join("")}
          <div><dt>${t.clientsFrom}</dt><dd><strong>11</strong> ${t.countries}</dd></div>
        </dl>
      </div>
    </div>
  </section>

  <section class="cv-block">
    <div class="wrap cv-grid">
      <h2>${t.experience}</h2>
      <ol class="cv-list">${jobs}</ol>
    </div>
  </section>

  <section class="cv-block">
    <div class="wrap cv-grid">
      <h2>${t.awards}</h2>
      <ol class="cv-list">${simple(cv.awards)}</ol>
    </div>
  </section>

  <section class="cv-block">
    <div class="wrap cv-grid">
      <h2>${t.education}</h2>
      <ol class="cv-list">${simple(cv.education)}</ol>
    </div>
  </section>

  <section class="cv-block">
    <div class="wrap cv-grid">
      <h2>${t.languages}</h2>
      <ul class="cv-langs">${cv.languages.map(([l, v]) => `<li><strong>${esc(l)}</strong><span>${esc(v)}</span></li>`).join("")}</ul>
    </div>
  </section>
</main>
${contact(ctx, C)}`;
  writePage(lang, ctx.page, html);
}

// ---------------- 404 ----------------
// GitHub Pages serves this file for any missing URL, at any depth, so asset
// paths are resolved at runtime from the site root (works on a project page
// URL like /ultraluxedesigns-portfolio/ and on a custom domain).
function build404() {
  const C = content("en");
  const ctx = { lang: "en", R: "", page: "" };
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found | Ultraluxe Designs</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#ffffff">
<script>
  (function () {
    var repo = "/ultraluxedesigns-portfolio/";
    var base = location.pathname.indexOf(repo) === 0 ? repo : "/";
    document.write('<base href="' + base + '">');
  })();
</script>
<link rel="icon" href="assets/favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">
${analyticsHead("")}
</head>
<body id="top" class="page-404">
${header(ctx, C, "404")}
<main id="main" class="nf">
  <div class="hero-head" aria-hidden="true">
    <img class="head" src="images/head.webp" alt="" width="820" height="1100">
  </div>
  <div class="wrap nf-inner">
    <p class="nf-code">404</p>
    <h1>This page doesn't exist.</h1>
    <p class="nf-text">The link may be old or mistyped. Everything I've made is on the home page.</p>
    <a class="btn btn-solid" href="index.html#work">See all work</a>
  </div>
</main>
${contact(ctx, C)}`;
  fs.writeFileSync(path.join(ROOT, "404.html"), html);
}

// ---------------- sitemap ----------------
function buildSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const pages = [["", "1.0"], ["cv/", "0.7"], ...projects.map((p) => [`work/${p.slug}/`, "0.6"])];
  const urls = pages
    .flatMap(([page, pr]) =>
      LANGS.map(
        (l) => `  <url><loc>${SITE_URL + dirOf(l) + page}</loc><lastmod>${today}</lastmod><priority>${pr}</priority>${LANGS.map(
          (x) => `<xhtml:link rel="alternate" hreflang="${x}" href="${SITE_URL + dirOf(x) + page}"/>`
        ).join("")}</url>`
      )
    )
    .join("\n");
  fs.writeFileSync(
    path.join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`
  );
  fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);
}

// ---------------- redirects from the previous site's URLs ----------------
// Old pages (e.g. /designs/mverse, /3d/drone, /about) forward to their new
// addresses so links from Google, Behance and social media keep working.
function buildRedirects() {
  const map = read("data/redirects.json");
  for (const [from, to] of Object.entries(map)) {
    const up = "../".repeat(from.split("/").length - 1);
    const target = up + to;
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Ultraluxe Designs</title>
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${SITE_URL + to.split("#")[0].replace(/index\.html/, "")}">
<meta http-equiv="refresh" content="0; url=${target}">
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body><p><a href="${target}">Ultraluxe Designs</a></p></body>
</html>
`;
    fs.mkdirSync(path.join(ROOT, path.dirname(from)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, from), html);
  }
}

for (const l of LANGS) {
  fs.rmSync(path.join(ROOT, dirOf(l), "work"), { recursive: true, force: true });
  buildHome(l);
  buildProjects(l);
  buildCV(l);
}
build404();
buildSitemap();
buildRedirects();
console.log(`Built ${LANGS.length} languages × (home, CV, ${projects.length} project pages).`);
