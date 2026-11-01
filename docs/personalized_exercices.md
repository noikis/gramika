# Gramika — Dictionary & Personalized Exercises

## Feature Planning Notes

**Status:** Planned features  
**Target audience:** Primarily B1–B2 Russian learners  
**Application:** Gramika (Noikis)  
**Scope:** Product vision, functionality, and user experience. Implementation details intentionally excluded.

---

## 1. General vision

Gramika will expand beyond Russian proofreading by introducing two complementary features:

1. **Russian Dictionary (Словарь)** — Help users understand Russian words, their meanings, and grammatical forms.
2. **Personalized Exercises (Упражнения)** — Help users improve their Russian through exercises that prioritize their actual mistakes while introducing new grammar and vocabulary.

Both features should complement the existing proofreading and LLM-powered explanation functionality, not duplicate it.

The application will remain **invite-only, with a maximum of approximately 10 users**.

The goal is quality and personalization rather than supporting a large number of users.

---

## 2. Russian Dictionary

### Purpose

Provide a convenient monolingual Russian dictionary (толковый словарь) that helps users understand words without leaving Gramika.

The dictionary uses the existing self-hosted Russian Wiktionary API (WiktApi).

LibreTranslate remains responsible for translation, while the existing LLM functionality handles contextual explanations.

### Essential functionality

- Russian-language definitions, including multiple meanings when available.
- Part of speech and essential grammatical information.
- Grammatical gender for nouns.
- Verb aspect when relevant.
- Support for inflected words through WiktApi's word-resolution functionality.
- Identification of the selected word's grammatical form when possible.
- Declension and conjugation tables.
- Example sentences when available.

### User experience

The dictionary must follow **progressive disclosure**.

The default view should be compact and provide only what users need to understand a word:

- Headword (lemma).
- Primary definition.
- Essential grammatical properties.
- Selected word's grammatical form, when identifiable.

Additional information should be available through optional actions such as:

- **Подробнее** — Additional definitions.
- **Примеры** — Usage examples.
- **Склонение / Спряжение** — Grammatical tables.

Do not overwhelm users with all available dictionary data.

Avoid empty sections, unnecessary metadata, and advanced linguistic details that offer little practical value.

### Inflected words

Users should be able to look up words as they naturally appear in sentences.

For example:

`атмосферу → атмосфера`

The dictionary should display the lemma's definition and identify the selected grammatical form.

When a word has multiple possible interpretations, avoid silently presenting an uncertain interpretation as definitive.

### Out of scope initially

- Etymology.
- Comprehensive synonym and antonym sections.
- Frequency rankings.
- Advanced linguistic metadata.
- Dictionary audio pronunciation as a separate feature.

---

## 3. Personalized Russian Exercises

### Purpose

Help users develop their Russian skills through short exercises that combine:

- Their actual proofreading mistakes.
- Vocabulary encountered in their writing.
- Related grammatical constructions using new vocabulary.
- General Russian grammar and vocabulary practice.
- Review of previously difficult topics.

**Personalization should be prioritized, but exercises must not be limited to the user's previous mistakes.**

Users often do not know which areas of grammar they need to improve. The application should help discover those weaknesses rather than relying exclusively on users selecting topics themselves.

---

## 4. Exercise Types

The following exercise types were identified as especially useful.

| Exercise                  | Description                                                    |
| ------------------------- | -------------------------------------------------------------- |
| Fill in the blank         | Complete a sentence using the correct word or grammatical form |
| Correct the sentence      | Find and correct grammatical or punctuation mistakes           |
| Multiple choice           | Select the correct form, word, or construction                 |
| Identify grammatical form | Identify case, number, gender, tense, or other attributes      |
| Noun declension           | Produce the requested case and number                          |
| Verb conjugation          | Produce the requested person, number, or tense                 |
| Adjective agreement       | Select the adjective form matching a noun                      |
| Vocabulary definitions    | Identify words from Russian definitions                        |
| Word stress               | Identify the correctly stressed form                           |
| Sentence construction     | Arrange words into a grammatically correct sentence            |

