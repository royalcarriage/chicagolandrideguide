/**
 * AdSense loader — no-ops until AF_CONFIG.ADS_ENABLED && ADSENSE_CLIENT are set.
 */
(function () {
  var cfg = window.AF_CONFIG || {};
  if (!cfg.ADS_ENABLED || !cfg.ADSENSE_CLIENT) {
    document.documentElement.setAttribute("data-ads", "off");
    return;
  }

  document.documentElement.setAttribute("data-ads", "on");

  // Load AdSense script once
  if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
    var s = document.createElement("script");
    s.async = true;
    s.src =
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
      encodeURIComponent(cfg.ADSENSE_CLIENT);
    s.crossOrigin = "anonymous";
    document.head.appendChild(s);
  }

  function fill(el) {
    if (!el || el.getAttribute("data-ads-filled")) return;
    var slot = el.getAttribute("data-ad-slot") || "";
    el.className = (el.className || "") + " adsbygoogle";
    el.setAttribute("style", el.getAttribute("style") || "display:block");
    el.setAttribute("data-ad-client", cfg.ADSENSE_CLIENT);
    if (slot) el.setAttribute("data-ad-slot", slot);
    el.setAttribute("data-ad-format", el.getAttribute("data-ad-format") || "auto");
    el.setAttribute("data-full-width-responsive", "true");
    el.setAttribute("data-ads-filled", "1");
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}
  }

  function init() {
    document.querySelectorAll(".af-ad[data-ad-slot], .af-ad-auto").forEach(fill);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
