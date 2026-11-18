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
    list.entries.forEach((entry) => {
        let group = groups.find((item) => item.polter === entry.polter && item.assortment === entry.assortment);
        if (!group)
        {
            group = {polter : entry.polter, assortment : entry.assortment, entries : []};
            groups.push(group);
        }
        group.entries.push({entry, number : entry.number});
    });
    if (!groups.length)
    {
        groups.push({polter : list.defaults.polter || "", assortment : list.defaults.assortment || "", entries : []});
    }
    return groups;
}

function strengthTotals(records)
{
    const totals = new Map();
    records.filter(hasBark).forEach((entry) => {
        const label = strengthClass(netDiameter(entry));
        const total = totals.get(label) || {count : 0, volume : 0};
        total.count++;
        total.volume += stemVolume(entry);
        totals.set(label, total);
    });
    return Array.from(totals.entries()).sort((a, b) => a[0].localeCompare(b[0], "de"));
}

function pricingTotals(records)
{
    const groups = new Map();
    records.filter(hasBark).forEach((entry) => {
        const key = JSON.stringify([strengthClass(netDiameter(entry)), entry.species, entry.grade, entry.assortment]);
        const total = groups.get(key) || {count : 0, volume : 0};
        total.count++;
        total.volume += stemVolume(entry);
        groups.set(key, total);
    });
    return Array.from(groups.entries()).map(([key, total]) => ({values : JSON.parse(key), ...total}))
        .sort((a, b) => a.values.join(" ").localeCompare(b.values.join(" "), "de"));
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
            rows.push(["Nr.", "Holzart", "Güte", "Länge (m)", "MD m.R. (cm)", "Rindenabzug (cm)", "Stärke", "Volumen (fm o.R.)"]);
            group.entries.forEach(({entry, number}) => {
                const volume = stemVolume(entry);
                rows.push([number, entry.species, entry.grade, String(entry.length).replace(".", ","),
                    String(entry.diameter).replace(".", ","), hasBark(entry) ? entry.barkDeductionCm : "",
                    hasBark(entry) ? strengthClass(netDiameter(entry)) : "ungeprüft",
                    volume === null ? "" : formatter.format(volume)]);
            });
            const total = group.entries.reduce((sum, item) => sum + (stemVolume(item.entry) || 0), 0);
            rows.push(["Summe geprüft", "", "", "", "", "", "", formatter.format(total)]);
            rows.push([]);
        });
        rows.push(["Stärkeklasse", "Stämme", "fm ohne Rinde"]);
        strengthTotals(list.entries).forEach(([label, total]) => {
            rows.push([label, total.count, formatter.format(total.volume)]);
        });
        rows.push([]);
        rows.push(["Stärke", "Holzart", "Güte", "Sortiment", "Stämme", "fm ohne Rinde"]);
        pricingTotals(list.entries).forEach((total) => {
            rows.push([...total.values, total.count, formatter.format(total.volume)]);
        });
        rows.push(["Ungeprüfte Stämme", list.entries.filter((entry) => !hasBark(entry)).length]);
        rows.push([]);
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
        const pending = list.entries.filter((entry) => !hasBark(entry)).length;
        appendText(section, "p", `${list.entries.length} ${list.entries.length === 1 ? "Stamm" : "Stämme"} · Geprüftes Volumen: ${formatter.format(list.entries.reduce((sum, entry) => sum + (stemVolume(entry) || 0), 0))} fm o.R.${pending ? ` · ${pending} ungeprüft` : ""}`);
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
            ["Pos.", "Stammnr.", "Holzart", "Güte", "Stärke", "Länge m", "MD m.R. cm", "MD o.R. cm", "fm m.R.", "fm o.R."].forEach((label) => appendText(header, "th", label));
            const body = table.createTBody();
            group.entries.forEach(({entry, number}, index) => {
                const row = body.insertRow();
                [index + 1, number, entry.species, entry.grade,
                    hasBark(entry) ? strengthClass(netDiameter(entry)) : "ungeprüft",
                    entry.length.toLocaleString("de-DE"), entry.diameter.toLocaleString("de-DE"),
                    hasBark(entry) ? netDiameter(entry).toLocaleString("de-DE") : "–",
                    formatter.format(volumeOf(entry.diameter, entry.length)),
                    hasBark(entry) ? formatter.format(stemVolume(entry)) : "–"].forEach((value) => appendText(row, "td", String(value)));
            });
            groupSection.append(table);
            const total = group.entries.reduce((sum, item) => sum + (stemVolume(item.entry) || 0), 0);
            appendText(groupSection, "p", `Summe geprüft: ${formatter.format(total)} fm o.R.`, "print-group-total");
            section.append(groupSection);
        });
        appendText(section, "h2", "Stärkeklassen · geprüfte Stämme", "print-strength-heading");
        const summary = document.createElement("table");
        const summaryHeader = summary.createTHead().insertRow();
        ["Stärkeklasse", "Stämme", "fm ohne Rinde"].forEach((label) => appendText(summaryHeader, "th", label));
        const summaryBody = summary.createTBody();
        strengthTotals(list.entries).forEach(([label, total]) => {
            const row = summaryBody.insertRow();
            [label, String(total.count), formatter.format(total.volume)].forEach((value) => appendText(row, "td", value));
        });
        section.append(summary);
        appendText(section, "h2", "Stärke, Holzart, Güte und Sortiment", "print-strength-heading");
        const pricing = document.createElement("table");
        const pricingHeader = pricing.createTHead().insertRow();
        ["Stärke", "Holzart", "Güte", "Sortiment", "Stämme", "fm o.R."].forEach((label) => appendText(pricingHeader, "th", label));
        const pricingBody = pricing.createTBody();
        pricingTotals(list.entries).forEach((total) => {
            const row = pricingBody.insertRow();
            [...total.values, String(total.count), formatter.format(total.volume)].forEach((value) => appendText(row, "td", value));
        });
        section.append(pricing);
        appendText(section, "p", "Durchmesser mit Rinde abzüglich geprüftem Rindenabzug. Volumen rechnerisch nach der Zylinderformel; Rundungs- und Vertragsregeln vor dem Verkauf prüfen.", "print-note");
        content.append(section);
    });
}

