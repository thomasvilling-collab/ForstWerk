# ForstWerk – erste Oberfläche

## WLAN-Verbindungstest

In BelegWerk das gewünschte Angebot oder den Auftrag öffnen und „Per WLAN empfangen …“ wählen. In ForstWerk „QR-Code scannen“ wählen und die Kameraberechtigung freigeben. Nach dem Einlesen werden Adresse und einmaliger Code eingetragen. Mit „Ausgewählte Holzliste(n) senden“ wird die Auswahl aus dem Exportbereich an BelegWerk übertragen. Dort erscheint die vorhandene Vorschau; erst nach Auswahl, Preisangabe und Bestätigung werden Positionen in den aktuellen Entwurf übernommen. Die Übertragung läuft unverschlüsselt über HTTP und ist nur für ein vertrauenswürdiges WLAN gedacht. Die Kamera wird nach dem Einlesen, beim Schließen oder beim Verlassen der App gestoppt. Bei fehlender Kamerafreigabe können Adresse und Code von Hand eingetragen werden. Der Scan verwendet die lokal mitgelieferte Bibliothek jsQR 1.4.0 (Apache-2.0; Lizenz in `vendor/jsQR-LICENSE.txt`); es wird kein Scan-Dienst im Internet verwendet.

Das FW-Symbol wird über das Manifest und `apple-touch-icon` bereitgestellt. Vor dem Entfernen oder erneuten Hinzufügen eines Home-Bildschirm-Symbols Holzlisten als JSON sichern: Die eigenständige App und Safari können getrennte Speicher haben. Für die Veröffentlichung auch die drei `icon-*.png` und den Ordner `vendor` hochladen.

Die WLAN-Empfangsseite in BelegWerk bleibt während der Übertragung geöffnet. Den Netzwerkadapter auswählen, über den der PC im gleichen WLAN erreichbar ist. Der einmalige Code ist nur aktiv, solange der Empfangsdialog geöffnet ist. Die iPhone-Web-App sendet die JSON-Daten in einer vom Nutzer gestarteten Formularnavigation; dadurch ist kein CORS- oder HTTPS-zu-HTTP-`fetch` nötig. Die Antwort erscheint in einem neuen Browserfenster, während BelegWerk die geprüfte Importvorschau öffnet.

Bei Fehlschlag Netzwerk, ausgewählte PC-Adresse und Windows-Firewall prüfen. Den BelegWerk-Empfangsdienst nur für ein privates, vertrauenswürdiges Netzwerk zulassen; die Windows-Firewall nicht vollständig ausschalten. Die Übertragung auf dem tatsächlichen iPhone prüfen. Der Testcode ist eine kurzfristige Zugriffssperre, aber keine Verschlüsselung oder sichere Anmeldung.

Stammnummern werden je Polter automatisch vorgeschlagen und können manuell geändert werden. Nach einer Eingabe läuft die Nummerierung dort weiter. Gleich benannte Polter gelten über alle Listen auf diesem Gerät als derselbe Polter; Groß- und Kleinschreibung sowie Leerzeichen am Rand werden ignoriert. Die gleiche Nummer kann in verschiedenen Poltern vorkommen. Unabhängige Geräte können offline nicht gegenseitig auf doppelte Nummern prüfen; beim Zusammenführen wird auf Konflikte geprüft.

Die Auswertung der aktiven Holzliste kann direkt unter der Auswertung separat gedruckt oder über den Druckdialog als PDF gespeichert werden. Stämme ohne geprüften Rindenabzug werden ausgewiesen, aber nicht in den Summen berücksichtigt.

## Stärkeklassen und Rindenabzug

Der Mittendurchmesser wird mit Rinde eingegeben. Für Fichte, Tanne, Douglasie, Buche und Esche schlägt ForstWerk einen Rindenabzug vor (Anlage VII RVR 2024); dieser ist vor dem Speichern zu prüfen und kann überschrieben werden. Der Vorschlag verwendet den auf ganze Zentimeter abgerundeten Messwert zur Auswahl der Tabellenstufe. Für Kiefer, Eiche und Lärche zeigt ForstWerk die Tabellenwerte lediglich als Orientierung: Der Abzug muss geprüft und selbst eingegeben werden. Bei Kiefer mit Spiegelrinde gilt unabhängig vom Durchmesser 1 cm. Für gemischte oder andere Holzarten ist der Abzug manuell einzugeben. Abzug 0 ist ausdrücklich möglich.

Der eingegebene Messwert abzüglich des geprüften Abzugs ergibt den Durchmesser ohne Rinde. Dieser wird für die Klasse und die Zylinderformel verwendet; es gibt keine zusätzliche Rundung des Durchmessers für das angezeigte Volumen. Klassen: 0 unter 10 cm, 1a 10–unter 15, 1b 15–unter 20, 2a 20–unter 25, 2b 25–unter 30, 3a 30–unter 35, 3b 35–unter 40, 4 40–unter 50, 5 50–unter 60, 6 60–unter 70, 7 70–unter 80 und 8 ab 80 cm. Eine vollständige RVR-Abrechnung einschließlich Längenübermaß, Mess- und Rundungsregeln ist nicht umgesetzt.

