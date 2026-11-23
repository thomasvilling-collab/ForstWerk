"use strict";

const storageKey = "forstwerk.aufnahme.v1";
const element = (id) => document.getElementById(id);
const fields = {
    polter : element("polter"),
    species : element("species"),
    assortment : element("assortment"),
    diameter : element("diameter"),
    length : element("length"),
    bark : element("bark"),
    originPlot : element("origin-plot"),
    number : element("stem-number")
};
// FIONA-Waldschläge aus Waldschlaege_EPSG4326.geojson (geo_id, schlag_nr, bez).
const originPlots = [
    {id : "a9191ebe-cf6d-4f6f-bcc0-6be20ec392f0", name : "1 · Binsberg Wald"},
    {id : "94a1ee5b-bae4-4bda-b11b-e84f069f6b42", name : "2 · Untere Setze"},
    {id : "8651bf4d-3d26-4d85-ad27-eed5986ed996", name : "3 · Binden"},
    {id : "4e7c60c9-4ce5-4703-9682-63759ad44d53", name : "4 · Heidentor"},
    {id : "e78b5c4e-4d05-4e87-8200-7d4b05e313f3", name : "7 · Guteret"},
    {id : "ecd7ac94-e31c-4f35-b495-8d020eb03cfb", name : "31 · Rappenhalde"},
    {id : "b7ffc7a2-3c32-4de0-9702-025391382c4c", name : "103 · Kehlen Denkingen"},
    {id : "ed049f32-63c0-44d9-8992-32e0acfb7d3b", name : "200 · Felseck"},
    {id : "2789b2e1-9b33-4037-8b51-35f93b49b2cb", name : "201 · Windingen"}
];
const listOriginPlot = element("list-origin-plot");
const applyListOrigin = element("apply-list-origin");
const listOriginStatus = element("list-origin-status");
for (const plot of originPlots)
{
    fields.originPlot.add(new Option(plot.name, plot.id));
    listOriginPlot.add(new Option(plot.name, plot.id));
}

function validOriginPlot(plot)
{
    return plot === undefined || (plot !== null && typeof plot === "object" &&
        typeof plot.id === "string" && plot.id.trim().length > 0 && plot.id.trim().length <= 200 &&
        typeof plot.name === "string" && plot.name.trim().length > 0 && plot.name.trim().length <= 200);
}

function setOpenOrigins(stems, plot, ask = false)
{
    if (!plot)
    {
        return 0;
    }
    const openStems = stems.filter((stem) => !stem.originPlot);
    if (!openStems.length)
    {
        return 0;
    }
    if (ask && !window.confirm(
        `„${plot.name}“ auch für alle Stämme ohne Herkunftsschlag in dieser Holzliste übernehmen? (${openStems.length})`))
    {
        return 0;
    }
    for (const stem of openStems)
    {
        stem.originPlot = {id : plot.id, name : plot.name};
    }
    return openStems.length;
}

const form = element("entry-form");
const gradeButtons = Array.from(document.querySelectorAll("[data-grade]"));
const lengthButtons = Array.from(document.querySelectorAll("[data-length]"));
const formatter =
    new Intl.NumberFormat("de-DE", {minimumFractionDigits : 3, maximumFractionDigits : 3});
let entries = [];
let grade = "";
let editingId = null;
let storageAvailable = true;
let storageBlocked = false;
let lists = [{id : makeId(), name : "Holzliste 1", entries : [], defaults : {}}];
let activeId = lists[0].id;
let limits = {diameterMin : 5, diameterMax : 100, lengthMin : 1, lengthMax : 20};
let nextFocus = "diameter";
let nextByPolter = Object.create(null);
let selectedPolter = "";
let noActiveList = false;

function validLimits(value)
{
    return value && [value.diameterMin, value.diameterMax, value.lengthMin, value.lengthMax]
        .every((number) => Number.isFinite(number) && number > 0 && number <= 1000) &&
        value.diameterMin < value.diameterMax && value.lengthMin < value.lengthMax;
}

function polterKey(name)
{
    return name.trim().toLocaleLowerCase("de-DE");
}

function numberUsed(polter, number, excludedList = "", excludedId = "")
{
    const key = polterKey(polter);
    return lists.some((list) => list.entries.some((entry) =>
        !(list.id === excludedList && entry.id === excludedId) &&
        polterKey(entry.polter) === key && entry.number === number));
}

function activeListNumber()
{
    const list = lists.find((item) => item.id === activeId);
    let candidate = list.nextSequence || 1;
    while (candidate <= 1000000000 && numberUsed(fields.polter.value, candidate))
    {
        candidate++;
    }
    return candidate;
}

