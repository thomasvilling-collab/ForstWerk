"use strict";

const VERSION = "1.3.9";
const CACHE_NAME = `forstwerk-app-${VERSION}`;
const FILES = ["./", "./index.html", "./style.css", "./strength.js", "./app.js", "./locations.js",
    "./exchange.js", "./improvements.js", "./vendor/jsQR.js", "./lan-test.js", "./offline.js",
    "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];
const SCOPE = new URL(self.registration.scope);
const INDEX_URL = new URL("index.html", SCOPE).href;
const RESOURCE_URLS = new Set(FILES.map((file) => new URL(file, SCOPE).href));

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        try
        {
            await cache.addAll(FILES.map((file) => new Request(new URL(file, SCOPE), {cache : "reload"})));
        }
        catch (error)
        {
            await caches.delete(CACHE_NAME);
            throw error;
        }
    })());
});

self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "ACTIVATE_UPDATE")
    {
        self.skipWaiting();
    }
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET")
    {
        return;
    }
    const url = new URL(event.request.url);
    if (url.origin !== SCOPE.origin)
    {
        return;
    }
    url.hash = "";
    url.search = "";
    const isEntry = event.request.mode === "navigate" && (url.href === SCOPE.href || url.href === INDEX_URL);
    if (!isEntry && !RESOURCE_URLS.has(url.href))
    {
        return;
    }
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(isEntry ? INDEX_URL : url.href);
        if (cached)
        {
            return cached;
        }
        return fetch(event.request);
    })());
});