Alte Stämme bleiben ohne Rindenabzug gespeichert, bis sie einzeln oder über „Bisherige Stämme auf Rindenabzug prüfen“ geprüft und bestätigt werden. Ungeprüfte Stämme stehen nicht in der Summe ohne Rinde und können in BelegWerk nicht preislich übernommen werden. Die Auswertung sowie CSV und PDF zeigen Stärkeklassen und Festmeter; zusätzlich gibt es eine Aufstellung nach Klasse, Holzart, Güte und Sortiment. Die JSON-Version 2 überträgt den geprüften Abzug. Ältere Version-1-Dateien bleiben einlesbar und gelten ohne Abzug als ungeprüft. Beim Update alle Programmdateien einschließlich `strength.js` hochladen.

Diese erste Version zeigt die Stammholzaufnahme mit mehreren Holzlisten. Listen lassen sich anlegen, auswählen, umbenennen und löschen. Jede Liste enthält eigene Stämme und Voreinstellungen. Eine Aufnahme aus der ersten Version erscheint als „Holzliste 1“ und kann umbenannt werden. Die Eingaben werden lokal im Speicher des verwendeten Browsers gehalten. Sie sind an den jeweiligen Browser und die Adresse gebunden.

## Lokal am Windows-PC ausprobieren

In diesem Ordner ein Terminal öffnen und starten:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Dann auf demselben PC `http://localhost:8000` im Browser öffnen. Zum Beenden im Terminal `Strg+C` drücken.

ForstWerk kann nach einmaligem Laden über HTTPS offline verwendet werden. Der Import in BelegWerk ist noch nicht umgesetzt. Browserdaten können gelöscht werden; die lokale Speicherung ersetzt keine Datensicherung.

## Offline und Updates

Alle Programmdateien einschließlich `improvements.js`, `offline.js`, `service-worker.js` und `manifest.webmanifest` gemeinsam auf GitHub Pages hochladen. Vor der Umstellung vorhandene Holzlisten als JSON sichern: Safari und eine über den Home-Bildschirm geöffnete App können getrennte Speicher verwenden. Die Offline-Einrichtung in der tatsächlich genutzten Ansicht bei bestehender Internetverbindung abwarten; bei entsprechender Aufforderung die App schließen und wieder öffnen. Erst bei „Offline bereit auf diesem Gerät“ ohne Netz testen. Der Status „Gerät meldet online“ bestätigt nicht, dass tatsächlich Internet erreichbar ist.

Bei einem Update erscheint ein Button. Angefangene Stammdaten, Standortänderungen und Importe vorher abschließen; geöffnete andere Fenster ebenfalls sichern. Für jede neue Veröffentlichung die Versionsnummer in `service-worker.js` und in `index.html` erhöhen, damit das neue Dateipaket vollständig heruntergeladen wird. Änderungen an den Programmdateien und am Service Worker zusammen veröffentlichen. Karten, Cloud-Übertragung und Updateprüfung benötigen Internet. GPS hängt vom Gerät und Empfang ab. Die WLAN-Übertragung muss auf dem echten iPhone geprüft werden.

## Export und Import

Unter „Holzlisten exportieren“ kann die aktive Liste, eine Auswahl oder alle Listen als JSON oder CSV exportiert werden. JSON ist die ForstWerk-Sicherung und enthält Listen, Stämme und Voreinstellungen. CSV ist eine UTF-8-Tabelle mit Semikolon und Dezimalkomma für Tabellenprogramme. Exportiert werden gespeicherte Stämme; angefangene Eingaben vorher speichern. Für PDF „PDF / Drucken“ wählen und im Druckdialog als PDF speichern.

In CSV und PDF stehen Polter und Sortiment im Kopf des jeweiligen Abschnitts. Enthält eine Liste verschiedene Polter oder Sortimente, wird für jede Kombination ein Abschnitt ausgegeben. Das berechnete Volumen wird als fm angezeigt.

Stammnummern gelten innerhalb einer Liste, bleiben beim Bearbeiten erhalten und werden nach dem Löschen nicht erneut vergeben. Alte Listen werden beim ersten Laden in ihrer damaligen Reihenfolge nummeriert. Für ungewöhnliche Maße gelten einstellbare Hinweisgrenzen; nach Bestätigung können sie gespeichert werden. „Alle Listen sichern“ startet den Download einer JSON-Datei; die erfolgreiche Ablage der Datei muss geprüft werden. Der Sicherungshinweis erinnert nach sieben Tagen erneut.

## Polterstandorte

Zu jeder Polterbezeichnung innerhalb einer Holzliste kann optional ein Standort eingegeben oder mit „Standort übernehmen“ ermittelt werden. Dieselbe Bezeichnung in einer anderen Holzliste hat einen eigenen Standort. Zum Übernehmen muss die Browserfreigabe für den Standort erteilt sein. Auf dem iPhone benötigt die Standortermittlung eine geeignete HTTPS-Adresse; `localhost` eignet sich für lokale Tests am PC. Ohne Verbindung können Koordinaten von Hand eingegeben werden. Der Kartenlink benötigt eine Verbindung. Standorte werden mit der JSON-Liste gesichert und in CSV und PDF ausgegeben, sofern vorhanden.

Beim JSON-Import zeigt eine Vorschau die verfügbaren Listen. Ausgewählte neue Listen werden zusätzlich angelegt; vorhandene Listen mit gleicher Kennung werden nicht überschrieben oder erneut importiert. Ein Import in BelegWerk ist noch nicht umgesetzt.

Das angezeigte Volumen ist das rechnerische Zylindervolumen anhand von Mittendurchmesser und Länge. Vorgaben für kaufmännische Rundung, Stärkeklassen und die BelegWerk-Übernahme sind noch festzulegen.