function normalizeNumbers(list)
{
    const used = new Set();
    let highest = 0;
    for (const entry of list.entries)
    {
        if (entry.number !== undefined)
        {
            const key = JSON.stringify([polterKey(entry.polter), entry.number]);
            if (!Number.isSafeInteger(entry.number) || entry.number < 1 || entry.number > 1000000000 || used.has(key))
            {
                throw new Error("Ungültige Stammnummer");
            }
            used.add(key);
            highest = Math.max(highest, entry.number);
        }
    }
    if (list.nextNumber !== undefined && (!Number.isSafeInteger(list.nextNumber) || list.nextNumber <= highest))
    {
        throw new Error("Ungültige nächste Stammnummer");
    }
    let next = Math.max(highest + 1, list.nextNumber || 1);
    for (const entry of list.entries)
    {
        if (entry.number === undefined)
        {
            entry.number = next++;
        }
    }
    list.nextNumber = next;
    if (list.nextSequence === undefined)
    {
        list.nextSequence = next;
    }
    if (!Number.isSafeInteger(list.nextSequence) || list.nextSequence < 1 || list.nextSequence > 1000000001)
    {
        throw new Error("Ungültiger Nummernzähler der Holzliste");
    }
}

function makeId()
{
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function validListLocation(location)
{
    return location === undefined || location === null || (typeof location === "object" && !Array.isArray(location) &&
        Number.isFinite(location.latitude) && location.latitude >= -90 && location.latitude <= 90 &&
        Number.isFinite(location.longitude) && location.longitude >= -180 && location.longitude <= 180 &&
        (location.accuracy == null || (Number.isFinite(location.accuracy) && location.accuracy >= 0)));
}

function validLocations(locations)
{
    if (locations === undefined)
    {
        return true;
    }
    if (!Array.isArray(locations))
    {
        return false;
    }
    const names = new Set();
    return locations.every((location) => {
        if (!location || typeof location.name !== "string" || !location.name.trim() ||
            names.has(location.name) || !Number.isFinite(location.latitude) ||
            location.latitude < -90 || location.latitude > 90 || !Number.isFinite(location.longitude) ||
            location.longitude < -180 || location.longitude > 180 ||
            (location.accuracy != null && (!Number.isFinite(location.accuracy) || location.accuracy < 0)))
        {
            return false;
        }
        names.add(location.name);
        return true;
    });
}

function currentDefaults()
{
    return {polter : fields.polter.value, species : fields.species.value,
        assortment : fields.assortment.value, length : fields.length.value, grade};
}

const coniferSpecies = new Set(["Fichte", "Tanne", "Douglasie", "Kiefer", "Lärche"]);
const coniferAssortments = ["Stammholz Nadel lang", "Standardlänge Nadel kurz B/C", "Stammholz Nadel Palette kurz D",
    "Stammholz Nadel Masten B", "Wertholz Nadel A (B)", "Sonstige", "Brennholz", "Sägeholz"];
const otherAssortments = ["Sägeholz", "Industrieholz", "Brennholz", "Palisaden", "Mastholz", "Sonstiges"];

function updateAssortments(selected = fields.assortment.value, preserveLegacy = false)
{
    const values = coniferSpecies.has(fields.species.value) ? coniferAssortments : otherAssortments;
    fields.assortment.replaceChildren(new Option("Bitte auswählen", ""));
    for (const value of values)
    {
        fields.assortment.add(new Option(value, value));
    }
    if (selected && !values.includes(selected) && preserveLegacy)
    {
        const legacy = new Option(`${selected} (Altbestand)`, selected);
        legacy.hidden = true;
        fields.assortment.add(legacy);
    }
    fields.assortment.value = Array.from(fields.assortment.options).some((option) => option.value === selected) ? selected : "";
}

function applyDefaults(defaults)
{
    const originId = lists.find((list) => list.id === activeId)?.defaultOriginPlotId;
    listOriginPlot.value = originPlots.some((plot) => plot.id === originId) ? originId : "";
    fields.originPlot.value = listOriginPlot.value;
    listOriginStatus.textContent = "";
    fields.polter.value = typeof defaults.polter === "string" ? defaults.polter : "";
    selectSpecies(defaults.species);
    updateAssortments(typeof defaults.assortment === "string" ? defaults.assortment : "");
    fields.length.value = typeof defaults.length === "string" ? defaults.length : "";
    setGrade([ "A", "B", "C", "D", "K" ].includes(defaults.grade) ? defaults.grade : "");
    if (typeof refreshLocation === "function")
    {
        refreshLocation();
    }
}

function listPolters(list)
{
    if (typeof list.polterName === "string" && list.polterName.trim())
    {
        return [list.polterName.trim()];
    }
    const names = new Map();
    for (const entry of list.entries)
    {
        if (entry.polter.trim())
        {
            names.set(polterKey(entry.polter), entry.polter.trim());
        }
    }
    if (list.defaults && typeof list.defaults.polter === "string" && list.defaults.polter.trim())
    {
        names.set(polterKey(list.defaults.polter), list.defaults.polter.trim());
    }
    return Array.from(names.values());
}

function matchesPolter(list, name)
{
    if (!name.trim())
    {
        return true;
    }
    return listPolters(list).some((value) => polterKey(value) === polterKey(name));
}

function updateListSelect()
{
    const select = element("list-select");
    select.replaceChildren();
    const matching = lists.filter((list) => matchesPolter(list, selectedPolter));
    if (noActiveList)
    {
        select.add(new Option("Keine Holzliste für diesen Polter", ""));
    }
    matching.forEach((list) => {
        const option = document.createElement("option");
        option.value = list.id;
        option.textContent = `${list.name} (${list.entries.length} ${list.entries.length === 1 ? "Stamm" : "Stämme"})`;
        select.append(option);
    });
    select.value = noActiveList ? "" : activeId;
    element("delete-list").disabled = noActiveList || lists.length === 1;
    element("rename-list").disabled = noActiveList;
    element("list-select").disabled = matching.length === 0;
    const active = noActiveList ? null : lists.find((list) => list.id === activeId);
    const harvestPeriod = element("harvest-period");
    if (harvestPeriod.dataset.listId !== (active?.id ?? ""))
    {
        harvestPeriod.dataset.listId = active?.id ?? "";
        element("harvest-start").value = active?.harvestStart ?? "";
        element("harvest-end").value = active?.harvestEnd ?? "";
        element("harvest-period-status").textContent = "";
    }
    const mixed = active && listPolters(active).length > 1;
    element("list-context").textContent = noActiveList ? "Für diesen Polter gibt es noch keine Holzliste. Lege unten eine neue Liste an." :
        mixed ? "Altbestand: Diese Liste enthält mehrere Polter und zeigt weiterhin alle zugehörigen Stämme." : "";
    document.querySelector(".entry-card").hidden = noActiveList;
    document.querySelector(".overview").hidden = noActiveList;
    document.querySelector(".location-box").hidden = noActiveList;
    document.querySelector(".defaults-grid").hidden = noActiveList;
    if (typeof refreshExportSelection === "function")
    {
        refreshExportSelection();
    }
}

function hasUnsavedLocation()
{
    if (noActiveList || typeof listLocation !== "function")
    {
        return false;
    }
    const current = listLocation(activeList());
    const latitudeText = element("latitude").value.trim();
    const longitudeText = element("longitude").value.trim();
    if (!current)
    {
        return Boolean(latitudeText || longitudeText);
    }
    return readCoordinate(latitudeText) !== current.latitude || readCoordinate(longitudeText) !== current.longitude;
}

function switchList(id)
{
    const target = lists.find((list) => list.id === id);
    if (!target)
    {
        return false;
    }
    if ((editingId || fields.diameter.value.trim() || fields.number.value.trim() || element("review-bark").open || hasUnsavedLocation()) &&
        !window.confirm("Ungespeicherte Stamm- oder Standorteingaben verwerfen und die Liste wechseln?"))
    {
        updateListSelect();
        return false;
    }
    if (!noActiveList)
    {
        save();
        finishEdit();
    }
    noActiveList = false;
    activeId = id;
    entries = target.entries;
    applyDefaults(target.defaults);
    fields.polter.value = selectedPolter;
    if (typeof refreshLocation === "function")
    {
        refreshLocation();
    }
    fields.diameter.value = "";
    save();
    render();
    return true;
}

function parseNumber(value)
{
    const text = value.trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(text))
    {
        return null;
    }
    const result = Number(text.replace(",", "."));
    return Number.isFinite(result) && result > 0 ? result : null;
}

