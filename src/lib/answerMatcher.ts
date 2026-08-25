/**
 * Robust, language-agnostic answer matcher.
 * Accurately matches user selection key (e.g. "A", "B") against the question's answer string,
 * supporting key matches ("A", "a"), prefixes ("A.", "Option A", "(A)"), and exact option text values ("Paris").
 */
export function isAnswerCorrect(
  selectedKey: string,
  correctAnswer: string,
  options: Record<string, string> | string
): boolean {
  if (!selectedKey || !correctAnswer) return false;

  const normSelectedKey = selectedKey.trim().toUpperCase();
  const normCorrectAnswer = correctAnswer.trim();
  const normCorrectAnswerUpper = normCorrectAnswer.toUpperCase();

  // 1. Direct key match (e.g. "A" === "A", "a" === "A")
  if (normSelectedKey === normCorrectAnswerUpper) {
    return true;
  }

  // 2. Prefix format match (e.g. "A.", "A)", "Option A", "(A)", "A: Paris")
  const prefixMatch = normCorrectAnswerUpper.match(/^(?:OPTION\s+)?[\(\[]?([A-Z0-9])[\.\)\]\:\s]/);
  if (prefixMatch && prefixMatch[1] === normSelectedKey) {
    return true;
  }

  // Parse options if passed as JSON string
  let parsedOptions: Record<string, string> = {};
  if (typeof options === "string") {
    try {
      parsedOptions = JSON.parse(options);
    } catch {
      parsedOptions = {};
    }
  } else if (options && typeof options === "object") {
    parsedOptions = options;
  }

  // 3. Option value match (e.g. selected key is "B" and options["B"] is "Paris", while correctAnswer is "Paris")
  const selectedText = (parsedOptions[selectedKey] || "").trim().toLowerCase();
  const correctText = normCorrectAnswer.toLowerCase();

  if (selectedText && selectedText === correctText) {
    return true;
  }

  // 4. Reverse lookup: If correctAnswer is the text value of one of the options (e.g. "Paris"), find its key
  for (const [key, value] of Object.entries(parsedOptions)) {
    if (
      key.trim().toUpperCase() === normSelectedKey &&
      (value || "").trim().toLowerCase() === correctText
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes question answer string to standard option key if matched to an option value.
 */
export function normalizeCanonicalAnswer(
  answer: string,
  options: Record<string, string>
): string {
  if (!answer) return "";
  const trimmed = answer.trim();
  const upper = trimmed.toUpperCase();

  // If already standard key in options
  if (options[upper] !== undefined || options[trimmed] !== undefined) {
    return upper;
  }

  // Prefix match (e.g. "A. Option Text" -> "A")
  const prefixMatch = upper.match(/^(?:OPTION\s+)?[\(\[]?([A-Z0-9])[\.\)\]\:\s]/);
  if (prefixMatch && options[prefixMatch[1]] !== undefined) {
    return prefixMatch[1];
  }

  // Match by value
  for (const [key, val] of Object.entries(options)) {
    if ((val || "").trim().toLowerCase() === trimmed.toLowerCase()) {
      return key.toUpperCase();
    }
  }

  return trimmed;
}
