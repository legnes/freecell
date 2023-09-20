// Freecell service worker

// Manage cache versioning
const VERSION = 1.6;
const CACHE_NAME = `freecellPWA-v${VERSION}`;

// Collect resources to cache
const OFFLINE_URL = "./index.html";

const PAGE_ASSETS = [
  "./css/lib/deck.css",
  "./css/lib/faces/back.png",
  "./img/freecellking.png",
  "./img/winking.png",
  "./js/lib/deck.min.js",
  "./js/main.js",
];

const CARD_FACE_ASSETS = [];
for (let i = 0; i < 4; i++) {
  for (let j = 1; j < 14; j++) {
    CARD_FACE_ASSETS.push(`./css/lib/faces/${i}_${j}.svg`);
  }
}

const ALL_ASSET_URLS = [ OFFLINE_URL, ...PAGE_ASSETS, ...CARD_FACE_ASSETS ];

// Install: cache assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ALL_ASSET_URLS.map((url) => new Request(url, { cache: "reload" })));
    })()
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keyList = await caches.keys();
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })()
  );
});

// Interceptor 1: Navigation (network first)
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          const cachedResponse = await caches.match(OFFLINE_URL);
          return cachedResponse;
        }
      })()
    );
  }
});

// Interceptor1: Assets (cache first)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request);
      return cachedResponse ?? fetch(event.request);
    })()
  );
});