function volumeOf(diameterCm, lengthM)
{
    const diameterM = diameterCm / 100;
    return Math.PI * diameterM * diameterM * lengthM / 4;
}

function parseBark(value)
{
    const text = value.trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(text))
    {
        return null;
    }
    const result = Number(text.replace(",", "."));
    return Number.isFinite(result) && result >= 0 ? result : null;
}

function suggestedBark(species, diameter)
{
    if (!diameter || !Number.isFinite(diameter))
    {
        return null;
    }
    const measured = Math.floor(diameter);
    switch (species)
    {
    case "Fichte":
        return measured <= 26 ? 1 : measured <= 50 ? 2 : 3;
    case "Tanne":
        return measured <= 22 ? 1 : measured <= 38 ? 2 : measured <= 55 ? 3 : 4;
    case "Douglasie":
        return measured <= 20 ? 1 : measured <= 37 ? 2 : measured <= 53 ? 3 : measured <= 70 ? 4 : 5;
    case "Buche":
        return measured <= 41 ? 1 : 2;
    case "Esche":
        return measured <= 18 ? 1 : measured <= 29 ? 2 : measured <= 44 ? 3 : 4;
    case "Kiefer":
        return measured <= 20 ? 1 : measured <= 36 ? 2 : measured <= 62 ? 3 : 4;
    case "Eiche":
    case "Lärche":
        return measured <= 20 ? 1 : measured <= 31 ? 2 : measured <= 42 ? 3 : measured <= 53 ? 4 : 5;
    default:
        return null;
    }
}

function isBarkOrientation(species)
{
    return ["Kiefer", "Eiche", "Lärche"].includes(species);
}

