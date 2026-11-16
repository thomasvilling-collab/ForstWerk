"use strict";

let locationRequest = 0;

function activeList()
{
    return lists.find((list) => list.id === activeId);
}

function polterLocation(list, name)
{
    return (list.locations || []).find((location) => location.name === name.trim());
}

function refreshLocation()
{
    locationRequest++;
    const list = activeList();
    const name = fields.polter.value.trim();
    const location = polterLocation(list, name);
    element("latitude").value = location ? String(location.latitude).replace(".", ",") : "";
    element("longitude").value = location ? String(location.longitude).replace(".", ",") : "";
    const status = element("location-status");
    status.textContent = location ? (location.accuracy == null ? "Standort gespeichert." :
        `Standort gespeichert · geschätzte Genauigkeit ±${Math.round(location.accuracy)} m`) : "";
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
    const names = new Set([...list.entries.map((entry) => entry.polter), ...(list.locations || []).map((item) => item.name)]);
    names.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        suggestions.append(option);
    });
}

function storeLocation(latitude, longitude, accuracy)
{
    const name = fields.polter.value.trim();
    if (!name)
    {
        element("location-status").textContent = "Bitte zuerst eine Polterbezeichnung eingeben.";
        fields.polter.focus();
        return;
    }
    if (storageBlocked)
    {
        element("location-status").textContent = "Standort kann nicht gespeichert werden: vorhandene Browserdaten sind nicht lesbar.";
        return;
    }
    const list = activeList();
    if (!list.locations)
    {
        list.locations = [];
    }
    const previous = polterLocation(list, name);
    if (previous)
    {
        Object.assign(previous, {latitude, longitude, accuracy});
    }
    else
    {
        list.locations.push({name, latitude, longitude, accuracy});
    }
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

fields.polter.addEventListener("input", refreshLocation);
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
    const name = fields.polter.value.trim();
    if (!name)
    {
        element("location-status").textContent = "Bitte zuerst eine Polterbezeichnung eingeben.";
        fields.polter.focus();
        return;
    }
    if (!navigator.geolocation)
    {
        element("location-status").textContent = "Standortermittlung nicht verfügbar. Koordinaten können von Hand eingegeben werden.";
        return;
    }
    const request = ++locationRequest;
    const listId = activeId;
    element("location-status").textContent = "Standort wird ermittelt …";
    navigator.geolocation.getCurrentPosition((position) => {
        if (request !== locationRequest || listId !== activeId || name !== fields.polter.value.trim())
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
element("clear-location").addEventListener("click", () => {
    const list = activeList();
    const name = fields.polter.value.trim();
    if (!polterLocation(list, name))
    {
        element("location-status").textContent = "Für diesen Polter ist kein Standort gespeichert.";
        return;
    }
    if (!window.confirm(`Standort für „${name}“ entfernen?`))
    {
        return;
    }
    list.locations = list.locations.filter((item) => item.name !== name);
    save();
    refreshLocation();
});
refreshLocation();
