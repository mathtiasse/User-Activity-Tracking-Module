window.ActivityTracking = {};

const defaultConfig = {
  userIdExpirationTime: 13 * 30 * 24 * 60 * 60 * 1000,
  visitIdExpirationTime: 30 * 60 * 1000,
  exclusionList: ["paypal.com", "3dsecure", "wlp-acs", "-3ds-", ".3ds.", "visa.com"],
  cookieName: "uv_ids",
  visitEngagementDelay: 10000,
  sourceParams: ["utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_term", "utm_content"],
  trackSpaPages: true,
  trackWebVitals: true,
  enableErrorTracking: true,
  detectAdblock: true,
  scrollTrackingThresholds: [10, 25, 50, 75, 100],
  autoTagging: true,
  connectors: ["gtm"]
};

const builtinConnectors = {
  gtm: function(event) {
    if (!Array.isArray(window.dataLayer)) window.dataLayer = [];
    window.dataLayer.push(event);
  },
  gtag: function(event) {
    if (typeof window.gtag === "function") {
      window.gtag("event", event.event, event);
    }
  },
  console: function(event) {
    console.log("Event:", event);
  }
};

window.ActivityTracking.init = function(userConfig) {
  const config = Object.assign({}, defaultConfig, userConfig);
  window.ActivityTracking.config = config;

  const now = Date.now();
  const landingPage = location.href;
  const currentSource = buildSource();
  const deviceType = detectDeviceType();
  let currentUserId = getFromStorage("userActivity");

  let isNewUser = false,
    isNewVisit = false,
    isNewSource = false;
  const previousSource = currentUserId?.visit?.source ?
    JSON.parse(JSON.stringify(currentUserId.visit.source)) :
    null;

  if (isExpired(currentUserId, config.userIdExpirationTime)) {
    isNewUser = isNewVisit = true;
    currentUserId = {
      id: generateUUID(),
      expirationDate: now + config.userIdExpirationTime,
      lastActivity: now,
      landingPage,
      source: currentSource,
      customData: {},
      visit: {
        id: generateUUID(),
        expirationDate: now + config.visitIdExpirationTime,
        landingPage,
        source: JSON.parse(JSON.stringify(currentSource)),
        count: 1,
        isEngaged: false
      }
    };
  } else {
    if (isExpired(currentUserId.visit, config.visitIdExpirationTime)) {
      isNewVisit = true;
      currentUserId.customData = currentUserId.customData || {};
      currentUserId.visit = {
        id: generateUUID(),
        expirationDate: now + config.visitIdExpirationTime,
        landingPage,
        source: JSON.parse(JSON.stringify(currentSource)),
        count: (currentUserId.visit?.count || 0) + 1,
        isEngaged: false
      };
    } else {
      if (isValidNewSource(currentSource) && sourcesAreDifferent(previousSource, currentSource)) {
        isNewSource = true;
        currentUserId.visit.source = JSON.parse(JSON.stringify(currentSource));
      }
      currentUserId.lastActivity = now;
      currentUserId.visit.expirationDate = now + config.visitIdExpirationTime;
      currentUserId.customData = currentUserId.customData || {};
    }
  }

  setInStorage("userActivity", currentUserId);
  setCookie(config.cookieName, JSON.stringify({
    userId: currentUserId.id,
    visitId: currentUserId.visit.id
  }), currentUserId.expirationDate);

  if (config.autoTagging) {
    sendEventToConnectors({
      event: "page_load",
      userActivity: JSON.parse(JSON.stringify(currentUserId)),
      deviceType: deviceType
    });

    if (isNewUser) {
      sendEventToConnectors({
        event: "first_visit",
        userActivity: currentUserId
      });
    }

    if (isNewVisit) {
      const visitStartPayload = {
        event: "visit_start",
        userActivity: JSON.parse(JSON.stringify(currentUserId))
      };

      if (config.detectAdblock) {
        visitStartPayload.is_adblock = detectAdblock();
      }

      sendEventToConnectors(visitStartPayload);

      setTimeout(() => {
        const updated = getFromStorage("userActivity");
        if (updated?.visit?.id === currentUserId.visit.id) {
          updated.visit.isEngaged = true;
          setInStorage("userActivity", updated);

          if (config.autoTagging) {
            sendEventToConnectors({
              event: "visit_engaged",
              userActivity: updated,
              visit: {
                isEngaged: true
              }
            });
          }
        }
      }, config.visitEngagementDelay);
    }

    if (isNewSource && !isNewVisit) {
      sendEventToConnectors({
        event: "new_visit_source",
        userActivity: currentUserId
      });
    }
    if (Array.isArray(config.scrollTrackingThresholds) && config.scrollTrackingThresholds.length > 0) {
      setupScrollTracking(config.scrollTrackingThresholds);
    }
    if (config.trackWebVitals) {
      trackWebVitals();
    }
    if (config.enableErrorTracking) {
      setupErrorTracking();
    }
  };

  // === SPA NAVIGATION OBSERVER ===
  if (config.trackSpaPages) {
    let lastPath = location.pathname + location.search;

    const observeSpaNavigation = () => {
      const newPath = location.pathname + location.search;
      if (newPath !== lastPath) {
        lastPath = newPath;
        // 🔧 utiliser la config stockée globalement
        trackPageView(window.ActivityTracking.config);
      }
    };

    const originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(this, arguments);
      observeSpaNavigation();
    };

    window.addEventListener("popstate", observeSpaNavigation);
  }

  // === UTILITY FUNCTIONS ===

  function sendEventToConnectors(event) {
    const cfg = window.ActivityTracking?.config || {};
    const connectors = Array.isArray(cfg.connectors) ? cfg.connectors : [];

    connectors.forEach(connector => {
      const connectorFn =
        typeof connector === "function" ?
        connector :
        builtinConnectors[connector];

      if (typeof connectorFn === "function") {
        try {
          connectorFn(event);
        } catch (e) {
          console.warn("Connector failed:", connector, e);
        }
      }
    });
  };

  function trackPageView(config) {
    const now = Date.now();
    const landingPage = location.href;
    const currentUserId = JSON.parse(localStorage.getItem("userActivity") || "null");
    const deviceType = detectDeviceType();

    if (!currentUserId || !currentUserId.visit) return;

    currentUserId.lastActivity = now;
    currentUserId.visit.expirationDate = now + config.visitIdExpirationTime;

    localStorage.setItem("userActivity", JSON.stringify(currentUserId));
    document.cookie = config.cookieName + "=" + encodeURIComponent(JSON.stringify({
      userId: currentUserId.id,
      visitId: currentUserId.visit.id
    })) + "; path=/";

    sendEventToConnectors({
      event: "page_load",
      userActivity: JSON.parse(JSON.stringify(currentUserId)),
      deviceType: deviceType
    });
  }

  function detectDeviceType() {
    const ua = navigator.userAgent;
    const isTablet = /Tablet|iPad|Nexus 7|Nexus 10|SM-T|GT-P|Kindle|Silk/i.test(ua);
    const isMobile = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) && !isTablet;
    if (isTablet) return "tablet";
    if (isMobile) return "mobile";
    return "desktop";
  }

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0,
        v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function isExpired(item, duration) {
    return item === null || item.expirationDate < Date.now();
  }

  function getFromStorage(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  }

  function setInStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function setCookie(name, value, expiresTimestamp) {
    var expires = "";
    if (expiresTimestamp) {
      var date = new Date(expiresTimestamp);
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/";
  }

  function detectAdblock() {
    try {
      const bait = document.createElement("div");
      bait.innerHTML = "&nbsp;";
      bait.className = "pub_300x250 pub_728x90 text-ad textAd text_ad text_ads ad-banner adsbox ad-slot";
      bait.style.cssText = "width:1px!important;height:1px!important;position:absolute!important;left:-9999px!important;top:-9999px!important;";

      document.body.appendChild(bait);

      const isBlocked =
        bait.offsetHeight === 0 ||
        bait.clientHeight === 0 ||
        bait.offsetParent === null;

      if (!isBlocked && window.getComputedStyle) {
        const style = getComputedStyle(bait);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        ) {
          document.body.removeChild(bait);
          return true;
        }
      }

      document.body.removeChild(bait);
      return isBlocked;
    } catch (e) {
      return false;
    }
  }

  function setupErrorTracking() {
    const sentErrors = new Set();

    function hashError(data) {
      return [
        data.message,
        data.source || "",
        data.stack || "",
        data.lineno || "",
        data.colno || "",
        data.type
      ].join("||");
    }

    function trackError(data) {
      const hash = hashError(data);
      if (sentErrors.has(hash)) return;
      sentErrors.add(hash);

      window.ActivityTracking.sendEvent("js_error", {
        error: data
      });
    }

    window.addEventListener("error", function(event) {
      const errorData = {
        message: event.message || null,
        source: event.filename || null,
        lineno: event.lineno || null,
        colno: event.colno || null,
        stack: event.error?.stack || null,
        type: "js_error"
      };
      trackError(errorData);
    });

    window.addEventListener("unhandledrejection", function(event) {
      const reason = event.reason || {};
      const errorData = {
        message: reason.message || reason.toString() || null,
        stack: reason.stack || null,
        type: "promise_rejection"
      };
      trackError(errorData);
    });
  }

  function setupScrollTracking(thresholds) {
    const firedThresholds = {};
    thresholds.forEach(p => {
      firedThresholds[p] = false;
    });

    function onScroll() {
      const scrollTop = window.scrollY || window.pageYOffset;
      const windowHeight = window.innerHeight;
      const fullHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.body.clientHeight,
        document.documentElement.clientHeight
      );

      const scrollPercent = Math.min(100, Math.round((scrollTop + windowHeight) / fullHeight * 100));

      thresholds.forEach(percent => {
        if (!firedThresholds[percent] && scrollPercent >= percent) {
          firedThresholds[percent] = true;
          window.ActivityTracking.sendEvent("scroll_depth", {
            scroll_percent: percent
          });
        }
      });
    }

    window.addEventListener("scroll", throttle(onScroll, 200));
  }

  function throttle(fn, wait) {
    let last = 0;
    return function(...args) {
      const now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(this, args);
      }
    };
  }

  function trackWebVitals() {
    const vitalsStore = {
      LCP: null,
      CLS: null,
      INP: null
    };

    let sent = false;

    const sendSummary = () => {
      if (sent) return;
      sent = true;

      const hasData = Object.values(vitalsStore).some(v => v !== null);
      if (!hasData) return;

      const summary = {
        lcp: {
          value: vitalsStore.LCP,
          rating: vitalsStore.LCP_rating
        },
        cls: {
          value: vitalsStore.CLS,
          rating: vitalsStore.CLS_rating
        },
        inp: {
          value: vitalsStore.INP,
          rating: vitalsStore.INP_rating
        }
      };

      window.ActivityTracking.sendEvent("web_vitals_summary", summary);
    };

    const loadWebVitals = () => {
      if (window.webVitals) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    const startTracking = () => {
      const {
        getCLS,
        getLCP,
        getINP
      } = window.webVitals;

      getLCP((metric) => {
        vitalsStore.LCP = Math.round(metric.value);
        vitalsStore.LCP_rating = metric.rating;
      });

      getCLS((metric) => {
        vitalsStore.CLS = Math.round(metric.value * 1000) / 1000;
        vitalsStore.CLS_rating = metric.rating;
      }, {
        reportAllChanges: true
      });

      getINP((metric) => {
        vitalsStore.INP = Math.round(metric.value);
        vitalsStore.INP_rating = metric.rating;
      }, {
        reportAllChanges: true
      });

      // Send once after 10s
      setTimeout(sendSummary, 10000);

      // Or on page unload (safeguard)
      window.addEventListener("beforeunload", sendSummary);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") sendSummary();
      });
    };

    if (document.readyState === "complete" || document.readyState === "interactive") {
      loadWebVitals().then(startTracking);
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        loadWebVitals().then(startTracking);
      });
    }
  }

  function buildSource() {
    var source = {};
    var ref = document.referrer;
    if (!isInternalReferrer(ref) && !isExcludedReferrer(ref)) source.referrer = ref;
    var params = new URLSearchParams(window.location.search);
    config.sourceParams.forEach(function(key) {
      var val = params.get(key);
      if (val) source[key] = val;
    });
    return source;
  }

  function isInternalReferrer(ref) {
    try {
      return new URL(ref).hostname === window.location.hostname;
    } catch (e) {
      return true;
    }
  }

  function isExcludedReferrer(ref) {
    try {
      var host = new URL(ref).hostname;
      return config.exclusionList.some(function(ex) {
        return host.indexOf(ex) !== -1;
      });
    } catch (e) {
      return false;
    }
  }

  function sourcesAreDifferent(a, b) {
    if (!a || !b) return true;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (a[key] !== b[key]) return true;
    }
    return false;
  }

  function isValidNewSource(source) {
    if (!source) return false;
    return config.sourceParams.some(k => !!source[k]) || !!source.referrer;
  }

  window.ActivityTracking.getUserId = function() {
    const data = getFromStorage("userActivity");
    return data?.id || null;
  };

  window.ActivityTracking.getVisitId = function() {
    const data = getFromStorage("userActivity");
    return data?.visit?.id || null;
  };

  window.ActivityTracking.getCustomData = function() {
    const data = getFromStorage("userActivity");
    return data?.customData || {};
  };

  window.ActivityTracking.setCustomData = function(key, value) {
    if (!key) return;
    const data = getFromStorage("userActivity") || {};
    data.customData = data.customData || {};
    data.customData[key] = value;
    setInStorage("userActivity", data);
  };

  window.ActivityTracking.deleteCustomData = function(key) {
    const data = getFromStorage("userActivity");
    if (data?.customData?.hasOwnProperty(key)) {
      delete data.customData[key];
      setInStorage("userActivity", data);
    }
  };

  window.ActivityTracking.getAllData = function() {
    return getFromStorage("userActivity") || null;
  };

  window.ActivityTracking.sendPage = function(extraData = {}) {
    const currentUserId = getFromStorage("userActivity");
    if (!currentUserId || !currentUserId.visit) return;

    const baseEvent = {
      event: "page_load",
      userActivity: JSON.parse(JSON.stringify(currentUserId)),
      deviceType: detectDeviceType()
    };

    sendEventToConnectors(Object.assign({}, baseEvent, extraData));
  };

  window.ActivityTracking.sendEvent = function(eventName, extraData = {}) {
    const currentUserId = getFromStorage("userActivity");
    if (!currentUserId || !currentUserId.visit) return;

    const baseEvent = {
      event: eventName,
      userActivity: JSON.parse(JSON.stringify(currentUserId)),
      deviceType: detectDeviceType()
    };

    sendEventToConnectors(Object.assign({}, baseEvent, extraData));
  };

  window.ActivityTracking.addActivityData = function(type, data) {
    if (!["user", "visit"].includes(type) || typeof data !== "object") return;

    const store = getFromStorage("userActivity") || {};
    if (type === "user") {
      Object.assign(store, data);
    } else if (type === "visit") {
      store.visit = store.visit || {};
      Object.assign(store.visit, data);
    }
    setInStorage("userActivity", store);
  };

  window.ActivityTracking.deleteActivityData = function(type, key) {
    if (!["user", "visit"].includes(type) || !key) return;

    const store = getFromStorage("userActivity") || {};
    if (type === "user" && store.hasOwnProperty(key)) {
      delete store[key];
    } else if (type === "visit" && store.visit && store.visit.hasOwnProperty(key)) {
      delete store.visit[key];
    }
    setInStorage("userActivity", store);
  };

};