function hasBark(entry)
{
    return Number.isFinite(entry.barkDeductionCm) && entry.barkDeductionCm >= 0 &&
        entry.barkDeductionCm < entry.diameter;
}

function netDiameter(entry)
{
    return hasBark(entry) ? entry.diameter - entry.barkDeductionCm : null;
}

function stemVolume(entry)
{
    const diameter = netDiameter(entry);
    return diameter === null ? null : volumeOf(diameter, entry.length);
}

function updateBarkSuggestion()
{
    if (fields.bark.dataset.manual === "true")
    {
        element("bark-hint").textContent = "Manuell eingegebenen Abzug bitte für diese Holzart und diesen Stamm prüfen.";
        return;
    }
    const proposal = suggestedBark(fields.species.value, parseNumber(fields.diameter.value));
    const orientation = isBarkOrientation(fields.species.value);
    fields.bark.value = proposal === null || orientation ? "" : String(proposal);
    fields.bark.placeholder = orientation && proposal !== null ? `Richtwert ${proposal} cm` : "cm";
    element("bark-hint").textContent = orientation && proposal !== null ?
        `Orientierungswert: ${proposal} cm. Keine pauschale Anwendung; Abzug prüfen und selbst eingeben.${fields.species.value === "Kiefer" ? " Bei Spiegelrinde gilt 1 cm unabhängig vom Durchmesser." : ""}` :
        proposal === null ? "Bitte Rindenabzug für diese Holzart selbst eingeben." :
        "Vorschlag nach Holzart und Durchmesser; vor dem Speichern prüfen und bei Bedarf ändern.";
}

function setGrade(value)
{
    grade = value;
    gradeButtons.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.grade === value));
    });
}

function updateLengthButtons()
{
    const length = parseNumber(fields.length.value);
    lengthButtons.forEach((button) => {
        button.setAttribute("aria-pressed", String(length === Number(button.dataset.length)));
    });
}

function save()
{
    if (storageBlocked)
    {
        return;
    }
    if (!noActiveList)
    {
        const active = lists.find((list) => list.id === activeId);
        active.entries = entries;
        active.defaults = currentDefaults();
    }
    const state = {version : 2, lists, activeId, limits, nextFocus, nextByPolter};
    updateListSelect();
    try
    {
        localStorage.setItem(storageKey, JSON.stringify(state));
        storageAvailable = true;
        element("storage-status").textContent = "Auf diesem Gerät gespeichert";
    }
    catch (error)
    {
        storageAvailable = false;
        element("storage-status").textContent =
            "Speichern auf diesem Gerät nicht möglich. Die Eingaben sind nur vorübergehend vorhanden.";
    }
    if (typeof updateBackupReminder === "function")
    {
        updateBackupReminder();
    }
}

function restore()
{
    try
    {
        const raw = localStorage.getItem(storageKey);
        if (!raw)
        {
            return;
        }
        const state = JSON.parse(raw);
        if (!state)
        {
            throw new Error("Ungültige Aufnahme");
        }
        const restoredLists = state.version === 2 ? state.lists :
            [{id : lists[0].id, name : "Holzliste 1", entries : state.entries, defaults : state.defaults || {}}];
        if (!Array.isArray(restoredLists) || !restoredLists.length)
        {
            throw new Error("Ungültige Listen");
        }
        const ids = new Set();
        restoredLists.forEach((list) => {
            if (!list || typeof list.id !== "string" || !list.id || ids.has(list.id) ||
                typeof list.name !== "string" || !list.name.trim() || !Array.isArray(list.entries) ||
                !list.defaults || typeof list.defaults !== "object" || Array.isArray(list.defaults) ||
                !validLocations(list.locations) || !validListLocation(list.location))
            {
                throw new Error("Ungültige Liste");
            }
            ids.add(list.id);
            const validEntries = list.entries.filter(
            (entry) => entry && typeof entry.id === "string" && typeof entry.polter === "string" &&
                       typeof entry.species === "string" && typeof entry.assortment === "string" &&
                       [ "A", "B", "C", "D", "K" ].includes(entry.grade) &&
                       typeof entry.diameter === "number" && entry.diameter > 0 &&
                       Number.isFinite(entry.diameter) && typeof entry.length === "number" &&
                       entry.length > 0 && Number.isFinite(entry.length) &&
                       (entry.barkDeductionCm === undefined || hasBark(entry)) &&
                       validOriginPlot(entry.originPlot));
            if (validEntries.length !== list.entries.length)
            {
                throw new Error("Ungültige Stammdaten");
            }
            normalizeNumbers(list);
        });
        if (state.version === 2 && !ids.has(state.activeId))
        {
            throw new Error("Ungültige aktive Liste");
        }
        lists = restoredLists;
        nextByPolter = Object.create(null);
        if (state.nextByPolter && typeof state.nextByPolter === "object" && !Array.isArray(state.nextByPolter))
        {
            for (const [key, value] of Object.entries(state.nextByPolter))
            {
                if (Number.isSafeInteger(value) && value >= 1 && value <= 1000000001)
                {
                    nextByPolter[key] = value;
                }
            }
        }
        activeId = state.version === 2 ? state.activeId : lists[0].id;
        const active = lists.find((list) => list.id === activeId);
        entries = active.entries;
        if (state.limits && validLimits(state.limits))
        {
            limits = state.limits;
        }
        if (["length", "diameter"].includes(state.nextFocus))
        {
            nextFocus = state.nextFocus;
        }
        applyDefaults(active.defaults);
        selectedPolter = fields.polter.value.trim();
    }
    catch (error)
    {
        storageAvailable = false;
        storageBlocked = true;
        element("storage-status").textContent =
            "Gespeicherte Daten konnten nicht gelesen werden. Neue Eingaben werden nicht dauerhaft gespeichert.";
    }
}

