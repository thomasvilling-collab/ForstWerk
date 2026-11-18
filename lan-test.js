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

function lanProbeUrl(address, code)
{
    const trimmed = address.trim();
    const url = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    if (url.protocol !== "http:" || !isPrivateIpv4(url.hostname) || !url.port ||
        url.username || url.password || !/^([0-9a-f]{8})$/i.test(code))
    {
        throw new Error("Bitte eine private IPv4-Adresse mit Port und den achtstelligen Testcode eingeben.");
    }
    const result = new URL(`/forstwerk-test?code=${code.toLowerCase()}`, url.origin);
    return result.toString();
}

function decodeLanQr(value)
{
    try
    {
        const url = new URL(value);
        const code = url.searchParams.get("code") || "";
        if (url.pathname !== "/forstwerk-test" || url.username || url.password ||
            url.searchParams.getAll("code").length !== 1)
        {
            return null;
        }
        const endpoint = lanProbeUrl(url.toString(), code);
        return {address : new URL(endpoint).origin, code : code.toLowerCase()};
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
                    element("lan-code").value = parsed.code;
                    element("lan-test-status").textContent = "";
                    element("lan-diagnostic").hidden = true;
                    stopLanScan();
                    element("lan-scan-status").textContent = "QR-Code erkannt. Zum Testen bitte auf „Verbindung prüfen“ tippen.";
                    return;
                }
                element("lan-scan-status").textContent = "Dieser QR-Code enthält keine gültige BelegWerk-Testadresse.";
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
        element("lan-diagnostic").hidden = true;
    });
}

element("lan-test-button").addEventListener("click", async () => {
    const status = element("lan-test-status");
    const diagnostic = element("lan-diagnostic");
    diagnostic.hidden = true;
    let endpoint;
    try
    {
        const address = element("lan-address").value;
        let code = element("lan-code").value.trim();
        if (!code && address.includes("?"))
        {
            code = new URL(address.trim()).searchParams.get("code") || "";
            element("lan-code").value = code;
        }
        endpoint = lanProbeUrl(address, code);
    }
    catch (error)
    {
        status.textContent = "Bitte eine Adresse wie 192.168.1.20:54321 und den achtstelligen Testcode aus BelegWerk eingeben.";
        return;
    }
    diagnostic.href = endpoint;
    diagnostic.hidden = false;
    const button = element("lan-test-button");
    button.disabled = true;
    status.textContent = "Verbindung wird geprüft …";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try
    {
        const response = await fetch(endpoint, {method : "GET", mode : "cors", cache : "no-store", signal : controller.signal});
        if (!response.ok)
        {
            throw new Error("HTTP-Fehler");
        }
        const data = await response.json();
        if (!data || data.service !== "belegwerk-connect-test" ||
            data.code !== element("lan-code").value.trim().toLowerCase())
        {
            throw new Error("Ungültige Antwort");
        }
        status.textContent = "Verbindung erfolgreich: ForstWerk hat den Testdienst von BelegWerk erreicht.";
    }
    catch (error)
    {
        status.textContent = "Keine direkte Verbindung. Prüfe WLAN, Adresse, Testcode und Windows-Firewall. Der Browser kann zudem den Zugriff von HTTPS auf lokales HTTP blockieren. Die Testadresse unten hilft bei der Eingrenzung.";
    }
    finally
    {
        clearTimeout(timeout);
        button.disabled = false;
    }
});
