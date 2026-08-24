export function calcAccuracy(
  sessions: Array<{ correctAnswers: number; wrongAnswers: number; isPractice?: boolean }>
) {
  const paid = sessions.filter((s) => !s.isPractice);
  const answered = paid.reduce((a, s) => a + s.correctAnswers + s.wrongAnswers, 0);
  const correct = paid.reduce((a, s) => a + s.correctAnswers, 0);
  return answered > 0 ? Math.round((correct / answered) * 100) : 0;
}