function setVolume()
{
    const diameter = parseNumber(fields.diameter.value);
    const length = parseNumber(fields.length.value);
    const bark = parseBark(fields.bark.value);
    const adjusted = diameter && bark !== null && bark < diameter ? diameter - bark : null;
    const target = element("entry-volume");
    target.replaceChildren(document.createTextNode(
        adjusted && length ? formatter.format(volumeOf(adjusted, length)) + " " : "– "));
    const unit = document.createElement("small");
    unit.textContent = "fm";
    target.append(unit);
    element("strength-preview").textContent = adjusted ?
        `MD ohne Rinde: ${adjusted.toLocaleString("de-DE")} cm · Stärkeklasse: ${strengthClass(adjusted)}` :
        "Stärkeklasse: –";
}

function render()
{
    applyListOrigin.disabled = Boolean(editingId);
    const list = element("entries");
    list.replaceChildren();
    let volume = 0;
    entries.forEach((entry, index) => {
        const adjustedVolume = stemVolume(entry);
        if (adjustedVolume !== null)
        {
            volume += adjustedVolume;
        }
        const item = document.createElement("li");
        item.className = "entry-item";
        const badge = document.createElement("span");
        badge.className = "entry-index";
        badge.textContent = String(entry.number).padStart(2, "0");
        const detail = document.createElement("div");
        detail.className = "entry-details";
        const title = document.createElement("strong");
        title.textContent = `${entry.species} · Güte ${entry.grade} · ${hasBark(entry) ? `Stärke ${strengthClass(netDiameter(entry))}` : "Rindenabzug prüfen"}`;
        const subtitle = document.createElement("span");
        subtitle.textContent = `${entry.polter} · ${entry.assortment} · MD ${
            entry.diameter.toLocaleString(
                "de-DE")} cm · ${entry.length.toLocaleString("de-DE")} m · ${
            adjustedVolume !== null ? formatter.format(adjustedVolume) + " fm o.R." :
                formatter.format(volumeOf(entry.diameter, entry.length)) + " fm m.R. (ungeprüft)"}`;
        if (entry.originPlot)
        {
            subtitle.textContent += ` · Herkunft: ${entry.originPlot.name}`;
        }
        detail.append(title, subtitle);
        const actions = document.createElement("div");
        actions.className = "entry-actions";
        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Ändern";
        edit.setAttribute("aria-label", `Stamm ${entry.number} ändern`);
        edit.addEventListener("click", () => startEdit(entry.id));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "delete";
        remove.textContent = "Löschen";
        remove.setAttribute("aria-label", `Stamm ${entry.number} löschen`);
        remove.addEventListener("click", () => removeEntry(entry.id));
        actions.append(edit, remove);
        item.append(badge, detail, actions);
        list.append(item);
    });
    element("count").replaceChildren(document.createTextNode(`${entries.length} `));
    const countUnit = document.createElement("small");
    countUnit.textContent = "Stück";
    element("count").append(countUnit);
    element("volume").replaceChildren(document.createTextNode(`${formatter.format(volume)} `));
    const volumeUnit = document.createElement("small");
    volumeUnit.textContent = "fm";
    element("volume").append(volumeUnit);
    element("list-count").textContent =
        `${entries.length} ${entries.length === 1 ? "Eintrag" : "Einträge"}`;
    element("empty-state").hidden = entries.length > 0;
    const unreviewed = entries.filter((entry) => !hasBark(entry)).length;
    element("unreviewed-note").hidden = !unreviewed;
    element("unreviewed-note").textContent = `${unreviewed} ${unreviewed === 1 ? "Stamm benötigt" : "Stämme benötigen"} einen geprüften Rindenabzug und fehlen in der Summe ohne Rinde.`;
    const seenNumbers = new Set();
    let conflict = null;
    for (const storedList of lists)
    {
        for (const entry of storedList.entries)
        {
            const key = JSON.stringify([polterKey(entry.polter), entry.number]);
            if (seenNumbers.has(key) && !conflict)
            {
                conflict = entry;
            }
            seenNumbers.add(key);
        }
    }
    element("number-conflict").hidden = !conflict;
    element("number-conflict").textContent = conflict ? `Vorhandener Konflikt: Stammnummer ${conflict.number} kommt im Polter „${conflict.polter}“ mehrfach vor. Bitte betroffene Stämme prüfen und ändern.` : "";
    fields.number.placeholder = String(activeListNumber());
    element("next-number").textContent =
        editingId ? `STAMM ${entries.find((item) => item.id === editingId).number} BEARBEITEN` :
            `STAMM ${String(activeListNumber()).padStart(2, "0")}`;
    if (typeof renderSummary === "function")
    {
        renderSummary();
    }
    if (typeof renderBarkReview === "function")
    {
        renderBarkReview();
    }
    setVolume();
    updateLengthButtons();
}

