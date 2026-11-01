### Fromtend

- Create reusable UI components (select inputs, textarea, buttons...).
- Improved navigation.
- Create a shared state for translations. Example. if the user selects some part text and click on the translate button, the selected text should be translated.
- Refactor Explanation PANEL (2 files instead of one).
- Refactor useTranslation
- Fix duplicate or empty dictionary analyses for stressed and unstressed matches. For `ситуация`, the API returns a stressed inflection match (`ситуа́ция`, nominative singular) and a headword match (`ситуация`, no grammar). The UI counts both as `(2)`, but the headword match renders nothing. The user reports the same issue for `проблема` / `пробле́ма`, with the stressed inflection also marked nominative singular. Compare forms without stress marks when identifying duplicates, preserve stress marks for display, retain genuinely different grammatical analyses, and omit empty rows. Remove the "Possible word forms" dropdown entirely; display distinct, readable analyses directly.

```json
        {
          "form": "пробле́ма",
          "grammar": {
            "cases": [
              "nominative"
            ],
            "numbers": [
              "singular"
            ]
          },
          "unmappedTags": [],
          "sources": [
            "inflection"
          ],
          "partOfSpeech": "noun"
        },
```
