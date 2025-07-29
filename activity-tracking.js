window.ActivityTracking = {};

const defaultConfig = {
  userIdExpirationTime: 13 * 30 * 24 * 60 * 60 * 1000,
  visitIdExpirationTime: 30 * 60 * 1000,
  exclusionList: ["paypal.com", "3dsecure", "wlp-acs", "-3ds-", ".3ds.", "visa.com"],
  cookieName: "uv_ids",
  visitEngagementDelay: 10000,
  sourceParams: ["utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_term", "utm_content"],
  trackSpaPages: true,
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
        source: currentSource,
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
        source: currentSource,
        count: (currentUserId.visit?.count || 0) + 1,
        isEngaged: false
      };
    } else {
      if (isValidNewSource(currentSource) && sourcesAreDifferent(previousSource, currentSource)) {
        isNewSource = true;
        currentUserId.visit.source = currentSource;
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
      sendEventToConnectors({
        event: "visit_start",
        userActivity: currentUserId
      });

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