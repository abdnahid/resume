export function getSortedDays(year: number, month: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const today = new Date().getDate();
  const todayMonth = new Date().getMonth();
  const todayYear = new Date().getFullYear();
  const arrayOfDate: Date[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    const date = new Date(year, month, -firstWeekday + i + 1, 0, 0, 0, 0);
    arrayOfDate.push(date);
  }
  for (let i = 1; i <= lastDay; i++) {
    if (i === today && todayMonth === month && todayYear === year) {
      arrayOfDate.push(new Date(year, month, i, 0, 0, 0, 0));
    } else {
      arrayOfDate.push(new Date(year, month, i, 0, 0, 0, 0));
    }
  }
  const rest = 42 - arrayOfDate.length;
  for (let i = 1; i <= rest; i++) {
    arrayOfDate.push(new Date(year, month + 1, i, 0, 0, 0, 0));
  }
  return arrayOfDate;
}
