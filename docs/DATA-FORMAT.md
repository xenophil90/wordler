# Datenformat

wordler verarbeitet zwei Eingabearten. Beide landen intern in derselben Struktur:
ein Begriff, eine Häufigkeit, ein Gewicht.

## Tabelle (CSV / TSV)

```csv
Topic,Count,Weight
Planning,8,100
Onboarding,7,95
Documentation,7,88
Reporting,7,82
Automation,6,84
```

| Spalte | Bedeutung | Pflicht |
| --- | --- | --- |
| Begriff | Der Text, der in der Wolke steht | ja |
| Häufigkeit | Wie oft der Begriff aufgetaucht ist | nein (Vorgabe 1) |
| Gewicht | Wie wichtig er ist, unabhängig von der Häufigkeit | nein (Vorgabe = Häufigkeit) |

**Erkannt wird automatisch:**

- Trennzeichen: `,` `;` Tabulator `|`
- Kopfzeile: vorhanden, wenn die erste Zeile weniger Zahlen enthält als die folgenden
- Zahlenformat: `1234.5` und `1.234,5` werden beide gelesen, `%` und Leerzeichen ignoriert
- Spaltenzuordnung: erste Textspalte → Begriff, erste Zahlenspalte → Häufigkeit,
  zweite Zahlenspalte → Gewicht

Alles davon ist nach dem Import über drei Auswahlfelder änderbar. Spaltennamen spielen
keine Rolle — nur die Zuordnung zählt. Doppelte Begriffe werden zusammengefasst:
Häufigkeiten addiert, das höhere Gewicht gewinnt.

## Freitext

Beliebiger Text. Er wird an Satzgrenzen (`.` `!` `?` `;` `:` Zeilenumbruch) zerlegt,
dann in Wörter. Wortgruppen (N-Gramme) werden nie über eine Satzgrenze hinweg gebildet.
Häufigkeit = Anzahl der Vorkommen, Gewicht = Häufigkeit.

## Score

```
score = shape( (1 − α) · norm(Häufigkeit) + α · norm(Gewicht) )
Schriftgröße = kleinste + score · (größte − kleinste)
```

`norm` normiert über alle *aktiven* Begriffe auf 0…1 (Min–Max). Abgewählte Begriffe
fallen vorher heraus und verschieben dadurch die Normierung — das ist Absicht: die
Wolke soll die Verteilung dessen zeigen, was man tatsächlich sieht.

`shape` ist die gewählte Skalierung:

| Skalierung | Wirkung |
| --- | --- |
| Linear | Bildet die Werte unverändert ab; große Ausreißer dominieren |
| Wurzel | Dämpft Ausreißer, kleine Begriffe bleiben lesbar (Vorgabe) |
| Log | Starke Dämpfung, gut bei Verteilungen über mehrere Größenordnungen |
| Rang | Ignoriert Absolutwerte, nutzt nur die Reihenfolge — gleichmäßige Abstufung |

## Anonymisierung

Die mitgelieferten Beispieldaten sind erfunden. Sie bilden nur die *Form* echter
Themenlisten ab. Da die Anwendung vollständig im Browser läuft, verlassen echte Daten
das Gerät ohnehin nicht — beim Teilen des fertigen Bildes ist das aber wieder eine
bewusste Entscheidung.
