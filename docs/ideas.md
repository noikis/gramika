# Gramota — Product development plan

Looking at your screenshots and everything we've learned from testing Gemma 4 and Gemini 3.1 Flash Lite, I think Gramota already has a solid foundation.

You have a working correction interface, highlighted changes, history with search and filters, model selection, and an inexpensive default model that performs well on Russian grammar.

The next stage shouldn't be about adding more models or redesigning the interface. It should be about making Gramota more useful, understandable, and trustworthy.

I would organize development into three priorities:

1. Understanding corrections — explain why something was changed.
2. Controlling corrections — let the user accept or reject changes and recover from mistakes.
3. Learning from corrections — help users avoid repeating the same Russian mistakes.

## 1. The Explain feature — highest priority

This is the most important addition I would make.

At present, the user sees red and green highlights, but doesn't necessarily understand why the model changed something. That's especially problematic for advanced non-native speakers: the corrected version may look better without teaching them anything.

### What should Explain do?

I recommend explaining individual corrections, with an option to explain the whole text.

Proposed functionality

## Understanding a correction

Example

Original

Я заинтересовался о возможности сотрудничества.

Corrected

Я заинтересовался возможностью сотрудничества.

Explanation

The verb «заинтересоваться» requires the instrumental case without a preposition: заинтересоваться чем? — возможностью. That's why «о» was removed and «возможности» became «возможностью».

The explanation should contain the specific mistake, the correction, a concise reason, and an occasional short example when necessary.

It should not generate a long grammar lesson every time.

### How I would implement it

Use a separate LLM request only when the user clicks Explain.

The normal correction pipeline stays unchanged:

Original text

Gemma 4 correction

Result + highlighted changes

No additional API call

Explain (optional)

Separate API request on demand

This architecture has several benefits: ordinary corrections remain fast and inexpensive, explanations can use a different model if necessary, and you can improve explanations without changing the proofreading prompt.

The explanation request should receive the original text, corrected text, and the specific change or passage being explained. It should not independently rewrite the whole message.

One important safeguard: the explanation model must be allowed to say that a change was unnecessary or questionable. Otherwise, it may confidently invent a grammatical justification for an LLM mistake.

I would initially use Gemma 4 for explanations too, then test whether Gemini gives meaningfully clearer explanations. No need to add an expensive model before measuring its value.

## 2. Other features I would add

Here are my recommendations, ordered by value rather than technical complexity.

A. Accept or reject individual corrections — High priority

At present, users can copy the entire corrected text. But what if Gemma changes something they disagree with?

Each correction should eventually have Accept and Reject actions. Rejecting a change restores the original wording without discarding other corrections.

This is particularly useful because LLM corrections aren't always right.

B. Classify correction types — Medium priority

Classify changes into categories such as grammar, punctuation, spelling, awkward construction, and formatting.

This would make explanations more useful and help advanced learners identify recurring weaknesses.

Classifications should be generated on demand or alongside explanations, not through an extra LLM request for every ordinary correction.

C. Second opinion — High priority

When someone isn't satisfied with Gemma's result, let them request another correction using Gemini 3.1 Flash Lite.

Show both versions without replacing the first result. That makes the alternative model genuinely useful, without promising that it is always better.

D. Personal mistake notebook — Medium priority

Allow users to save a useful correction and its explanation.

Later, they can review common mistakes such as verb government, case endings, or punctuation.

I would start with manually saved corrections rather than automatically generating a learning profile.

E. Privacy and user separation — High priority before sharing

If relatives use Gramota, they shouldn't see each other's correction histories.

Each person should have separate history, access controls, and an option to delete their messages. The OpenRouter API key must remain server-side.

Add basic rate limits or request quotas to prevent accidental or abusive API spending.

## 3. A specific problem visible in your screenshots

Your example contains conversational language, unusual word order, and grammatical mistakes:

> Блять вообще не удобно. Я передвинул поездку в Морокко 12 ого. Чтобы с вами в Москве увидется. Ну поехать в Москву 5 ого и там всю неделю сидеть. Слишком дорого

This is a particularly valuable real-world test because it's not polished university correspondence. The author is expressing frustration.

Gramota must preserve that frustration, including profanity, while correcting actual language mistakes.

I would test these cases explicitly: informal fragments, incomplete sentences, colloquial vocabulary, and ambiguous dates.

There's also a practical issue with the Changes view: when individual characters and spaces are marked separately, corrections become difficult to understand. For example, changing a date like «12 ого» into «12-го» can produce several small highlighted regions.

I would improve the diff engine's grouping behavior, not necessarily its visual design. It should recognize word-level changes and combine related insertions/deletions into understandable corrections.

That matters for the Explain feature too: explanations need meaningful text spans, not isolated character edits.

## 4. What the explanation system should store

Because Gramota already has a SQLite-backed history, I would extend the existing records rather than build a separate explanation service with its own history.

A correction could have zero or more explanation records:

| Field             | Purpose                            |
| ----------------- | ---------------------------------- |
| Correction ID     | Links to the original correction   |
| Original passage  | What the user wrote                |
| Corrected passage | What the model returned            |
| Explanation       | Why the passage was changed        |
| Category          | Grammar, spelling, syntax, etc.    |
| Explanation model | Which LLM produced the explanation |
| Prompt version    | Makes behavior reproducible        |
| Tokens and cost   | Tracks API spending                |

Store explanations only after the user requests them. If the user opens the same explanation later, retrieve the saved result rather than spending tokens again.

A more advanced implementation can also store stable edit identifiers, so explanations and accept/reject actions stay associated with the correct text spans.

## 5. Development roadmap

I wouldn't implement everything simultaneously. Here's a practical order.

1

Milestone 1 — Explain corrections

Add on-demand explanations, save them in SQLite, and support viewing them from History. Start with a whole-correction explanation if selecting individual edits would require too much rework.

2

Milestone 2 — Better correction control

Group related changes, introduce accept/reject actions, and provide a Second Opinion using Gemini. Preserve both model results in history.

3

Milestone 3 — Learning tools

Add correction categories and a saved-mistakes notebook. Only then consider more advanced features such as personalized exercises.

4

Milestone 4 — Sharing with relatives

Add separate user accounts or private access, history isolation, deletion controls, and spending safeguards before deploying it for multiple people.

## 6. What I would deliberately avoid

I wouldn't add a chatbot, automatic essays, rewriting modes, vocabulary exercises, or a complicated personal dashboard right now.

Those could eventually be useful, but they would move Gramota away from its central purpose: correct my Russian accurately, preserve what I meant, and help me understand my mistakes.

Similarly, I wouldn't generate explanations automatically for every correction. Most users will simply want the corrected text, and forcing an explanation would increase cost, complexity, and visual clutter.

## 7. One important design decision

Before implementing the first milestone, I'd like to settle how detailed explanations should be.

## Explanation depth

Brief explanations (recommended)

One or two sentences explaining the specific rule and correction. Suitable for everyday use.

Detailed explanations

Several sentences, with grammatical terminology and examples. More useful for deliberate learning.

Brief by default, with “Explain more”

Start with a short explanation. Let the user request additional detail when interested.

Continue planning&#x20;

My preference is brief by default, with an optional “Explain more”. That would make Gramota accessible to your relatives while still being useful to someone actively improving their Russian.

Most importantly, I would build the underlying explanation system so it can later support individual corrections, saved mistakes, and more detailed lessons without requiring another major architectural change.