function validImport(data)
{
    if (!data || data.format !== exchangeFormat || ![1, 2].includes(data.version) || !Array.isArray(data.lists) || !data.lists.length)
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
        const validEntries = list.entries.every((entry) => {
            if (!entry || typeof entry.id !== "string" || !entry.id || entryIds.has(entry.id) ||
                typeof entry.polter !== "string" || typeof entry.species !== "string" ||
                typeof entry.assortment !== "string" || !["A", "B", "C", "D", "K"].includes(entry.grade) ||
                !Number.isFinite(entry.diameter) || entry.diameter <= 0 || entry.diameter > 1000 ||
                !Number.isFinite(entry.length) || entry.length <= 0 || entry.length > 1000 ||
                (entry.barkDeductionCm !== undefined && !hasBark(entry)))
            {
                return false;
            }
            entryIds.add(entry.id);
            return true;
        });
        if (!validEntries)
        {
            return false;
        }
        try
        {
            normalizeNumbers(list);
            return true;
        }
        catch (error)
        {
            return false;
        }
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

let importNumbering = null;
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
    const data = {format : exchangeFormat, version : 2, exportedAt : new Date().toISOString(), lists : selectedLists(), nextByPolter};
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
    importNumbering = null;
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
        importNumbering = data.nextByPolter && typeof data.nextByPolter === "object" && !Array.isArray(data.nextByPolter) ? data.nextByPolter : null;
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
    const seen = new Set();
    for (const list of lists)
    {
        for (const entry of list.entries)
        {
            seen.add(JSON.stringify([polterKey(entry.polter), entry.number]));
        }
    }
    for (const list of added)
    {
        for (const entry of list.entries)
        {
            const key = JSON.stringify([polterKey(entry.polter), entry.number]);
            if (seen.has(key))
            {
                element("import-status").textContent = `Import nicht möglich: Stammnummer ${entry.number} ist im Polter „${entry.polter}“ bereits vorhanden. Bitte vor dem Import prüfen und ändern.`;
                return;
            }
            seen.add(key);
        }
    }
    lists.push(...added);
    if (importNumbering)
    {
        const keys = new Set(added.flatMap((list) => list.entries.map((entry) => polterKey(entry.polter))));
        for (const key of keys)
        {
            const candidate = importNumbering[key];
            if (Number.isSafeInteger(candidate) && candidate >= 1 && candidate <= 1000000001)
            {
                nextByPolter[key] = Math.max(nextByPolter[key] || 1, candidate);
            }
        }
    }
    save();
    render();
    element("import-status").textContent = storageAvailable ? `${added.length} ${added.length === 1 ? "Liste importiert" : "Listen importiert"}.` : "Import nur vorübergehend vorhanden: Speichern auf diesem Gerät nicht möglich.";
    element("import-preview").hidden = true;
    element("import-file").value = "";
});
