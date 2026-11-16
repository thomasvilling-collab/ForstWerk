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
    if (!entries.length)
    {
        appendText(target, "p", "Noch keine Stämme für die Auswertung vorhanden.", "list-hint");
        return;
    }
    [["Holzart", "species"], ["Güte", "grade"], ["Sortiment", "assortment"]].forEach(([title, key]) => {
        appendText(target, "h3", title);
        const groups = new Map();
        entries.forEach((entry) => {
            const current = groups.get(entry[key]) || {count : 0, volume : 0};
            current.count++;
            current.volume += volumeOf(entry.diameter, entry.length);
            groups.set(entry[key], current);
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
}

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
    const data = {format : exchangeFormat, version : 1, exportedAt : new Date().toISOString(), lists};
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
updateBackupReminder();
