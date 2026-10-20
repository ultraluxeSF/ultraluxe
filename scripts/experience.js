// Years of experience stay current automatically
document.querySelectorAll('[data-years-since]').forEach(function (el) {
  var since = new Date(el.getAttribute('data-years-since'));
  el.textContent = Math.floor((Date.now() - since) / (365.25 * 24 * 3600 * 1000));
});
