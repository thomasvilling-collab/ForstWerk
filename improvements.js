"use strict";

const backupKey = "forstwerk.sicherung.gestartet";

function updateBackupReminder()
{
    const label = element("backup-reminder");
    if (!lists.some((list) => list.entries.length || (list.locations && list.locations.length)))
    {
        label.textContent = "Sichere deine Listen regelmäßig als JSON-Datei.";
        return;
    }
    let last = 0;
    try
    {
        last = Number(localStorage.getItem(backupKey)) || 0;
    }
    catch (error)
    {
        label.textContent = "Sicherungszeitpunkt nicht verfügbar. Bitte regelmäßig sichern.";
        return;
    }
    if (!last || Date.now() - last >= 7 * 24 * 60 * 60 * 1000 || last > Date.now())
    {
        label.textContent = "Bitte alle Listen sichern und die Dateiablage prüfen.";
    }
    else
    {
        label.textContent = `Sicherung zuletzt gestartet: ${new Date(last).toLocaleDateString("de-DE")} · Dateiablage prüfen`;
    }
}

function renderSummary()
{
    const target = element("summary-content");
    target.replaceChildren();
    const reviewed = entries.filter(hasBark);
    if (!reviewed.length)
    {
        appendText(target, "p", "Noch keine Stämme mit geprüftem Rindenabzug für die Auswertung vorhanden.", "list-hint");
        return;
    }
    [["Stärkeklasse", "strength"], ["Holzart", "species"], ["Güte", "grade"], ["Sortiment", "assortment"]].forEach(([title, key]) => {
        appendText(target, "h3", title);
        const groups = new Map();
        reviewed.forEach((entry) => {
            const name = key === "strength" ? strengthClass(netDiameter(entry)) : entry[key];
            const current = groups.get(name) || {count : 0, volume : 0};
            current.count++;
            current.volume += stemVolume(entry);
            groups.set(name, current);
        });
        const table = document.createElement("table");
        table.className = "summary-table";
        const header = table.createTHead().insertRow();
        [title, "Stämme", "fm"].forEach((value) => appendText(header, "th", value));
        const body = table.createTBody();
        Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "de"))
            .forEach(([name, value]) => {
                const row = body.insertRow();
                [name, String(value.count), formatter.format(value.volume)].forEach((cell) => appendText(row, "td", cell));
            });
        target.append(table);
    });
    appendText(target, "h3", "Stärke · Holzart · Güte · Sortiment");
    const table = document.createElement("table");
    table.className = "summary-table";
    const header = table.createTHead().insertRow();
    ["Sortierung", "Stämme", "fm"].forEach((label) => appendText(header, "th", label));
    const body = table.createTBody();
    pricingTotals(reviewed).forEach((total) => {
        const row = body.insertRow();
        [total.values.join(" · "), String(total.count), formatter.format(total.volume)]
            .forEach((value) => appendText(row, "td", value));
    });
    target.append(table);
}

function renderBarkReview()
{
    const pending = entries.filter((entry) => !hasBark(entry));
    element("review-bark").hidden = !pending.length;
    if (!pending.length)
    {
        element("review-bark").open = false;
    }
    const target = element("review-bark-rows");
    target.replaceChildren();
    pending.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "review-bark-row";
        row.dataset.id = entry.id;
        const label = document.createElement("label");
        const check = document.createElement("input");
        check.type = "checkbox";
        label.append(check);
        const text = document.createElement("span");
        text.textContent = `Stamm ${entry.number} · ${entry.species} · MD ${entry.diameter.toLocaleString("de-DE")} cm`;
        label.append(text);
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "decimal";
        input.setAttribute("aria-label", `Rindenabzug in cm für Stamm ${entry.number}`);
        input.placeholder = "Abzug cm";
        const suggestion = suggestedBark(entry.species, entry.diameter);
        if (suggestion !== null && isBarkOrientation(entry.species))
        {
            input.placeholder = `Richtwert ${suggestion} cm`;
            input.title = entry.species === "Kiefer" ? "Orientierungswert; bei Spiegelrinde 1 cm. Bitte selbst prüfen und eingeben." : "Orientierungswert, keine pauschale Anwendung. Bitte selbst prüfen und eingeben.";
        }
        else
        {
            input.value = suggestion === null ? "" : String(suggestion);
        }
        row.append(label, input);
        target.append(row);
    });
}

