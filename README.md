# 📊 Activity Tracking Module

A lightweight JavaScript module for tracking user and session activity in client-side applications, with support for:

- Unique user & session identifiers (stored in `localStorage` and cookies)
- Session timeout and engagement measurement
- UTM and referrer-based source tracking
- SPA navigation tracking
- Automatic tagging (`autoTagging`) of all standard events
- Custom metadata (`customData`)
- Flexible event dispatching via pluggable **connectors**
- Device type detection
- Public API for manual event dispatching and data extension

---

## 🚀 Installation

Include the script and initialize:

```html
<script src="/path/to/activity-tracking.js"></script>
<script>
  ActivityTracking.init({
    autoTagging: true,
    connectors: ["gtm"],
    sourceParams: ["utm_source", "utm_medium", "utm_campaign", "gclid"],
    exclusionList: ["paypal.com", "3dsecure"]
  });
</script>
```

---

## ⚙️ Configuration Options

| Option                  | Type       | Default                                               | Description |
|--------------------------|------------|--------------------------------------------------------|-------------|
| `userIdExpirationTime`   | number     | `13 * 30 * 24 * 60 * 60 * 1000` (13 months)            | Lifetime of the user ID |
| `visitIdExpirationTime`  | number     | `30 * 60 * 1000` (30 min)                              | Session timeout duration |
| `visitEngagementDelay`   | number     | `10000` (10 sec)                                       | Delay to consider the visit as engaged |
| `exclusionList`          | string[]   | `["paypal.com", "3dsecure", ...]`                      | Referrers to exclude |
| `sourceParams`           | string[]   | `["utm_source", "utm_medium", "utm_campaign", ...]`    | URL params to detect as traffic sources |
| `cookieName`             | string     | `"uv_ids"`                                             | Cookie name storing user/visit IDs |
| `trackSpaPages`          | boolean    | `true`                                                 | Enable tracking page changes in SPAs |
| `autoTagging`            | boolean    | `true`                                                 | Enable automatic firing of standard events (`page_load`, `visit_start`, etc.) |
| `connectors`             | string[]   | `["gtm"]`                                              | Connectors to use for sending events (e.g. `"gtm"`, `"ga"`, `"custom"`) |

---

## 🔌 Built-in Connectors

### `gtm` (default)

Sends events to `window.dataLayer`.

```js
{ event: "page_load", ... }
```

### `custom`

You can provide your own dispatcher:

```js
ActivityTracking.init({
  connectors: ["custom"],
  function(event) {
    myAnalytics.track(event.event, event);
  }
});
```

> If no `connectors` are defined, the fallback is `window.dataLayer.push()`.

---

## 🧠 Standard Tracked Events (if `autoTagging` is enabled)

| Event Name        | Triggered When |
|-------------------|----------------|
| `page_load`       | On page load or SPA route change |
| `first_visit`     | When a new user ID is created |
| `visit_start`     | When a new session starts |
| `visit_engaged`   | When the user remains active longer than `visitEngagementDelay` |
| `new_visit_source`| When a new UTM/referrer source is detected during an active session |

Example payload:

```js
{
  event: "page_load",
  userActivity: { id, visit, ... },
  deviceType: "desktop"
}
```

---

## 📦 Data Storage

- `localStorage`: Full data object under `userActivity`
- `document.cookie`: `{ userId, visitId }` under `uv_ids`

---

## 📐 Device Type Detection

Automatically detects:

- `"mobile"`
- `"tablet"`
- `"desktop"`

---

## 🧰 Public API

Accessible via `window.ActivityTracking`:

### 🔄 `init(userConfig)`, `config`
Initializes the tracker with your configuration and get your current config. 

---

### 📤 `sendPage(extraData?)`

Sends a `page_load` event manually (e.g. if `autoTagging` is disabled).

```js
ActivityTracking.sendPage({ page_type: "checkout" });
```

---

### 📤 `sendEvent(eventName, extraData?)`

Sends a custom event with full user context.

```js
ActivityTracking.sendEvent("product_clicked", {
  product_id: "ABC123",
  placement: "homepage"
});
```

---

### 🧾 `getAllData()`

Returns the full tracking object from `localStorage`.

---

### 🔍 `getUserId()`, `getVisitId()`

Retrieve the current `userId` and `visitId`.

---

### 🧩 `getCustomData()`

Returns `customData` object.

---

### ✍️ `setCustomData(key, value)`

Stores a custom key-value pair under `customData`.

```js
ActivityTracking.setCustomData("userType", "premium");
```

---

### ❌ `deleteCustomData(key)`

Deletes a key from `customData`.

```js
ActivityTracking.deleteCustomData("userType");
```

---

### ➕ `addActivityData(type, data)`

Adds data to either `user` or `visit` level in `userActivity`.

```js
ActivityTracking.addActivityData("user", { plan: "gold" });
ActivityTracking.addActivityData("visit", { abTest: "A" });
```

---

### 🗑️ `deleteActivityData(type, key)`

Deletes a field from `user` or `visit`.

```js
ActivityTracking.deleteActivityData("visit", "abTest");
```

---

## ✅ Go further : Example Init with GTAG & GTM

```js
ActivityTracking.init({
  autoTagging: true,
  connectors: ["gtm", "custom"],
  function(event) {
    gtag('event', event.event, event);
  }
});
```