function selectSpecies(value)
{
    fields.species.value = value ?? "";
    if (fields.species.selectedIndex < 0)
    {
        fields.species.value = "";
    }
}

function startEdit(id)
{
    const entry = entries.find((item) => item.id === id);
    if (!entry)
    {
        return;
    }
    fields.originPlot.querySelector("option[data-imported]")?.remove();
    editingId = id;
    if (entry.originPlot && !originPlots.some((plot) => plot.id === entry.originPlot.id))
    {
        const option = new Option(entry.originPlot.name, entry.originPlot.id);
        option.dataset.imported = "true";
        fields.originPlot.add(option);
    }
    fields.originPlot.value = entry.originPlot?.id ?? "";
    fields.number.value = String(entry.number);
    fields.polter.value = entry.polter;
    selectedPolter = entry.polter.trim();
    selectSpecies(entry.species);
    updateAssortments(entry.assortment, true);
    fields.diameter.value = String(entry.diameter).replace(".", ",");
    fields.length.value = String(entry.length).replace(".", ",");
    fields.bark.dataset.manual = hasBark(entry) ? "true" : "false";
    fields.bark.value = hasBark(entry) ? String(entry.barkDeductionCm).replace(".", ",") : "";
    updateBarkSuggestion();
    setGrade(entry.grade);
    if (typeof refreshLocation === "function")
    {
        refreshLocation();
    }
    element("submit-entry").querySelector("span:nth-child(2)").textContent = "Änderung speichern";
    element("cancel-edit").hidden = false;
    clearErrors();
    updateListSelect();
    render();
    element("entry-heading").scrollIntoView({behavior : "smooth", block : "start"});
    fields.diameter.focus({preventScroll : true});
}

function finishEdit()
{
    editingId = null;
    element("submit-entry").querySelector("span:nth-child(2)").textContent = "Stamm speichern";
    element("cancel-edit").hidden = true;
    fields.diameter.value = "";
    fields.number.value = "";
    fields.originPlot.querySelector("option[data-imported]")?.remove();
    const originId = lists.find((list) => list.id === activeId)?.defaultOriginPlotId;
    fields.originPlot.value = originPlots.some((plot) => plot.id === originId) ? originId : "";
    fields.bark.value = "";
    fields.bark.dataset.manual = "false";
    updateAssortments();
    clearErrors();
    render();
}

function removeEntry(id)
{
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0 || !window.confirm(`Stamm ${entries[index].number} wirklich löschen?`))
    {
        return;
    }
    entries.splice(index, 1);
    if (editingId === id)
    {
        finishEdit();
    }
    save();
    render();
}