element("select-bark").addEventListener("click", () => {
    element("review-bark-rows").querySelectorAll('input[type="checkbox"]').forEach((box) => {
        box.checked = true;
    });
});
element("apply-bark").addEventListener("click", () => {
    if (editingId || fields.diameter.value.trim())
    {
        element("review-bark-status").textContent = "Bitte die begonnene Stammerfassung zuerst speichern oder abbrechen.";
        return;
    }
    const updates = [];
    const rows = element("review-bark-rows").querySelectorAll(".review-bark-row");
    for (const row of rows)
    {
        if (!row.querySelector('input[type="checkbox"]').checked)
        {
            continue;
        }
        const entry = entries.find((item) => item.id === row.dataset.id);
        const bark = parseBark(row.querySelector('input[type="text"]').value);
        if (!entry || bark === null || bark >= entry.diameter)
        {
            element("review-bark-status").textContent = "Bitte für jeden markierten Stamm einen gültigen Abzug kleiner als den Mittendurchmesser eingeben.";
            return;
        }
        updates.push({entry, bark});
    }
    if (!updates.length)
    {
        element("review-bark-status").textContent = "Bitte mindestens einen Stamm markieren.";
        return;
    }
    if (!window.confirm(`Rindenabzug für ${updates.length} Stämme übernehmen und Festmeter neu berechnen?`))
    {
        return;
    }
    updates.forEach((update) => {
        update.entry.barkDeductionCm = update.bark;
    });
    save();
    render();
    element("review-bark-status").textContent = storageAvailable && !storageBlocked ?
        `${updates.length} Stämme umgestellt.` : "Änderung nur vorübergehend vorhanden; Speicherung fehlgeschlagen.";
});

function showSettings()
{
    element("next-focus").value = nextFocus;
    element("diameter-min").value = String(limits.diameterMin).replace(".", ",");
    element("diameter-max").value = String(limits.diameterMax).replace(".", ",");
    element("length-min").value = String(limits.lengthMin).replace(".", ",");
    element("length-max").value = String(limits.lengthMax).replace(".", ",");
}

element("save-settings").addEventListener("click", () => {
    const candidate = {diameterMin : parseNumber(element("diameter-min").value),
        diameterMax : parseNumber(element("diameter-max").value),
        lengthMin : parseNumber(element("length-min").value),
        lengthMax : parseNumber(element("length-max").value)};
    if (!validLimits(candidate))
    {
        element("settings-status").textContent = "Bitte gültige Grenzen zwischen 0 und 1000 eingeben; der Anfang muss kleiner als das Ende sein.";
        return;
    }
    limits = candidate;
    nextFocus = element("next-focus").value;
    save();
    element("settings-status").textContent = storageAvailable && !storageBlocked ? "Einstellungen gespeichert." : "Einstellungen nur vorübergehend vorhanden.";
});
element("backup-all").addEventListener("click", () => {
    if (storageBlocked)
    {
        element("backup-reminder").textContent = "Sicherung nicht möglich: Vorhandene Browserdaten konnten nicht gelesen werden.";
        return;
    }
    save();
    const data = {format : exchangeFormat, version : 2, exportedAt : new Date().toISOString(), lists};
    const now = new Date();
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    downloadFile(`ForstWerk-Sicherung-${day}.json`, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
    try
    {
        localStorage.setItem(backupKey, String(now.getTime()));
    }
    catch (error)
    {
        element("backup-reminder").textContent = "Sicherung gestartet – bitte die Dateiablage prüfen.";
        return;
    }
    updateBackupReminder();
});
showSettings();
renderSummary();
renderBarkReview();
updateBackupReminder();
