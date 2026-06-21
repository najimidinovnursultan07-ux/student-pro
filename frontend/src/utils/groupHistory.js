function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function groupHistoryByDate(items) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const groups = {
    today: { label: "Сегодня", items: [] },
    yesterday: { label: "Вчера", items: [] },
    previousWeek: { label: "Предыдущие 7 дней", items: [] },
    older: { label: "Ранее", items: [] },
  };

  for (const item of items) {
    const created = new Date(item.createdAt);
    if (created >= todayStart) {
      groups.today.items.push(item);
    } else if (created >= yesterdayStart) {
      groups.yesterday.items.push(item);
    } else if (created >= weekStart) {
      groups.previousWeek.items.push(item);
    } else {
      groups.older.items.push(item);
    }
  }

  return Object.values(groups).filter((group) => group.items.length > 0);
}
