"use strict";

let pendingWorker = null;
let applyingUpdate = false;

function updateConnectionStatus()
{
    element("connection-status").textContent = navigator.onLine ? "Gerät meldet: online" : "Gerät meldet: offline";
}

async function showOfflineStatus(registration)
{
    if (navigator.serviceWorker.controller)
    {
        try
        {
            const cacheName = `forstwerk-app-${element("app-version").textContent}`;
            const cacheNames = await caches.keys();
            if (!cacheNames.includes(cacheName))
            {
                throw new Error("Offline-Speicher fehlt");
            }
            const cache = await caches.open(cacheName);
            const required = ["./index.html", "./style.css", "./app.js", "./locations.js",
                "./exchange.js", "./improvements.js", "./offline.js", "./manifest.webmanifest"];
            const files = await Promise.all(required.map((file) => cache.match(new URL(file, registration.scope).href)));
            if (files.some((file) => !file))
            {
                throw new Error("Offline-Speicher unvollständig");
            }
            element("offline-status").textContent = "Offline bereit auf diesem Gerät";
        }
        catch (error)
        {
            element("offline-status").textContent = "Offline-Dateien fehlen oder sind unvollständig. Bitte mit Verbindung erneut einrichten.";
        }
    }
    else if (registration.active)
    {
        element("offline-status").textContent = "Offline eingerichtet – ForstWerk einmal schließen und erneut öffnen.";
    }
    else
    {
        element("offline-status").textContent = "Offline-Einrichtung läuft …";
    }
}

function showUpdate(worker)
{
    pendingWorker = worker;
    element("apply-update").hidden = !worker;
    element("update-status").textContent = worker ? "Eine neue Version ist bereit." : "";
}

function unsavedWork()
{
    if (editingId || fields.diameter.value.trim() || element("list-name").value.trim() || !element("import-preview").hidden)
    {
        return true;
    }
    if (element("next-focus").value !== nextFocus || parseNumber(element("diameter-min").value) !== limits.diameterMin ||
        parseNumber(element("diameter-max").value) !== limits.diameterMax || parseNumber(element("length-min").value) !== limits.lengthMin ||
        parseNumber(element("length-max").value) !== limits.lengthMax)
    {
        return true;
    }
    const location = polterLocation(activeList(), fields.polter.value.trim());
    const latitudeText = element("latitude").value.trim();
    const longitudeText = element("longitude").value.trim();
    const latitude = readCoordinate(latitudeText);
    const longitude = readCoordinate(longitudeText);
    if (!location)
    {
        return Boolean(latitudeText || longitudeText);
    }
    return latitude !== location.latitude || longitude !== location.longitude;
}

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
updateConnectionStatus();

element("apply-update").addEventListener("click", () => {
    if (!pendingWorker || applyingUpdate)
    {
        return;
    }
    if (storageBlocked || !storageAvailable)
    {
        element("update-status").textContent = "Update zurückgestellt: Daten konnten nicht dauerhaft gespeichert werden. Bitte zuerst sichern.";
        return;
    }
    if (unsavedWork())
    {
        element("update-status").textContent = "Bitte angefangene Eingaben speichern oder abschließen, bevor du aktualisierst.";
        return;
    }
    if (!window.confirm("ForstWerk jetzt aktualisieren? Bitte auch Eingaben in anderen geöffneten ForstWerk-Fenstern vorher speichern."))
    {
        return;
    }
    applyingUpdate = true;
    element("apply-update").disabled = true;
    element("update-status").textContent = "Update wird übernommen …";
    pendingWorker.postMessage({type : "ACTIVATE_UPDATE"});
});

if (!("serviceWorker" in navigator))
{
    element("offline-status").textContent = "Offline-Start nicht verfügbar. Bitte HTTPS und Browser prüfen.";
}
else
{
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (applyingUpdate)
        {
            window.location.reload();
        }
    });
    navigator.serviceWorker.register("./service-worker.js", {scope : "./", updateViaCache : "none"}).then((registration) => {
        showOfflineStatus(registration);
        if (registration.waiting && navigator.serviceWorker.controller)
        {
            showUpdate(registration.waiting);
        }
        registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            if (!worker)
            {
                return;
            }
            worker.addEventListener("statechange", () => {
                if (worker.state === "installed")
                {
                    if (navigator.serviceWorker.controller)
                    {
                        showUpdate(worker);
                    }
                    else
                    {
                        navigator.serviceWorker.ready.then(showOfflineStatus);
                    }
                }
                if (worker.state === "redundant" && !registration.active)
                {
                    element("offline-status").textContent = "Offline-Einrichtung fehlgeschlagen. Bitte später erneut öffnen.";
                }
            });
        });
        if (navigator.onLine)
        {
            registration.update().catch(() => {});
        }
    }).catch(() => {
        element("offline-status").textContent = "Offline-Einrichtung nicht möglich. Bitte HTTPS und Verbindung prüfen.";
    });
}
