"use strict";

let locationRequest = 0;

function activeList()
{
    return noActiveList ? null : lists.find((list) => list.id === activeId);
}

function listLocation(list)
{
    return list && validListLocation(list.location) ? list.location || null : null;
}

function polterLocation(list, name)
{
    if (!list)
    {
        return null;
    }
    if (Object.prototype.hasOwnProperty.call(list, "location"))
    {
        return listLocation(list);
    }
    return (list.locations || []).find((location) => location.name === name.trim()) || null;
}

function refreshLocation()
{
    locationRequest++;
    const list = activeList();
    const location = listLocation(list);
    element("latitude").value = location ? String(location.latitude).replace(".", ",") : "";
    element("longitude").value = location ? String(location.longitude).replace(".", ",") : "";
    const legacy = list && !Object.prototype.hasOwnProperty.call(list, "location") ? (list.locations || []) : [];
    const choice = element("legacy-location-choice");
    choice.hidden = !legacy.length;
    const select = element("legacy-location");
    select.replaceChildren(new Option("Bitte Standort auswählen", ""));
    legacy.forEach((item, index) => {
        select.add(new Option(`${item.name}: ${item.latitude.toLocaleString("de-DE")} / ${item.longitude.toLocaleString("de-DE")}`, String(index)));
    });
    const status = element("location-status");
    status.textContent = legacy.length ? "Bisherige Standorte sind erhalten. Bitte einen Standort für die Holzliste auswählen und bestätigen." :
        location ? (location.accuracy == null ? "Standort der Holzliste gespeichert." :
            `Standort der Holzliste gespeichert · geschätzte Genauigkeit ±${Math.round(location.accuracy)} m`) : "";
    const map = element("location-map");
    map.hidden = !location;
    if (location)
    {
        map.href = `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=17/${location.latitude}/${location.longitude}`;
    }
    else
    {
        map.removeAttribute("href");
    }
    const suggestions = element("polter-suggestions");
    suggestions.replaceChildren();
    const names = new Map();
    for (const item of lists)
    {
        for (const name of listPolters(item))
        {
            names.set(polterKey(name), name);
        }
    }
    for (const name of names.values())
    {
        suggestions.append(new Option(name, name));
    }
}

function storeLocation(latitude, longitude, accuracy)
{
    if (storageBlocked || noActiveList)
    {
        element("location-status").textContent = "Standort kann nicht gespeichert werden. Bitte zuerst eine Holzliste auswählen.";
        return;
    }
    const list = activeList();
    list.location = {latitude, longitude, accuracy};
    save();
    refreshLocation();
    if (!storageAvailable)
    {
        element("location-status").textContent = "Standort nur vorübergehend vorhanden: Speichern ist nicht möglich.";
    }
}

function readCoordinate(value)
{
    const text = value.trim().replace(",", ".");
    if (!/^-?\d+(?:\.\d+)?$/.test(text))
    {
        return null;
    }
    return Number(text);
}

element("latitude").addEventListener("input", () => { locationRequest++; });
element("longitude").addEventListener("input", () => { locationRequest++; });
element("save-location").addEventListener("click", () => {
    const latitude = readCoordinate(element("latitude").value);
    const longitude = readCoordinate(element("longitude").value);
    if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
    {
        element("location-status").textContent = "Bitte gültige Koordinaten eingeben: Breite −90 bis 90, Länge −180 bis 180.";
        return;
    }
    storeLocation(latitude, longitude, null);
});
element("get-location").addEventListener("click", () => {
    if (!navigator.geolocation)
    {
        element("location-status").textContent = "Standortermittlung nicht verfügbar. Koordinaten können von Hand eingegeben werden.";
        return;
    }
    const request = ++locationRequest;
    const listId = activeId;
    element("location-status").textContent = "Standort wird ermittelt …";
    navigator.geolocation.getCurrentPosition((position) => {
        if (request !== locationRequest || noActiveList || listId !== activeId)
        {
            return;
        }
        storeLocation(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
    }, (error) => {
        if (request !== locationRequest)
        {
            return;
        }
        element("location-status").textContent = error.code === 1 ? "Standortfreigabe abgelehnt. Bitte die Browserberechtigung prüfen oder Koordinaten eingeben." :
            "Standort konnte nicht ermittelt werden. Bitte erneut versuchen oder Koordinaten eingeben.";
    }, {enableHighAccuracy : true, timeout : 20000, maximumAge : 0});
});
element("confirm-legacy-location").addEventListener("click", () => {
    const list = activeList();
    const index = element("legacy-location").value;
    if (!list || index === "" || !list.locations || !list.locations[Number(index)])
    {
        element("location-status").textContent = "Bitte zuerst einen bisherigen Standort auswählen.";
        return;
    }
    const legacy = list.locations[Number(index)];
    if (!window.confirm(`Standort von „${legacy.name}“ für die gesamte Holzliste übernehmen?`))
    {
        return;
    }
    storeLocation(legacy.latitude, legacy.longitude, legacy.accuracy == null ? null : legacy.accuracy);
});
element("clear-location").addEventListener("click", () => {
    const list = activeList();
    if (!list || !listLocation(list))
    {
        element("location-status").textContent = "Für diese Holzliste ist kein bestätigter Standort gespeichert.";
        return;
    }
    if (!window.confirm("Standort dieser Holzliste entfernen?"))
    {
        return;
    }
    list.location = null;
    save();
    refreshLocation();
});
refreshLocation();
