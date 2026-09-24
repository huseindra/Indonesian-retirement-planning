/**
 * Whole years between an ISO birth date (YYYY-MM-DD) and `today`,
 * accounting for whether this year's birthday has passed.
 */
export function calculateAge(dateOfBirth: string, today: Date = new Date()): number {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date of birth: ${dateOfBirth}`);
  }

  let age = today.getFullYear() - year;
  const currentMonth = today.getMonth() + 1;
  if (currentMonth < month || (currentMonth === month && today.getDate() < day)) {
    age -= 1;
  }
  return age;
}
