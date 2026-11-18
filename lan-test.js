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