function clearErrors()
{
    element("form-error").hidden = true;
    Object.values(fields).forEach((field) => field.removeAttribute("aria-invalid"));
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors();
    if (element("review-bark").open)
    {
        element("form-error").textContent = "Bitte zuerst die Prüfung der bisherigen Stämme abschließen und schließen.";
        element("form-error").hidden = false;
        return;
    }
    const diameter = parseNumber(fields.diameter.value);
    const length = parseNumber(fields.length.value);
    const bark = parseBark(fields.bark.value);
    const numberText = fields.number.value.trim();
    const number = numberText === "" ? activeListNumber() : Number(numberText);
    const missing = [];
    if ((numberText !== "" && !/^\d+$/.test(numberText)) || !Number.isSafeInteger(number) || number < 1 || number > 1000000000 || numberUsed(fields.polter.value, number, activeId, editingId || ""))
    {
        missing.push([fields.number, "für diesen Polter eindeutige Stammnummer (1 bis 1000000000)"]);
    }
    if (!fields.polter.value.trim())
    {
        missing.push([ fields.polter, "Polterbezeichnung" ]);
    }
    if (!fields.species.value)
    {
        missing.push([ fields.species, "Holzart" ]);
    }
    if (!fields.assortment.value)
    {
        missing.push([ fields.assortment, "Sortiment" ]);
    }
    if (!diameter || diameter > 1000)
    {
        missing.push([ fields.diameter, "gültigen Mittendurchmesser" ]);
    }
    if (!length || length > 1000)
    {
        missing.push([ fields.length, "gültige Länge" ]);
    }
    if (bark === null || !diameter || bark >= diameter)
    {
        missing.push([fields.bark, "gültigen Rindenabzug"]);
    }
    if (!grade)
    {
        missing.push([ gradeButtons[0], "Güte" ]);
    }
    if (missing.length)
    {
        missing.forEach(([ field ]) => field.setAttribute("aria-invalid", "true"));
        element("form-error").textContent =
            `Bitte ${missing.map(([, label ]) => label).join(", ")} eingeben.`;
        element("form-error").hidden = false;
        missing[0][0].focus();
        return;
    }
    const warnings = [];
    if (diameter < limits.diameterMin || diameter > limits.diameterMax)
    {
        warnings.push(`Mittendurchmesser ${diameter.toLocaleString("de-DE")} cm`);
    }
    if (length < limits.lengthMin || length > limits.lengthMax)
    {
        warnings.push(`Länge ${length.toLocaleString("de-DE")} m`);
    }
    if (warnings.length && !window.confirm(`${warnings.join(" und ")} außerhalb deiner Hinweisgrenzen. Trotzdem speichern?`))
    {
        return;
    }
    const index = entries.findIndex((entry) => entry.id === editingId);
    const list = lists.find((item) => item.id === activeId);
    const numberingChanged = index < 0 || entries[index].number !== number;
    const record = {
        id : editingId || makeId(),
        number,
        polter : fields.polter.value.trim(),
        species : fields.species.value,
        assortment : fields.assortment.value,
        diameter,
        length,
        barkDeductionCm : bark,
        grade
    };
    const selectedOrigin = fields.originPlot.selectedOptions[0];
    const previousOrigin = entries[index]?.originPlot;
    if (selectedOrigin?.value)
    {
        record.originPlot = previousOrigin?.id === selectedOrigin.value ? previousOrigin :
            {id : selectedOrigin.value, name : selectedOrigin.text};
    }
    if (index >= 0)
    {
        entries[index] = record;
        list.nextNumber = Math.max(list.nextNumber || 1, record.number + 1);
    }
    else
    {
        entries.push(record);
        list.nextNumber = Math.max(list.nextNumber || 1, record.number + 1);
    }
    if (numberingChanged)
    {
        list.nextSequence = number + 1;
    }
    const assigned = previousOrigin ? 0 : setOpenOrigins(entries, record.originPlot, true);
    finishEdit();
    save();
    if (assigned)
    {
        listOriginStatus.textContent = `Herkunft bei ${assigned} weiteren Stämmen ergänzt.`;
    }
    fields[nextFocus].focus({preventScroll : true});
    fields[nextFocus].select();
});

gradeButtons.forEach((button) => button.addEventListener("click", () => {
    setGrade(button.dataset.grade);
    gradeButtons.forEach((item) => item.removeAttribute("aria-invalid"));
    save();
}));
lengthButtons.forEach((button) => button.addEventListener("click", () => {
    fields.length.value = `${button.dataset.length},0`;
    fields.length.removeAttribute("aria-invalid");
    updateLengthButtons();
    setVolume();
    save();
}));
Object.values(fields).forEach((field) => {
    field.addEventListener("input", () => {
        field.removeAttribute("aria-invalid");
        if (field === fields.bark)
        {
            fields.bark.dataset.manual = "true";
            updateBarkSuggestion();
        }
        if (field === fields.polter)
        {
            fields.number.placeholder = String(activeListNumber());
            if (!editingId)
            {
                element("next-number").textContent = `STAMM ${String(activeListNumber()).padStart(2, "0")}`;
            }
        }
        if (field === fields.species)
        {
            updateAssortments();
        }
        if (field === fields.diameter || field === fields.species)
        {
            updateBarkSuggestion();
        }
        setVolume();
        updateLengthButtons();
        if (field !== fields.diameter && field !== fields.polter)
        {
            save();
        }
    });
    field.addEventListener("change", () => {
        field.removeAttribute("aria-invalid");
        if (field !== fields.diameter && field !== fields.polter)
        {
            save();
        }
    });
});
function restorePolterSelection()
{
    const select = element("saved-polter-select");
    const currentKey = polterKey(selectedPolter);
    select.value = Array.from(select.options).some((option) => option.value === currentKey) ? currentKey : "";
}

function choosePolter(wanted)
{
    if (polterKey(wanted) === polterKey(selectedPolter))
    {
        fields.polter.value = wanted;
        selectedPolter = wanted;
        restorePolterSelection();
        save();
        return;
    }
    if (!noActiveList && (editingId || fields.diameter.value.trim() || fields.number.value.trim() || element("review-bark").open || hasUnsavedLocation()) &&
        !window.confirm("Ungespeicherte Stamm- oder Standorteingaben verwerfen und den Polter wechseln?"))
    {
        fields.polter.value = selectedPolter;
        restorePolterSelection();
        return;
    }
    if (!noActiveList)
    {
        fields.polter.value = selectedPolter;
        save();
        finishEdit();
    }
    selectedPolter = wanted;
    fields.polter.value = wanted;
    const current = lists.find((list) => list.id === activeId);
    let target = current && matchesPolter(current, wanted) ? current : lists.find((list) => matchesPolter(list, wanted));
    if (!target && current && !current.entries.length && !listPolters(current).length && wanted)
    {
        current.polterName = wanted;
        target = current;
    }
    if (target)
    {
        noActiveList = false;
        activeId = target.id;
        entries = target.entries;
        applyDefaults(target.defaults);
        fields.polter.value = wanted;
        refreshLocation();
        save();
        render();
    }
    else
    {
        noActiveList = true;
        updateListSelect();
        refreshLocation();
    }
}

