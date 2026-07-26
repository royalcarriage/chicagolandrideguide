/**
 * Chicagoland Ride Guide site config.
 * (Global name AF_CONFIG kept so the shared ads.js loader works unmodified.)
 */
window.AF_CONFIG = {
  siteUrl: "https://chicagolandrideguide.com",
  basePath: "",

  /** Google AdSense — same publisher account as other properties. */
  ADSENSE_CLIENT: "ca-pub-1959018852581373",
  ADS_ENABLED: true,
  ADS_SLOTS: {
    displayTop: "",
    displayInArticle: "",
    displaySidebar: "",
  },

  /** Referral partner (disclosed sitewide + /legal/affiliate-disclosure/). */
  REFERRAL: {
    operator: "Royal Carriage Limousine",
    phone: "(224) 801-3090",
    tel: "tel:+12248013090",
    book: "https://royalcarriagelimo.com/book-now/?utm_source=chicagolandrideguide&utm_medium=referral",
  },
};