Not all exercise types need to be included in the initial release.

### Initial priorities

The strongest candidates for the first version are:

1. Fill in the blank.
2. Correct the sentence.
3. Multiple choice.
4. Identify grammatical forms.

Declensions and conjugations are particularly well suited to dictionary-based exercise generation.

---

## 5. Personalization Strategy

Exercise selection should combine three categories.

| Category | Initial proposed share | Purpose                                                         |
| -------- | ---------------------: | --------------------------------------------------------------- |
| Personal |                    50% | Practice actual mistakes and vocabulary from corrections        |
| Related  |                    30% | Practice the same grammatical principles in new contexts        |
| General  |                    20% | Introduce new topics and identify previously unknown weaknesses |

These percentages are **initial suggestions, not permanent rules**.

The balance should adapt to the user's performance and available learning history.

If a user has insufficient correction history, general and diagnostic exercises should fill the gap.

### Example

A user repeatedly makes mistakes with the dative case.

Gramika could offer:

- An exercise using vocabulary from a previous correction.
- Another exercise using different vocabulary but the same grammatical principle.
- A new exercise testing a related grammatical construction.

The goal is to understand and apply a rule, not memorize a previously corrected sentence.

---

## 6. User Level and Adaptive Difficulty

Gramika primarily targets **B1–B2 learners**, but users may have different levels of proficiency.

A user's overall level should not be confused with their mastery of individual grammatical topics.

For example, a B2 learner may still struggle with basic case endings.

### Expected behavior

- Allow an initial proficiency level to be selected.
- Adapt difficulty based on exercise performance and identified weaknesses.
- Avoid automatically treating a user as a beginner because of one basic mistake.
- Practice simpler grammatical principles in appropriately challenging contexts.
- Introduce more advanced material when users demonstrate readiness.

### Important B1–B2 topics

- Grammatical cases and verb government (управление).
- Verb aspect.
- Subject–verb and adjective–noun agreement.
- Complex sentences and punctuation.
- Word combinations and natural usage.
- Professional and everyday written Russian.
- Vocabulary and meaning distinctions.

The difficulty of an exercise should reflect the grammatical construction, vocabulary, context, and cognitive demand—not merely word length or rarity.

---

## 7. Learning From Real Corrections

One of the most important planned capabilities is **analyzing users' actual proofreading history to identify grammatical weaknesses**.

Instead of treating every correction independently, the system should recognize recurring patterns.

For example:

- `к друг → к другу`
- `интересоваться о литературе → интересоваться литературой`
- `зависеть с обстоятельствами → зависеть от обстоятельств`

These mistakes could indicate difficulties with grammatical government.

However, individual mistakes should not automatically be treated as proof of a broad weakness.

### Analysis should consider

- Frequency and recurrence of errors.
- Types of grammatical mistakes.
- Errors repeated despite previous practice.
- Performance in related exercises.
- Topics the user consistently handles correctly.
- Topics the user has not yet demonstrated proficiency in.

The analysis should distinguish **observed weaknesses** from **possible weaknesses requiring further assessment**.

### Important principle

**The absence of errors does not mean a user has mastered a topic.**

A learner might never make mistakes with participles simply because they never use them.

Therefore, general diagnostic exercises should remain part of the learning experience.

---

## 8. Personalized Learning Profiles

Each user should gradually develop an individual learning profile.

The profile should identify:

- Areas requiring additional practice.
- Recurring grammatical difficulties.
- Topics showing improvement.
- Previously mastered constructions.
- Topics requiring further assessment.
- Recommended practice priorities.

Users should not need to understand or configure all this information themselves.

The application can use the profile to recommend relevant exercises automatically.

The profile should remain adaptive rather than assigning permanent labels such as "weak at grammar."

