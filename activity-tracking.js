// === CONFIGURATION ===
var defaultConfig = {
  userIdExpirationTime: 13 * 30 * 24 * 60 * 60 * 1000, // 13 months
  visitIdExpirationTime: 30 * 60 * 1000, // 30 minutes
  exclusionList: ["paypal.com", "3dsecure", "wlp-acs", "-3ds-", ".3ds.", "visa.com"],
  cookieName: "uv_ids",
  visitEngagementDelay: 10000, // 10 seconds
  sourceParams: ["utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_term", "utm_content"]
};

window.initActivityTracking = function(userConfig) {
  var config = Object.assign({}, defaultConfig, userConfig);

  // === UTILS ===
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function isExpired(item, duration) {
    return item === null || item.expirationDate < Date.now();
  }

  function setCookie(name, value, expiresTimestamp) {
    var expires = "";
    if (expiresTimestamp) {
      var date = new Date(expiresTimestamp);
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/";
  }

  function getFromStorage(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function setInStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function isInternalReferrer(referrer) {
    try { return new URL(referrer).hostname === window.location.hostname; } catch (e) { return true; }
  }

  function isExcludedReferrer(referrer) {
    try {
      var host = new URL(referrer).hostname;
      return config.exclusionList.some(function (ex) { return host.indexOf(ex) !== -1; });
    } catch (e) {
      return false;
    }
  }

  function sourcesAreDifferent(a, b) {
    if (!a || !b) return true;
    for (var key in a) {
      if (a[key] !== b[key]) return true;
    }
    for (var key in b) {
      if (a[key] !== b[key]) return true;
    }
    return false;
  }

  function isValidNewSource(source) {
    if (!source) return false;
    var hasRecognizedParam = config.sourceParams.some(function (key) {
      return source[key];
    });
    return hasRecognizedParam || !!source.referrer;
  }

  function buildSource() {
    var source = {};
    var ref = document.referrer;
    if (!isInternalReferrer(ref) && !isExcludedReferrer(ref)) {
      source.referrer = ref;
    }
    var params = new URLSearchParams(window.location.search);
    config.sourceParams.forEach(function (key) {
      var val = params.get(key);
      if (val) source[key] = val;
    });
    return source;
  }

  function detectDeviceType() {
    var ua = navigator.userAgent;
    var isTablet = /Tablet|iPad|Nexus 7|Nexus 10|SM-T|GT-P|Kindle|Silk/i.test(ua);
    var isMobile = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) && !isTablet;
    if (isTablet) return "tablet";
    if (isMobile) return "mobile";
    return "desktop";
  }

  // === MAIN ===
  window.dataLayer = window.dataLayer || [];
  var now = Date.now();
  var landingPage = window.location.href;
  var currentSource = buildSource();
  var deviceType = detectDeviceType();
  var currentUserId = getFromStorage("userActivity");

  var isNewUser = false, isNewVisit = false, isNewSource = false;
  var previousSource = currentUserId && currentUserId.visit && currentUserId.visit.source
    ? JSON.parse(JSON.stringify(currentUserId.visit.source))
    : null;

  if (isExpired(currentUserId, config.userIdExpirationTime)) {
    isNewUser = isNewVisit = true;
    currentUserId = {
      id: generateUUID(),
      expirationDate: now + config.userIdExpirationTime,
      lastActivity: now,
      landingPage: landingPage,
      source: currentSource,
      visit: {
        id: generateUUID(),
        expirationDate: now + config.visitIdExpirationTime,
        landingPage: landingPage,
        source: currentSource,
        count: 1,
        isEngaged: false
      }
    };
  } else {
    if (isExpired(currentUserId.visit, config.visitIdExpirationTime)) {
      isNewVisit = true;
      currentUserId.visit = {
        id: generateUUID(),
        expirationDate: now + config.visitIdExpirationTime,
        landingPage: landingPage,
        source: currentSource,
        count: (currentUserId.visit && currentUserId.visit.count || 0) + 1,
        isEngaged: false
      };
    } else {
      if (isValidNewSource(currentSource) && sourcesAreDifferent(previousSource, currentSource)) {
        isNewSource = true;
        currentUserId.visit.source = currentSource;
      }
      currentUserId.lastActivity = now;
      currentUserId.visit.expirationDate = now + config.visitIdExpirationTime;
    }
  }

  setInStorage("userActivity", currentUserId);
  setCookie(config.cookieName, JSON.stringify({
    userId: currentUserId.id,
    visitId: currentUserId.visit.id
  }), currentUserId.expirationDate);

  // === DATALAYER EVENTS ===
  window.dataLayer.push({
    event: "page_load",
    userActivity: JSON.parse(JSON.stringify(currentUserId)),
    deviceType: deviceType
  });

  if (isNewUser) {
    window.dataLayer.push({ event: "first_visit" });
  }
  if (isNewVisit) {
    window.dataLayer.push({ event: "visit_start" });

    // visit_engaged timer
    setTimeout(function () {
      var updated = getFromStorage("userActivity");
      if (updated && updated.visit && updated.visit.id === currentUserId.visit.id) {
        updated.visit.isEngaged = true;
        setInStorage("userActivity", updated);
        window.dataLayer.push({
          event: "visit_engaged",
          visit: { isEngaged: true }
        });
      }
    }, config.visitEngagementDelay);
  }
  if (isNewSource && !isNewVisit) {
    window.dataLayer.push({ event: "new_visit_source" });
  }
};