"use strict";

const exchangeFormat = "ForstWerk-Holzlisten";
let importCandidates = [];

function selectedLists()
{
    const scope = element("export-scope").value;
    if (scope === "all")
    {
        return lists;
    }
    if (scope === "selection")
    {
        const ids = new Set(Array.from(element("export-selection").querySelectorAll("input:checked"), (input) => input.value));
        return lists.filter((list) => ids.has(list.id));
    }
    return lists.filter((list) => list.id === activeId);
}

function canExport()
{
    const valid = selectedLists().length > 0;
    element("export-status").textContent = valid ? "" : "Bitte mindestens eine Holzliste auswählen.";
    return valid;
}

function downloadFile(name, content, mime)
{
    const url = URL.createObjectURL(new Blob([content], {type : mime}));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function exportName(extension)
{
    const selected = selectedLists();
    const name = selected.length === 1 ? selected[0].name : "Holzlisten";
    const safe = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim().slice(0, 100) || "Holzliste";
    return `ForstWerk-${safe}.${extension}`;
}

function csvCell(value)
{
    let text = typeof value === "number" ? String(value).replace(".", ",") : String(value);
    if (typeof value !== "number" && /^[\s\u0000-\u001f]*[=+@-]/.test(text))
    {
        text = `'${text}`;
    }
    return `"${text.replace(/"/g, '""')}"`;
}

function groupsForList(list)
{
    const groups = [];
    list.entries.forEach((entry, index) => {
        let group = groups.find((item) => item.polter === entry.polter && item.assortment === entry.assortment);
        if (!group)
        {
            group = {polter : entry.polter, assortment : entry.assortment, entries : []};
            groups.push(group);
        }
        group.entries.push({entry, number : index + 1});
    });
    if (!groups.length)
    {
        groups.push({polter : list.defaults.polter || "", assortment : list.defaults.assortment || "", entries : []});
    }
    return groups;
}

function exportCsv()
{
    const rows = [];
    selectedLists().forEach((list) => {
        groupsForList(list).forEach((group) => {
            rows.push(["Holzliste", list.name]);
            rows.push(["Polter", group.polter]);
            rows.push(["Sortiment", group.assortment]);
            const location = polterLocation(list, group.polter);
            if (location)
            {
                rows.push(["Breitengrad", location.latitude]);
                rows.push(["Längengrad", location.longitude]);
            }
            rows.push(["Nr.", "Holzart", "Güte", "Länge (m)", "MD (cm)", "Volumen (fm)"]);
            group.entries.forEach(({entry, number}) => {
                rows.push([number, entry.species, entry.grade, String(entry.length).replace(".", ","),
                    String(entry.diameter).replace(".", ","), formatter.format(volumeOf(entry.diameter, entry.length))]);
            });
            const total = group.entries.reduce((sum, item) => sum + volumeOf(item.entry.diameter, item.entry.length), 0);
            rows.push(["Summe", "", "", "", "", formatter.format(total)]);
            rows.push([]);
        });
    });
    return "\ufeff" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

function appendText(parent, tag, text, className)
{
    const child = document.createElement(tag);
    child.textContent = text;
    if (className)
    {
        child.className = className;
    }
    parent.append(child);
    return child;
}

function preparePrint()
{
    const content = element("print-content");
    content.replaceChildren();
    selectedLists().forEach((list) => {
        const section = document.createElement("section");
        section.className = "print-list";
        appendText(section, "p", "FORSTWERK · HOLZAUFNAHME", "print-brand");
        appendText(section, "h1", list.name);
        appendText(section, "p", `${list.entries.length} ${list.entries.length === 1 ? "Stamm" : "Stämme"} · Gesamtvolumen: ${formatter.format(list.entries.reduce((sum, entry) => sum + volumeOf(entry.diameter, entry.length), 0))} fm`);
        groupsForList(list).forEach((group) => {
            const groupSection = document.createElement("div");
            groupSection.className = "print-group";
            appendText(groupSection, "p", `Polter: ${group.polter || "–"} · Sortiment: ${group.assortment || "–"}`, "print-group-heading");
            const location = polterLocation(list, group.polter);
            if (location)
            {
                appendText(groupSection, "p", `Standort: ${String(location.latitude).replace(".", ",")} / ${String(location.longitude).replace(".", ",")}`, "print-location");
            }
            const table = document.createElement("table");
            const header = table.createTHead().insertRow();
            ["Nr.", "Holzart", "Güte", "Länge m", "MD cm", "fm"].forEach((label) => appendText(header, "th", label));
            const body = table.createTBody();
            group.entries.forEach(({entry, number}) => {
                const row = body.insertRow();
                [number, entry.species, entry.grade, entry.length.toLocaleString("de-DE"),
                    entry.diameter.toLocaleString("de-DE"), formatter.format(volumeOf(entry.diameter, entry.length))].forEach((value) => appendText(row, "td", String(value)));
            });
            groupSection.append(table);
            const total = group.entries.reduce((sum, item) => sum + volumeOf(item.entry.diameter, item.entry.length), 0);
            appendText(groupSection, "p", `Summe: ${formatter.format(total)} fm`, "print-group-total");
            section.append(groupSection);
        });
        appendText(section, "p", "Volumen rechnerisch nach der Zylinderformel. Angaben vor dem Verkauf prüfen.", "print-note");
        content.append(section);
    });
}

function validImport(data)
{
    if (!data || data.format !== exchangeFormat || data.version !== 1 || !Array.isArray(data.lists) || !data.lists.length)
    {
        return false;
    }
    const listIds = new Set();
    return data.lists.every((list) => {
        if (!list || typeof list.id !== "string" || !list.id || listIds.has(list.id) ||
            typeof list.name !== "string" || !list.name.trim() || !Array.isArray(list.entries) ||
            !list.defaults || typeof list.defaults !== "object" || Array.isArray(list.defaults) || !validLocations(list.locations))
        {
            return false;
        }
        listIds.add(list.id);
        const entryIds = new Set();
        return list.entries.every((entry) => {
            if (!entry || typeof entry.id !== "string" || !entry.id || entryIds.has(entry.id) ||
                typeof entry.polter !== "string" || typeof entry.species !== "string" ||
                typeof entry.assortment !== "string" || !["A", "B", "C", "D", "K"].includes(entry.grade) ||
                !Number.isFinite(entry.diameter) || entry.diameter <= 0 || entry.diameter > 1000 ||
                !Number.isFinite(entry.length) || entry.length <= 0 || entry.length > 1000)
            {
                return false;
            }
            entryIds.add(entry.id);
            return true;
        });
    });
}

function showImport(data)
{
    importCandidates = data.lists;
    const container = element("import-lists");
    container.replaceChildren();
    const known = new Set(lists.map((list) => list.id));
    data.lists.forEach((list, index) => {
        const label = document.createElement("label");
        label.className = "import-list";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = String(index);
        checkbox.disabled = known.has(list.id);
        checkbox.checked = !checkbox.disabled;
        label.append(checkbox);
        appendText(label, "span", `${list.name} · ${list.entries.length} Stämme${checkbox.disabled ? " · bereits vorhanden, wird nicht importiert" : ""}`);
        container.append(label);
    });
    element("import-summary").textContent = `${data.lists.length} ${data.lists.length === 1 ? "Liste gefunden" : "Listen gefunden"}. Bitte Auswahl prüfen.`;
    element("import-preview").hidden = false;
}

let exportSelectionSignature = "";
function refreshExportSelection()
{
    const container = element("export-selection");
    container.hidden = element("export-scope").value !== "selection";
    if (container.hidden)
    {
        return;
    }
    const signature = JSON.stringify(lists.map((list) => [list.id, list.name]));
    if (signature === exportSelectionSignature)
    {
        return;
    }
    const previous = new Map(Array.from(container.querySelectorAll("input"), (input) => [input.value, input.checked]));
    container.replaceChildren();
    lists.forEach((list) => {
        const label = document.createElement("label");
        label.className = "import-list";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = list.id;
        checkbox.checked = previous.has(list.id) ? previous.get(list.id) : true;
        label.append(checkbox);
        appendText(label, "span", list.name);
        container.append(label);
    });
    exportSelectionSignature = signature;
}
element("export-scope").addEventListener("change", () => {
    refreshExportSelection();
    element("export-status").textContent = "";
});
element("export-json").addEventListener("click", () => {
    if (!canExport())
    {
        return;
    }
    save();
    const data = {format : exchangeFormat, version : 1, exportedAt : new Date().toISOString(), lists : selectedLists()};
    downloadFile(exportName("json"), JSON.stringify(data, null, 2), "application/json;charset=utf-8");
});
element("export-csv").addEventListener("click", () => {
    if (!canExport())
    {
        return;
    }
    downloadFile(exportName("csv"), exportCsv(), "text/csv;charset=utf-8");
});
element("export-pdf").addEventListener("click", () => {
    if (!canExport())
    {
        return;
    }
    preparePrint();
    window.print();
});
element("import-file").addEventListener("change", async (event) => {
    element("import-preview").hidden = true;
    element("import-status").textContent = "";
    importCandidates = [];
    const file = event.target.files[0];
    if (!file)
    {
        return;
    }
    try
    {
        if (file.size > 10 * 1024 * 1024)
        {
            throw new Error("Die Datei ist größer als 10 MB.");
        }
        const data = JSON.parse(await file.text());
        if (!validImport(data))
        {
            throw new Error("Die Datei ist keine gültige oder unterstützte ForstWerk-Holzlistendatei.");
        }
        showImport(data);
    }
    catch (error)
    {
        element("import-status").textContent = error instanceof SyntaxError ? "Die Datei enthält kein gültiges JSON." : error.message;
    }
});
element("import-confirm").addEventListener("click", () => {
    if (storageBlocked)
    {
        element("import-status").textContent = "Import nicht möglich: Die vorhandenen Browserdaten konnten nicht gelesen werden.";
        return;
    }
    const chosen = Array.from(element("import-lists").querySelectorAll("input:checked:not(:disabled)"));
    const existing = new Set(lists.map((list) => list.id));
    const added = chosen.map((checkbox) => importCandidates[Number(checkbox.value)]).filter((list) => list && !existing.has(list.id));
    if (!added.length)
    {
        element("import-status").textContent = "Bitte mindestens eine neue Liste auswählen.";
        return;
    }
    lists.push(...added);
    save();
    element("import-status").textContent = storageAvailable ? `${added.length} ${added.length === 1 ? "Liste importiert" : "Listen importiert"}.` : "Import nur vorübergehend vorhanden: Speichern auf diesem Gerät nicht möglich.";
    element("import-preview").hidden = true;
    element("import-file").value = "";
});