---

## 9. Exercise Generation and AI Usage

The goal is **not to eliminate AI**, but to avoid frequent paid OpenRouter requests.

The system can benefit from AI-generated educational material without requiring a model call during every exercise session.

### General principles

- Exercises can be prepared in advance.
- Dictionary data can support grammatical forms, definitions, and answer validation.
- AI can help create natural sentences, explanations, and contextual exercises.
- Previously prepared exercises should remain reusable.
- Routine exercise completion should not require an LLM.
- Generate new content when useful, rather than continuously producing duplicates.
- Reject ambiguous, invalid, or poorly constructed exercises.

### External content generation

An external process, potentially using Codex on the homelab, may periodically analyze learning data and prepare exercises.

**Gramika must remain completely unaware of Codex.**

The application should not depend on a specific agent, model, provider, or scheduling mechanism.

Its responsibility is to consume validated exercise content and provide the learning experience.

The content-generation mechanism should be replaceable without changing Gramika's user-facing functionality.

---

## 10. Exercise Experience

Practice should be:

- Short.
- Focused.
- Optional.
- Appropriate to the user's level.
- Relevant to personal weaknesses.
- Varied enough to avoid repetition.

### Proposed practice modes

**Мои ошибки**

Exercises prioritized according to the user's actual corrections and identified weaknesses.

**По темам**

Practice specific areas of Russian grammar or vocabulary.

**Повторение**

Review previously difficult exercises and concepts.

These can share one exercise library rather than operating as separate systems.

### Session design

Short sessions of approximately 3–5 exercises are a reasonable initial direction.

Provide feedback after each answer, including a concise explanation when appropriate.

Longer sessions or additional exercises can be offered optionally.

### Connection to proofreading

When Gramika corrects a relevant grammatical mistake, it may offer an optional **«Потренироваться»** action.

This should never interrupt the normal proofreading workflow.

The application should prioritize learning from the underlying grammatical concept, not merely asking users to reproduce the corrected sentence.

---

## 11. Exercise Quality

Quality is more important than quantity, particularly with a small invite-only user base.

Exercises should have:

- A clear learning objective.
- Unambiguous instructions.
- A verified correct answer or accepted alternatives.
- Appropriate difficulty.
- Natural Russian language.
- Concise explanations where useful.
- No unnecessary repetition.

Dictionary-backed exercises should use valid grammatical forms.

Contextual exercises should be checked for ambiguity and unnatural constructions.

Do not publish questionable exercises simply to fill a daily quota.

---

## 12. Progress and Revision

Gramika should track exercise performance to improve future recommendations.

Useful signals include:

- Correct and incorrect answers.
- Repeated difficulties.
- Improvement over time.
- Previously practiced topics.
- Topics due for revision.

Exercises that users repeatedly answer correctly should gradually become less frequent.

Difficult concepts should reappear in different contexts rather than simply repeating identical questions.

Progress should be used primarily to improve learning recommendations, not to create unnecessary gamification.

---

## 13. Privacy and Small User Base

Gramika will initially serve a maximum of approximately **10 invite-only users**.

This allows deeper personalization and careful quality control.

Each user's correction history and learning profile should remain separate.

Because real writing can contain personal or sensitive information:

- Users should know that their correction history may be used to personalize exercises.
- Avoid exposing complete personal texts unnecessarily.
- Prefer deriving grammatical patterns and vocabulary from corrections.
- Avoid reproducing sensitive personal content in exercises.
- Keep learning profiles private to their respective users.

---

## 14. Product Principles

The following principles should guide future design decisions.

1. **Proofreading remains the primary purpose of Gramika.** Dictionary and exercises should complement it.
2. **Personalization comes first**, but general learning remains essential.
3. **B1–B2 is the primary audience**, without excluding users at other levels.
4. **Users should not need to diagnose their own weaknesses.** Gramika should
