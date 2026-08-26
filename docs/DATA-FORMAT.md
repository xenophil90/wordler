# Data format

wordler takes two kinds of input. Both end up in the same internal structure:
a term, a count, a weight.

## Table (CSV / TSV)

```csv
Topic,Count,Weight
Planning,8,100
Onboarding,7,95
Documentation,7,88
Reporting,7,82
Automation,6,84
```

| Column | Meaning | Required |
| --- | --- | --- |
| Term | The text that appears in the cloud | yes |
| Count | How often the term came up | no (defaults to 1) |
| Weight | How much it matters, independent of the count | no (defaults to the count) |

**Detected automatically:**

- Delimiter: `,` `;` tab `|`
- Header row: present when the first row holds fewer numbers than the rows below it
- Number format: `1234.5` and `1.234,5` are both read; `%` and spaces are ignored
- Column mapping: first text column → term, first numeric column → count,
  second numeric column → weight

All of that can be changed after the import through three select boxes. Column
names are irrelevant — only the mapping counts. Duplicate terms are merged: counts
add up, the higher weight wins.

## Free text

Any text. It is split at sentence boundaries (`.` `!` `?` `;` `:` newline) and then
into words. Phrases (n-grams) are never formed across a sentence boundary. Count =
number of occurrences, weight = count.

## Score

```
score = shape( (1 − α) · norm(count) + α · norm(weight) )
type size = smallest + score · (largest − smallest)
```

`norm` normalises across all *active* terms to 0…1 (min–max). Terms that have been
switched off drop out beforehand and therefore shift the normalisation — deliberately
so: the cloud should show the distribution of what you are actually looking at.

`shape` is the chosen scaling:

| Scaling | Effect |
| --- | --- |
| Linear | Maps the values unchanged; large outliers dominate |
| Square root | Damps outliers, keeps small terms legible (the default) |
| Log | Strong damping, good for distributions spanning orders of magnitude |
| Rank | Ignores absolute values and uses the order alone — even steps throughout |

## Anonymisation

The bundled sample data is invented. It only mirrors the *shape* of a real topic
list. Since the app runs entirely in the browser, real data never leaves the device
anyway — though sharing the finished picture is a deliberate decision again.
