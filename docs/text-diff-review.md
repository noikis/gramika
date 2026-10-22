I've reviewed the new text-diff implementation. The core architecture looks good, and the basic spelling, punctuation, agreement, split/join, and movement examples behave correctly.

Please address two issues:

1. **Movement detection must not depend on the total sentence count being identical.** Adding or splitting a sentence elsewhere in the document currently disables movement recognition even in unchanged sentence pairs. Make movement analysis local to corresponding text regions.

2. **Bound movement-candidate scanning more effectively.** A long sentence with thousands of distinct words and a simple relocation can currently require seconds to compare. Ensure large or highly reordered inputs fall back quickly to conservative, complete diff output.

Keep phrase grouping conservative for now. Do not introduce aggressive merging of neighboring word replacements.

After these fixes, run the full regression and integration tests, including Workspace, History, and Explain selection behavior. Keep the approved Explain prompts unchanged.
