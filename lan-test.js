"use strict";

function isPrivateIpv4(hostname)
{
    const pieces = hostname.split(".");
    if (pieces.length !== 4 || pieces.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255))
    {
        return false;
    }
    const first = Number(pieces[0]);
    const second = Number(pieces[1]);
    return first === 10 || (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168);
}

function lanProbeUrl(address, code, path = "/forstwerk-test")
{
    const trimmed = address.trim();
    const url = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    if (url.protocol !== "http:" || !isPrivateIpv4(url.hostname) || !url.port ||
        url.username || url.password || !/^([0-9a-f]{16})$/i.test(code) ||
        !["/forstwerk-test", "/forstwerk-import", "/beleg-import"].includes(path))
    {
        throw new Error("Bitte eine private IPv4-Adresse mit Port und den 16-stelligen Code eingeben.");
    }
    const result = new URL(`${path}?code=${code.toLowerCase()}`, url.origin);
    return result.toString();
}

function decodeLanQr(value)
{
    try
    {
        const url = new URL(value);
        const code = url.searchParams.get("code") || "";
        if (!["/forstwerk-test", "/forstwerk-import", "/beleg-import"].includes(url.pathname) || url.username || url.password ||
            url.searchParams.getAll("code").length !== 1)
        {
            return null;
        }
        const endpoint = lanProbeUrl(url.toString(), code);
        return {address : new URL(endpoint).origin, code : code.toLowerCase(), path : url.pathname};
    }
    catch (error)
    {
        return null;
    }
}

let scanStream = null;
let scanFrame = 0;
let scanGeneration = 0;
let lastScanTime = 0;

function stopLanScan()
{
    scanGeneration++;
    if (scanFrame)
    {
        cancelAnimationFrame(scanFrame);
        scanFrame = 0;
    }
    if (scanStream)
    {
        scanStream.getTracks().forEach((track) => track.stop());
        scanStream = null;
    }
    const video = element("lan-scan-video");
    video.pause();
    video.srcObject = null;
    video.hidden = true;
    element("lan-scan-stop").hidden = true;
    element("lan-scan-start").disabled = false;
}

function readLanFrame(timestamp)
{
    if (!scanStream)
    {
        return;
    }
    const video = element("lan-scan-video");
    if (timestamp - lastScanTime >= 150 && video.readyState >= 2 && video.videoWidth && video.videoHeight)
    {
        lastScanTime = timestamp;
        try
        {
            const canvas = element("lan-scan-canvas");
            canvas.width = Math.min(video.videoWidth, 960);
            canvas.height = Math.round(video.videoHeight * canvas.width / video.videoWidth);
            const context = canvas.getContext("2d", {willReadFrequently : true});
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(image.data, image.width, image.height, {inversionAttempts : "attemptBoth"});
            if (found)
            {
                const parsed = decodeLanQr(found.data);
                if (parsed)
                {
                    element("lan-address").value = parsed.address;
                    element("lan-address").dataset.scannedPath = parsed.path;
                    element("lan-code").value = parsed.code;
                    element("lan-test-status").textContent = "";
                    stopLanScan();
                    element("lan-scan-status").textContent = parsed.path === "/beleg-import"
                        ? "Beleg-Empfang erkannt. Belegfotos aufnehmen und auf „Belegfotos an BelegWerk senden“ tippen."
                        : "Holzlisten-Empfang erkannt. Zum Übertragen auf „Ausgewählte Holzliste(n) senden“ tippen.";
                    return;
                }
                element("lan-scan-status").textContent = "Dieser QR-Code enthält keine gültige BelegWerk-WLAN-Adresse.";
            }
        }
        catch (error)
        {
            stopLanScan();
            element("lan-scan-status").textContent = "Der QR-Code konnte nicht gelesen werden. Bitte Adresse und Code von Hand eingeben.";
            return;
        }
    }
    scanFrame = requestAnimationFrame(readLanFrame);
}

element("lan-scan-start").addEventListener("click", async () => {
    const status = element("lan-scan-status");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof jsQR !== "function")
    {
        status.textContent = "Kamera-Scan nicht verfügbar. Bitte Adresse und Code von Hand eingeben.";
        return;
    }
    const generation = ++scanGeneration;
    element("lan-scan-start").disabled = true;
    status.textContent = "Kamera wird geöffnet …";
    try
    {
        const stream = await navigator.mediaDevices.getUserMedia({video : {facingMode : {ideal : "environment"}}, audio : false});
        if (generation !== scanGeneration || document.hidden)
        {
            stream.getTracks().forEach((track) => track.stop());
            return;
        }
        scanStream = stream;
        const video = element("lan-scan-video");
        video.srcObject = stream;
        video.hidden = false;
        element("lan-scan-stop").hidden = false;
        await video.play();
        if (generation !== scanGeneration || document.hidden)
        {
            stopLanScan();
            return;
        }
        status.textContent = "Kamera auf den QR-Code in BelegWerk richten.";
        lastScanTime = 0;
        scanFrame = requestAnimationFrame(readLanFrame);
    }
    catch (error)
    {
        stopLanScan();
        status.textContent = "Kamera nicht verfügbar oder Zugriff abgelehnt. Bitte die Berechtigung prüfen oder Adresse und Code von Hand eingeben.";
    }
});
element("lan-scan-stop").addEventListener("click", () => {
    stopLanScan();
    element("lan-scan-status").textContent = "Kamera geschlossen.";
});
window.addEventListener("pagehide", stopLanScan);
document.addEventListener("visibilitychange", () => {
    if (document.hidden)
    {
        stopLanScan();
    }
});
for (const field of [element("lan-address"), element("lan-code")])
{
    field.addEventListener("input", () => {
        element("lan-test-status").textContent = "";
        if (field.id === "lan-address")
        {
            delete field.dataset.scannedPath;
        }
    });
}

