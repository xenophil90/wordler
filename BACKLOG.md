# Backlog

Ideen und offene Punkte für wordler. Nichts davon ist aktuell in Arbeit; die
Reihenfolge innerhalb der Abschnitte ist grob nach Nutzen sortiert.

## Als Nächstes

- [ ] **Begriffe zusammenfassen (Aliase).** In der Begriffstabelle mehrere Einträge
  auf einen Namen ziehen: „Bericht", „Berichte", „Report" werden ein Begriff, die
  Häufigkeiten addieren sich. Der größte Qualitätshebel überhaupt — halbherzig
  getrennte Schreibweisen sind der häufigste Grund für unbrauchbare Wolken.
- [ ] **Begriffe umbenennen und Gewicht direkt überschreiben.** Heute lassen sich
  Begriffe nur abwählen. Ein editierbares Feld in der Tabelle ersetzt das
  Nachbearbeiten der Quelldatei.
- [ ] **Zustand in der URL.** Alle Einstellungen (ohne Daten) in den Hash schreiben,
  damit ein Link die Konfiguration mitbringt. Presets als Datei gibt es bereits,
  ein Link ist der kürzere Weg.
- [ ] **Layout im Web Worker.** Bei 300 Begriffen und mehreren Auto-Fit-Durchläufen
  blockiert der Hauptthread sichtbar. Ein Worker macht die Vorschau flüssig und
  erlaubt einen Fortschrittsbalken.
- [ ] **Schrift in den SVG-Export einbetten.** Ohne installierte Inter fällt ein
  exportiertes SVG auf eine Systemschrift zurück und die Wörter überlappen. Ein
  eingebetteter WOFF2-Subset in `@font-face` löst das; Alternative: Text zu
  Pfaden wandeln.

## Eingabe & Daten

- [ ] Mehrere Dateien gleichzeitig ablegen und zusammenführen (Summe je Begriff).
- [ ] Direkter Import aus der Zwischenablage, inklusive aus Excel kopierter Tabellen.
- [ ] `.xlsx` lesen (ohne Bibliothek: ZIP + `sheet1.xml` reicht für einfache Mappen).
- [ ] Spaltenzuordnung merken, wenn dieselben Spaltennamen wieder auftauchen.
- [ ] Dritte Zahlenspalte als Zeitachse: Wolken je Periode und ein Vorher-Nachher-Vergleich.
- [ ] Zeilenlimit mit Hinweis statt stiller Kappung bei 300 Begriffen.

## Analyse & Sprache

- [ ] Stemming/Lemmatisierung für Deutsch und Englisch (Porter/Snowball, eigene
  Implementierung), abschaltbar — automatisches Zusammenfassen ist bequem, aber
  fehleranfällig, deshalb nie als Vorgabe.
- [ ] Weitere Stoppwortlisten (FR, ES, IT, NL) plus Auto-Erkennung der Textsprache.
- [ ] Stoppwörter aus der Wolke heraus entfernen: Klick auf ein Wort in der Vorschau
  wirft es raus.
- [ ] TF-IDF-Gewichtung gegen einen Referenztext — hebt hervor, was *diesen* Text
  auszeichnet, statt was in jedem Text häufig ist.
- [ ] Wortarten filtern (nur Substantive) — braucht ein kleines Wörterbuch, lohnt
  aber besonders bei Freitext aus Interviews.

## Layout & Darstellung

- [ ] Weitere Formen: Wolke, Sprechblase, Pfeil, Kreisring, Text als Form
  („2026" als Maske aus einer Schrift).
- [ ] Wörter nach dem Layout per Maus verschieben und die Position sperren.
- [ ] Zeilen-Layout als Alternative zur Spirale: gleichmäßige Blocksatz-Wolke, wie
  sie in Berichten oft besser aussieht als eine runde Wolke.
- [ ] Umriss- und Schattenoptionen für Wörter (Lesbarkeit auf unruhigem Hintergrund).
- [ ] Hintergrundbild statt Farbe, mit Abdunkelung.
- [ ] Eigene Palette anlegen und speichern; Farben aus einem hochgeladenen Bild ziehen.
- [ ] Kontrastprüfung: Wörter melden, deren Farbe auf dem Hintergrund unter 4,5:1 liegt.
- [ ] Legende unter der Wolke: Schriftgröße ↔ Score, damit ein Bericht die Skala mitliefert.

## Export & Weitergabe

- [ ] PDF-Export (Vektor, druckfähig, definierte Seitengröße in mm).
- [ ] Freie Exportgröße in Pixeln statt fester 1×–4×-Stufen.
- [ ] Mehrere Formate auf einmal als ZIP.
- [ ] Datenexport der berechneten Werte als CSV (Begriff, Anzahl, Gewicht, Score,
  Schriftgröße) — für die Tabelle neben dem Bild im Bericht.
- [ ] Animierter Aufbau als kurzes Video/GIF für Präsentationen.

## Bedienung & Zugänglichkeit

- [ ] Vorher-Nachher-Ansicht: zwei Einstellungen nebeneinander vergleichen.
- [ ] Undo/Redo für Einstellungsänderungen.
- [ ] Zuletzt genutzte Einstellungen automatisch merken (heute nur die Sprache).
- [ ] Vollständiger Screenreader-Durchlauf mit NVDA und VoiceOver; die Vorschau
  braucht eine sinnvollere Alternativbeschreibung als die ersten zwölf Begriffe.
- [ ] Tastenkürzel: Export, Neu würfeln, Panel auf/zu.
- [ ] Helles Farbschema für die Oberfläche (heute nur dunkel).

## Technik & Qualität

- [ ] Layout-Tests mit echtem Canvas (Playwright) im CI, inklusive Vergleichsbildern.
- [ ] Kollisionsprüfung auf 32-Bit-Wortmasken umstellen; bei sehr dichten Wolken
  ist das spürbar schneller als der heutige Byte-Vergleich.
- [ ] Speicherobergrenze für den Export prüfen: 8000 px lange Kante sind auf
  Mobilgeräten teils zu viel.
- [ ] Service Worker für echte Offline-Nutzung inklusive Installation als App.
- [ ] Ausgabegröße der Maske an die Wolkenfläche koppeln statt fester 3-px-Zellen —
  bei sehr kleinen Formaten ist das Raster heute zu grob.

## Bewusst nicht geplant

- Konten, Serverspeicher, Kollaboration in Echtzeit. Die Anwendung bleibt clientseitig.
- Automatische Übersetzung der Begriffe.
- KI-generierte Begriffe: eine Wolke soll zeigen, was in den Daten steht, nicht was
  ein Modell dazu ergänzt.
