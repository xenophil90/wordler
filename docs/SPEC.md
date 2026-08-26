# wordler — Implementierungs-Briefing

Dieses Dokument ist so geschrieben, dass es als **einzelner Auftrag an eine
Programmier-KI** übergeben werden kann. Es beschreibt vollständig, *was* gebaut
wird, *wie* es sich verhält und *woran* Fertigstellung gemessen wird.

---

## 1. Auftrag in einem Satz

Baue **wordler**, eine Web-Applikation, die aus Freitext **oder** aus einer
gewichteten CSV-Tabelle eine Word Cloud erzeugt und diese als normales Bild
(PNG, JPEG, WebP) sowie als Vektor (SVG) exportiert — vollständig im Browser,
ohne Backend, ohne Datenabfluss.

## 2. Nicht verhandelbare Rahmenbedingungen

| Punkt | Vorgabe |
| --- | --- |
| Ausführung | 100 % clientseitig. Kein Server, keine API-Calls, keine Telemetrie. |
| Abhängigkeiten | Keine. Kein npm-Build, kein Framework, kein CDN. Reines HTML/CSS/ES-Module. |
| Deployment | Statisches Hosting (GitHub Pages). `public/` ist das Web-Root. |
| Datenschutz | Eingabedaten verlassen niemals den Browser. Keine Uploads, kein `fetch` nach außen. Per CSP erzwungen. |
| Sprachen | Deutsche und englische Oberfläche, umschaltbar, Auswahl wird gemerkt. |
| Barrierefreiheit | WCAG 2.1/2.2 AA: jedes Bedienelement hat einen zugänglichen Namen, sichtbarer Fokus-Ring, Statusmeldungen über eine Live-Region, Tastaturbedienung durchgängig. |
| Reproduzierbarkeit | Gleiche Eingabe + gleicher Seed = pixelgleiches Ergebnis. |

## 3. Datenmodell

Zwei Eingabewege münden in **eine** interne Struktur:

```js
/** @typedef {{
 *   label: string,      // angezeigter Text
 *   count: number,      // Häufigkeit / Nennungen (roh)
 *   weight: number,     // Priorität / Relevanz (roh, optional)
 *   score: number,      // berechnet, 0..1, bestimmt die Schriftgröße
 *   enabled: boolean    // vom Nutzer abwählbar
 * }} Term */
```

### 3.1 Eingabeweg A — Freitext

Textarea oder `.txt`-Datei. Pipeline: normalisieren → tokenisieren → filtern →
zählen → `count` = Häufigkeit, `weight` = Häufigkeit.

### 3.2 Eingabeweg B — CSV (der wichtigere Fall)

Trennzeichen `,` `;` `\t` werden automatisch erkannt, Kopfzeile ebenfalls.
Referenzschema (Beispieldatei liegt unter `public/samples/topics.csv`, die
Inhalte sind synthetisch):

```csv
Topic,Count,Weight
Planning,8,100
Onboarding,7,95
Documentation,7,88
Reporting,7,82
Automation,6,84
```

- Spalte 1 (Text) → `label`
- Erste numerische Spalte → `count` (Nennungen)
- Zweite numerische Spalte → `weight` (Priorität)

**Wichtig:** Die Spaltenzuordnung ist nicht fest verdrahtet. Nach dem Import
zeigt die UI drei Auswahlfelder (Begriff / Häufigkeit / Gewicht), vorbelegt mit
der Heuristik oben, jederzeit änderbar. Beliebige CSVs mit anderen Spaltennamen
funktionieren dadurch ebenfalls.

### 3.3 Score-Berechnung

Beide Rohgrößen werden getrennt auf 0..1 normiert (min–max über alle aktiven
Terme), dann gemischt:

```
base  = (1 − α) · norm(count) + α · norm(weight)      // α = Regler 0..1
score = shape(base)                                    // linear | sqrt | log | rank
size  = minFontSize + score · (maxFontSize − minFontSize)
```

α ist ein sichtbarer Regler „Nennungen ↔ Priorität". Die aktive Formel wird im
UI im Klartext angezeigt, damit das Ergebnis erklärbar bleibt (Reports!).
`shape` staucht (`log`, `sqrt`) oder spreizt die Verteilung; `rank` ignoriert
Absolutwerte und nutzt nur die Reihenfolge.

## 4. Funktionsumfang V1

### 4.1 Quelldaten
- Tab „Text" / Tab „CSV"
- Drag-&-Drop-Fläche plus Klick-Fallback für `.txt`, `.csv`, `.tsv`
- Button „Beispieldaten laden"
- Fehlerbehandlung: leere Datei, keine numerische Spalte, > 20 MB → verständliche Meldung, kein Absturz

### 4.2 Textanalyse (nur Textmodus)
- Kleinschreibung normalisieren (an/aus)
- Stoppwortlisten Deutsch / Englisch, einzeln zuschaltbar
- Eigene Stoppwörter (kommagetrennt)
- Mindestlänge (1–12 Zeichen)
- Zahlen ausschließen
- N-Gramme: 1 (Wörter) oder 2 (Wortpaare, über Satzgrenzen hinweg getrennt)
- Maximale Anzahl Begriffe (10–300)

### 4.3 Gewichtung
- Spaltenzuordnung (siehe 3.2)
- Regler α (Nennungen ↔ Priorität)
- Skalierung: linear / Wurzel / Logarithmus / Rang
- Min./Max. Schriftgröße

### 4.4 Layout
- Form der Wolke: Rechteck, Ellipse, Kreis, Herz, Stern, Raute — plus **eigene
  Bildmaske** (PNG/JPEG hochladen, Schwellwert über Helligkeit/Alpha, Vorschau)
