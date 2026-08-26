/**
 * Robust, language-agnostic answer matcher supporting international scripts
 * (English, Bangla, Korean, Chinese, Hindi, Arabic, Spanish, etc.).
 * Accurately matches user selection key (e.g. "A", "B", "ক", "1") against the question's answer string,
 * supporting key matches, unicode prefixes ("A.", "(ক)", "Option 1"), and exact option text values.
 */
export function isAnswerCorrect(
  selectedKey: string,
  correctAnswer: string,
  options: Record<string, string> | string
): boolean {
  if (!selectedKey || !correctAnswer) return false;

  const normSelectedKey = selectedKey.trim().normalize("NFC").toUpperCase();
  const normCorrectAnswer = correctAnswer.trim().normalize("NFC");
  const normCorrectAnswerUpper = normCorrectAnswer.toUpperCase();

  // 1. Direct key match (e.g. "A" === "A", "a" === "A", "ক" === "ক")
  if (normSelectedKey === normCorrectAnswerUpper) {
    return true;
  }

  // 2. Prefix format match (e.g. "A.", "A)", "Option A", "(A)", "A: Paris", "(ক) উত্তর", "1. Answer")
  const prefixMatch = normCorrectAnswerUpper.match(/^(?:OPTION\s+|উত্তর\s+|정답\s+|答案\s+)?[\(\[]?([^.)\]:\s\-_]{1,3})[.)\]:\s\-_]/u);
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
  const selectedText = (parsedOptions[selectedKey] || "").trim().normalize("NFC").toLowerCase();
  const correctText = normCorrectAnswer.toLowerCase();

  if (selectedText && selectedText === correctText) {
    return true;
  }

  // 4. Reverse lookup: If correctAnswer is the text value of one of the options (e.g. "Paris"), find its key
  for (const [key, value] of Object.entries(parsedOptions)) {
    if (
      key.trim().normalize("NFC").toUpperCase() === normSelectedKey &&
      (value || "").trim().normalize("NFC").toLowerCase() === correctText
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
  const trimmed = answer.trim().normalize("NFC");
  const upper = trimmed.toUpperCase();

  // If already standard key in options
  if (options[upper] !== undefined) {
    return upper;
  }
  if (options[trimmed] !== undefined) {
    return trimmed;
  }

  // Prefix match (e.g. "A. Option Text" -> "A", "(ক) ঢাক" -> "ক")
  const prefixMatch = upper.match(/^(?:OPTION\s+|উত্তর\s+|정답\s+|答案\s+)?[\(\[]?([^.)\]:\s\-_]{1,3})[.)\]:\s\-_]/u);
  if (prefixMatch) {
    const key = prefixMatch[1];
    if (options[key] !== undefined) return key;
    if (options[key.toUpperCase()] !== undefined) return key.toUpperCase();
  }

  // Match by value
  for (const [key, val] of Object.entries(options)) {
    if ((val || "").trim().normalize("NFC").toLowerCase() === trimmed.toLowerCase()) {
      return key;
    }
  }

  return trimmed;
}