function sendLanPayload(path, payload, status, label)
{
    const address = element("lan-address").value;
    let endpoint;
    try { endpoint = lanProbeUrl(address, element("lan-code").value.trim(), path); }
    catch (error) { status.textContent = error.message || "WLAN-Adresse oder Code ungültig."; return; }
    const form = document.createElement("form");
    form.method = "POST"; form.action = endpoint; form.enctype = "application/x-www-form-urlencoded";
    form.target = "_blank"; form.referrerPolicy = "no-referrer"; form.setAttribute("rel", "noopener noreferrer"); form.hidden = true;
    const field = document.createElement("input"); field.type = "hidden"; field.name = "payload"; field.value = payload;
    form.append(field); document.body.append(form); status.textContent = `${label} wird an BelegWerk gesendet …`;
    form.submit(); form.remove();
}

element("lan-send-button").addEventListener("click", () => {
    const status = element("lan-test-status");
    let endpoint;
    let payload;
    try
    {
        const addressField = element("lan-address");
        const address = addressField.value;
        const code = element("lan-code").value.trim();
        if (addressField.dataset.scannedPath && addressField.dataset.scannedPath !== "/forstwerk-import")
        {
            throw new Error("Bitte den QR-Code aus „Per WLAN empfangen …“ im gewünschten BelegWerk-Dokument scannen.");
        }
        if (!code && address.includes("?"))
        {
            const scanned = new URL(address.trim());
            if (scanned.pathname !== "/forstwerk-import")
            {
                throw new Error("Bitte den WLAN-Empfang in BelegWerk öffnen und dessen QR-Code scannen.");
            }
            element("lan-code").value = scanned.searchParams.get("code") || "";
        }
        const effectiveCode = element("lan-code").value.trim();
        endpoint = lanProbeUrl(address, effectiveCode, "/forstwerk-import");
        if (!canExport())
        {
            return;
        }
        save();
        const data = {format : exchangeFormat, version : 2, exportedAt : new Date().toISOString(), lists : selectedLists(), nextByPolter};
        payload = JSON.stringify(data);
        if (new Blob([payload]).size > 10 * 1024 * 1024)
        {
            throw new Error("Die ausgewählten Holzlisten sind größer als 10 MB.");
        }
    }
    catch (error)
    {
        status.textContent = error.message || "Bitte die WLAN-Adresse und den 16-stelligen Code aus BelegWerk prüfen.";
        return;
    }

    sendLanPayload("/forstwerk-import", payload, status, "Holzliste");
});

const receiptFiles = [];
function renderReceiptPhotos()
{
    const target = element("receipt-photo-list");
    target.replaceChildren();
    receiptFiles.forEach((file, index) => {
        const row = document.createElement("div"); row.className = "receipt-photo-row";
        const image = document.createElement("img"); image.src = URL.createObjectURL(file); image.alt = `Seite ${index + 1}`;
        const label = document.createElement("span"); label.textContent = `${index + 1}. ${file.name}`;
        const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Entfernen";
        remove.addEventListener("click", () => { receiptFiles.splice(index, 1); renderReceiptPhotos(); });
        row.append(image, label, remove); target.append(row);
    });
}
element("receipt-photo-input").addEventListener("change", (event) => {
    for (const file of event.target.files || [])
    {
        if (file.type.startsWith("image/")) receiptFiles.push(file);
    }
    event.target.value = "";
    renderReceiptPhotos();
});

element("receipt-send-button").addEventListener("click", async () => {
    const status = element("receipt-send-status");
    if (!receiptFiles.length) { status.textContent = "Bitte zuerst mindestens ein Belegfoto aufnehmen."; return; }
    try
    {
        const files = [];
        let total = 0;
        for (const [index, file] of receiptFiles.entries())
        {
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, 2600 / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close();
            const jpeg = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Ein Foto konnte nicht verarbeitet werden.")), "image/jpeg", 0.9));
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
                reader.onerror = reject; reader.readAsDataURL(jpeg);
            });
            total += Math.ceil(data.length * 3 / 4);
            if (total > 50 * 1024 * 1024) throw new Error("Die Fotos sind zusammen größer als 50 MB.");
            const base = (file.name || `Beleg_${index + 1}`).replace(/\.[^.]*$/, "");
            files.push({name : `${base}.jpg`, data});
        }
        const payload = JSON.stringify({format : "BelegWerk-Receipt", version : 1, files});
        if (new Blob([payload]).size > 52 * 1024 * 1024) throw new Error("Die Fotos sind für die WLAN-Übertragung zu groß.");
        if (element("lan-address").dataset.scannedPath && element("lan-address").dataset.scannedPath !== "/beleg-import")
            throw new Error("Bitte den Beleg-QR-Code in BelegWerk scannen.");
        sendLanPayload("/beleg-import", payload, status, "Belegfotos");
    }
    catch (error) { status.textContent = error.message || "Die Belegfotos konnten nicht vorbereitet werden."; }
});
