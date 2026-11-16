"use strict";

const storageKey = "forstwerk.aufnahme.v1";
const element = (id) => document.getElementById(id);
const fields = {
    polter : element("polter"),
    species : element("species"),
    assortment : element("assortment"),
    diameter : element("diameter"),
    length : element("length")
};
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

function makeId()
{
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
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

function applyDefaults(defaults)
{
    fields.polter.value = typeof defaults.polter === "string" ? defaults.polter : "";
    fields.species.value = typeof defaults.species === "string" ? defaults.species : "";
    fields.assortment.value = typeof defaults.assortment === "string" ? defaults.assortment : "";
    fields.length.value = typeof defaults.length === "string" ? defaults.length : "";
    setGrade([ "A", "B", "C", "D", "K" ].includes(defaults.grade) ? defaults.grade : "");
    if (typeof refreshLocation === "function")
    {
        refreshLocation();
    }
}

function updateListSelect()
{
    const select = element("list-select");
    select.replaceChildren();
    lists.forEach((list) => {
        const option = document.createElement("option");
        option.value = list.id;
        option.textContent = `${list.name} (${list.entries.length} ${list.entries.length === 1 ? "Stamm" : "Stämme"})`;
        select.append(option);
    });
    select.value = activeId;
    element("delete-list").disabled = lists.length === 1;
    if (typeof refreshExportSelection === "function")
    {
        refreshExportSelection();
    }
}

function switchList(id)
{
    const target = lists.find((list) => list.id === id);
    if (!target)
    {
        return false;
    }
    if ((editingId || fields.diameter.value.trim()) &&
        !window.confirm("Die ungespeicherte Stammbearbeitung verwerfen und die Liste wechseln?"))
    {
        updateListSelect();
        return false;
    }
    save();
    finishEdit();
    activeId = id;
    entries = target.entries;
    applyDefaults(target.defaults);
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
    const active = lists.find((list) => list.id === activeId);
    active.entries = entries;
    active.defaults = currentDefaults();
    const state = {version : 2, lists, activeId};
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
                !validLocations(list.locations))
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
                       entry.length > 0 && Number.isFinite(entry.length));
            if (validEntries.length !== list.entries.length)
            {
                throw new Error("Ungültige Stammdaten");
            }
        });
        if (state.version === 2 && !ids.has(state.activeId))
        {
            throw new Error("Ungültige aktive Liste");
        }
        lists = restoredLists;
        activeId = state.version === 2 ? state.activeId : lists[0].id;
        const active = lists.find((list) => list.id === activeId);
        entries = active.entries;
        applyDefaults(active.defaults);
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
    const target = element("entry-volume");
    target.replaceChildren(document.createTextNode(
        diameter && length ? formatter.format(volumeOf(diameter, length)) + " " : "– "));
    const unit = document.createElement("small");
    unit.textContent = "fm";
    target.append(unit);
}

function render()
{
    const list = element("entries");
    list.replaceChildren();
    let volume = 0;
    entries.forEach((entry, index) => {
        volume += volumeOf(entry.diameter, entry.length);
        const item = document.createElement("li");
        item.className = "entry-item";
        const badge = document.createElement("span");
        badge.className = "entry-index";
        badge.textContent = String(index + 1).padStart(2, "0");
        const detail = document.createElement("div");
        detail.className = "entry-details";
        const title = document.createElement("strong");
        title.textContent = `${entry.species} · Güte ${entry.grade}`;
        const subtitle = document.createElement("span");
        subtitle.textContent = `${entry.polter} · ${entry.assortment} · MD ${
            entry.diameter.toLocaleString(
                "de-DE")} cm · ${entry.length.toLocaleString("de-DE")} m · ${
            formatter.format(volumeOf(entry.diameter, entry.length))} fm`;
        detail.append(title, subtitle);
        const actions = document.createElement("div");
        actions.className = "entry-actions";
        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Ändern";
        edit.setAttribute("aria-label", `Stamm ${index + 1} ändern`);
        edit.addEventListener("click", () => startEdit(entry.id));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "delete";
        remove.textContent = "Löschen";
        remove.setAttribute("aria-label", `Stamm ${index + 1} löschen`);
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
    element("next-number").textContent =
        editingId ? "BEARBEITEN" : `STAMM ${String(entries.length + 1).padStart(2, "0")}`;
    setVolume();
    updateLengthButtons();
}

function startEdit(id)
{
    const entry = entries.find((item) => item.id === id);
    if (!entry)
    {
        return;
    }
    editingId = id;
    fields.polter.value = entry.polter;
    fields.species.value = entry.species;
    fields.assortment.value = entry.assortment;
    fields.diameter.value = String(entry.diameter).replace(".", ",");
    fields.length.value = String(entry.length).replace(".", ",");
    setGrade(entry.grade);
    if (typeof refreshLocation === "function")
    {
        refreshLocation();
    }
    element("submit-entry").querySelector("span:nth-child(2)").textContent = "Änderung speichern";
    element("cancel-edit").hidden = false;
    clearErrors();
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
    clearErrors();
    render();
}

function removeEntry(id)
{
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0 || !window.confirm(`Stamm ${index + 1} wirklich löschen?`))
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
    const diameter = parseNumber(fields.diameter.value);
    const length = parseNumber(fields.length.value);
    const missing = [];
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
    const record = {
        id : editingId || makeId(),
        polter : fields.polter.value.trim(),
        species : fields.species.value,
        assortment : fields.assortment.value,
        diameter,
        length,
        grade
    };
    const index = entries.findIndex((entry) => entry.id === editingId);
    if (index >= 0)
    {
        entries[index] = record;
    }
    else
    {
        entries.push(record);
    }
    finishEdit();
    save();
    fields.diameter.focus({preventScroll : true});
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
        setVolume();
        updateLengthButtons();
        if (field !== fields.diameter)
        {
            save();
        }
    });
    field.addEventListener("change", () => {
        field.removeAttribute("aria-invalid");
        if (field !== fields.diameter)
        {
            save();
        }
    });
});
element("cancel-edit").addEventListener("click", () => {
    finishEdit();
    save();
});
element("list-select").addEventListener("change", (event) => {
    switchList(event.target.value);
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
    if (!name)
    {
        element("list-name").focus();
        return;
    }
    const list = {id : makeId(),
        name, entries : [], defaults : {}};
    lists.push(list);
    element("list-name").value = "";
    if (!switchList(list.id))
    {
        lists = lists.filter((item) => item.id !== list.id);
        element("list-name").value = name;
        updateListSelect();
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
    const next = lists.find((item) => item.id !== activeId);
    if (switchList(next.id))
    {
        lists = lists.filter((item) => item.id !== list.id);
        save();
    }
});
restore();
if (storageAvailable)
{
    element("storage-status").textContent = "Auf diesem Gerät gespeichert";
}
updateListSelect();
render();