fields.polter.addEventListener("change", () => choosePolter(fields.polter.value.trim()));
element("saved-polter-select").addEventListener("change", (event) => {
    const select = event.target;
    if (select.value)
    {
        choosePolter(select.selectedOptions[0].text);
    }
    else
    {
        restorePolterSelection();
    }
});
element("cancel-edit").addEventListener("click", () => {
    finishEdit();
    save();
});
element("list-select").addEventListener("change", (event) => {
    switchList(event.target.value);
});
element("save-harvest-period").addEventListener("click", () => {
    const list = noActiveList ? null : lists.find((item) => item.id === activeId);
    const status = element("harvest-period-status");
    if (!list || storageBlocked)
    {
        status.textContent = "Hiebzeitraum kann nicht gespeichert werden.";
        return;
    }
    const start = element("harvest-start");
    const end = element("harvest-end");
    if (!start.validity.valid || !end.validity.valid ||
        (start.value && end.value && start.value > end.value))
    {
        status.textContent = "Bitte gültige Daten eingeben. Das Hiebende darf nicht vor dem Hiebbeginn liegen.";
        return;
    }
    if (start.value)
        list.harvestStart = start.value;
    else
        delete list.harvestStart;
    if (end.value)
        list.harvestEnd = end.value;
    else
        delete list.harvestEnd;
    save();
    status.textContent = storageAvailable ? "Hiebzeitraum gespeichert." : "Hiebzeitraum in diesem Gerät nicht gespeichert.";
});
applyListOrigin.addEventListener("click", () => {
    const list = noActiveList ? null : lists.find((item) => item.id === activeId);
    if (!list || editingId)
    {
        return;
    }
    const plot = originPlots.find((item) => item.id === listOriginPlot.value);
    list.defaultOriginPlotId = plot?.id ?? "";
    const assigned = setOpenOrigins(list.entries, plot);
    fields.originPlot.value = list.defaultOriginPlotId;
    save();
    render();
    listOriginStatus.textContent = plot
        ? `Herkunft bei ${assigned} offenen Stämmen ergänzt. Für neue Stämme vorausgewählt.`
        : "Vorauswahl für neue Stämme entfernt.";
});
element("rename-list").addEventListener("click", () => {
    const list = lists.find((item) => item.id === activeId);
    const name = window.prompt("Name der Holzliste:", list.name);
    if (name !== null && name.trim())
    {
        list.name = name.trim().slice(0, 100);
        save();
    }
});
element("create-list").addEventListener("click", () => {
    const name = element("list-name").value.trim();
    if (!selectedPolter)
    {
        element("list-start-status").textContent = "Bitte zuerst einen Polter auswählen oder eingeben.";
        fields.polter.focus();
        return;
    }
    if (!name)
    {
        element("list-name").focus();
        return;
    }
    const startText = element("list-start").value.trim();
    const start = Number(startText);
    if (!/^\d+$/.test(startText) || !Number.isSafeInteger(start) || start < 1 || start > 1000000000)
    {
        element("list-start-status").textContent = "Bitte eine Startnummer von 1 bis 1000000000 eingeben.";
        element("list-start").focus();
        return;
    }
    element("list-start-status").textContent = "";
    const list = {id : makeId(),
        name, polterName : selectedPolter, entries : [], defaults : {polter : selectedPolter}, nextSequence : start};
    lists.push(list);
    element("list-name").value = "";
    if (!switchList(list.id))
    {
        lists = lists.filter((item) => item.id !== list.id);
        element("list-name").value = name;
        updateListSelect();
    }
    else
    {
        element("list-start").value = "1";
    }
});
element("delete-list").addEventListener("click", () => {
    if (lists.length <= 1)
    {
        return;
    }
    const list = lists.find((item) => item.id === activeId);
    if (!window.confirm(`Holzliste „${list.name}“ mit ${entries.length} Stämmen wirklich löschen?`))
    {
        return;
    }
    const next = lists.find((item) => item.id !== activeId && matchesPolter(item, selectedPolter));
    if (!next)
    {
        lists = lists.filter((item) => item.id !== list.id);
        noActiveList = true;
        activeId = lists[0].id;
        save();
        updateListSelect();
        refreshLocation();
        return;
    }
    if (switchList(next.id))
    {
        lists = lists.filter((item) => item.id !== list.id);
        save();
    }
});
restore();
updateAssortments(fields.assortment.value);
selectedPolter = fields.polter.value.trim();
if (storageAvailable)
{
    element("storage-status").textContent = "Auf diesem Gerät gespeichert";
}
updateListSelect();
render();