- Rotation: keine / 0° + 90° / zufällig ±60° / frei
- Wortabstand (Padding in px)
- Seitenverhältnis: 1:1, 4:3, 16:9, 4:5, 9:16, frei
- Seed-Feld + „Neu würfeln"
- Auto-Fit: passen nicht alle Begriffe, werden die Größen iterativ verkleinert
  (max. 8 Durchläufe) statt Wörter stillschweigend wegzulassen. Was am Ende
  trotzdem nicht passt, wird im Statusbereich beziffert.

### 4.5 Design
- Schrift: mitgelieferte Inter (500/700/800) plus System-Stacks (Sans, Serif, Mono, Condensed)
- Schriftschnitt, Groß-/Kleinschreibung (Original / Großbuchstaben / Kapitälchen-Optik)
- Kuratierte Paletten (mindestens 8, hell und dunkel) plus eigene Farben
- Farbzuordnung: nach Score (Verlauf), nach Rang, zufällig, einfarbig
- Hintergrund: Farbe, Verlauf oder transparent
- Optional Titel, Untertitel und Quellenzeile unter der Wolke

### 4.6 Begriffsliste
Tabelle mit allen Begriffen: Rang, Text, Häufigkeit, Gewicht, berechneter Score,
Checkbox zum Ausschließen. Ausschlüsse wirken sofort und werden bei erneutem
Import beibehalten, solange der Begriff existiert.

### 4.7 Export
- PNG (Transparenz möglich), JPEG (Qualitätsregler), WebP, SVG
- Skalierung 1×/2×/3×/4×, harte Obergrenze 8000 px lange Kante
- „In Zwischenablage kopieren"
- Dateiname aus Titel abgeleitet, sonst `wordcloud`
- Einstellungen als JSON exportieren/importieren (Preset)

## 5. Layout-Algorithmus (verbindlich)

Kein Fremdcode, eigene Implementierung, angelehnt an das Spiral-/Sprite-Verfahren
von `d3-cloud`:

1. **Belegungsraster.** `Uint8Array` über die Zeichenfläche, Zellgröße ca. 2
   Design-Pixel. Alles **außerhalb** der gewählten Form wird vorab auf
   „belegt" gesetzt. Damit prüft ein einziger Test gleichzeitig Kollision *und*
   Formtreue.
2. **Sprite je Begriff.** Der Begriff wird in ein Offscreen-Canvas gezeichnet
   (inkl. Rotation), zusätzlich mit `strokeText` in Padding-Breite umrandet, um
   den Mindestabstand einzubacken. Aus den Alpha-Werten entsteht eine
   heruntergerechnete Bitmaske.
3. **Platzierung.** Begriffe absteigend nach Größe. Archimedische Spirale ab
   Mittelpunkt; je Position wird die Bitmaske gegen das Raster geprüft
   (Abbruch beim ersten Treffer). Passt sie, wird sie ins Raster gestempelt und
   Position + Winkel + Größe gespeichert.
4. **Ergebnis.** Eine Liste platzierter Begriffe mit `x, y, angle, fontSize,
   color`. Daraus rendern **beide** Ausgaben: Canvas (Rasterbilder) und SVG.
   Das garantiert, dass SVG und PNG identisch aussehen.

Der Algorithmus läuft im Main Thread, muss aber bei 300 Begriffen unter ~1,5 s
bleiben; ein sichtbarer Ladezustand ist Pflicht.

## 6. Aufbau

```
public/
  index.html
  style.css
  js/
    main.js         Verdrahtung, Zustand, Rendern der Vorschau
    ui.js           DOM-Helfer, i18n-Anwendung, Sprachumschalter
    parse.js        CSV-/Text-Erkennung und -Zerlegung
    tokenize.js     Tokenizer, Stoppwörter, N-Gramme
    weights.js      Normierung, Mischung, Skalierung
    layout.js       Belegungsraster, Sprites, Spirale
    shapes.js       Formmasken inkl. Bildmaske
    render.js       Canvas- und SVG-Ausgabe
    exporters.js    Blob-Erzeugung, Download, Zwischenablage
  data/
    i18n.js  stopwords.js  palettes.js
  samples/  fonts/  assets/
docs/   README.md   BACKLOG.md
```

## 7. Abnahmekriterien

1. `public/samples/topics.csv` laden → ohne weitere Eingriffe erscheint eine
   lesbare Wolke, in der „Planning" der größte Begriff ist.
2. α von 0 auf 1 ziehen → die Reihenfolge verschiebt sich sichtbar zugunsten
   der Priorität, ohne Neuladen.
3. Seed festhalten, Seite neu laden, gleiche Einstellungen → identisches Bild.
4. PNG-Export mit 4× und transparentem Hintergrund → Datei öffnet in einem
   Bildbetrachter, Ränder sind transparent, Text scharf.
5. SVG-Export in einem Vektorprogramm → jeder Begriff ist ein eigenes,
   editierbares Textobjekt an derselben Stelle wie im PNG.
6. Bedienung ausschließlich per Tastatur bis zum Export möglich; jedes
   Bedienelement wird von einem Screenreader benannt.
7. Kein Netzwerkverkehr nach dem ersten Laden (Netzwerk-Tab bleibt leer).
8. Die Anwendung funktioniert offline.

## 8. Bewusst nicht in V1

Kollaboration, Konten, Serverspeicher, Live-Datenquellen, automatische
Übersetzung, Lemmatisierung/Stemming, Wortwolken-Animationen. Diese Punkte
stehen im Backlog (`BACKLOG.md`) und dürfen nicht vorgezogen werden.
