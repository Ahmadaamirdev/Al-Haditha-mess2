// Al-Haditha Petroleum Services - Automated Mess Allocation Engine
// Rules:
// 1. 3 meal allocations per employee per day (Full 7-day operational schedule, no off days).
// 2. Dynamic calculation based on exact days in month (30, 31, 28/29).
// 3. Meal time windows:
//    - Morning Breakfast: 09:00 - 10:00 AM (09:00 - 10:00)
//    - Lunch: 02:00 - 03:00 PM (14:00 - 15:00)
//    - Dinner: 07:00 - 08:00 PM (19:00 - 20:00)
// 4. Deduction rules:
//    - When employee enters: 1 allocation is consumed & minused.
//    - When a meal time window passes without an entry: 1 allocation expires & is minused.
//    - Daily progression automatically minuses past days' allocations.
//    - Real-time remaining allocations are displayed upon entry.

/**
 * Helper to get exact Oman Time (GST, UTC+4) components
 */
export function getOmanTime(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Muscat',
      hour12: false,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = formatter.formatToParts(date);
    const map = {};
    parts.forEach((p) => { map[p.type] = p.value; });
    const hour = parseInt(map.hour, 10);
    const minute = parseInt(map.minute, 10);
    const second = parseInt(map.second, 10);
    const year = parseInt(map.year, 10);
    const month = parseInt(map.month, 10);
    const day = parseInt(map.day, 10);

    const time12 = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Muscat',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);

    return {
      hour,
      minute,
      second,
      year,
      monthIndex: month - 1,
      day,
      totalMinutes: hour * 60 + minute,
      formattedTime12: time12,
    };
  } catch (_) {
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const oman = new Date(utc + (4 * 3600000));
    const hour = oman.getHours();
    const minute = oman.getMinutes();
    return {
      hour,
      minute,
      second: oman.getSeconds(),
      year: oman.getFullYear(),
      monthIndex: oman.getMonth(),
      day: oman.getDate(),
      totalMinutes: hour * 60 + minute,
      formattedTime12: oman.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  }
}

export const MEAL_WINDOWS = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    timeSlot: '05:00 - 11:00',
    startHour: 5,
    startMinute: 0,
    endHour: 11,
    endMinute: 0,
    icon: 'sun'
  },
  {
    id: 'lunch',
    name: 'Lunch',
    timeSlot: '11:00 - 17:00',
    startHour: 11,
    startMinute: 0,
    endHour: 17,
    endMinute: 0,
    icon: 'utensils'
  },
  {
    id: 'dinner',
    name: 'Dinner',
    timeSlot: '17:00 - 05:00',
    startHour: 17,
    startMinute: 0,
    endHour: 5,
    endMinute: 0,
    icon: 'moon'
  }
];

export function isEntryInMonthOrDate(entry, targetYear, targetMonthIndex, targetDay = null) {
  if (!entry) return false;

  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // 1. Check entry.date
  if (entry.date) {
    const str = String(entry.date).trim();

    // Check YYYY-MM-DD or YYYY-M-D
    const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymdMatch) {
      const y = parseInt(ymdMatch[1], 10);
      const m = parseInt(ymdMatch[2], 10) - 1;
      const d = parseInt(ymdMatch[3], 10);
      if (y === targetYear && m === targetMonthIndex) {
        if (targetDay !== null && targetDay !== undefined) {
          return d === Number(targetDay);
        }
        return true;
      }
      return false;
    }

    // Check standard JS Date parsing
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      if (parsed.getFullYear() === targetYear && parsed.getMonth() === targetMonthIndex) {
        if (targetDay !== null && targetDay !== undefined) {
          return parsed.getDate() === Number(targetDay);
        }
        return true;
      }
      return false;
    }

    // Substring fallback (e.g. "Monday, 3 Nov 2025" or "3 Nov 2026")
    const lower = str.toLowerCase();
    const hasYear = lower.includes(String(targetYear));
    const hasMonth = lower.includes(monthNames[targetMonthIndex]) || lower.includes(shortMonths[targetMonthIndex]);
    if (hasYear && hasMonth) {
      if (targetDay !== null && targetDay !== undefined) {
        const dayMatch = str.match(/\b\d{1,2}\b/);
        if (dayMatch) {
          return parseInt(dayMatch[0], 10) === Number(targetDay);
        }
      }
      return true;
    }
  }

  // 2. Check entry.timestamp if entry.date wasn't matched
  if (entry.timestamp) {
    const parsed = new Date(entry.timestamp);
    if (!isNaN(parsed.getTime())) {
      if (parsed.getFullYear() === targetYear && parsed.getMonth() === targetMonthIndex) {
        if (targetDay !== null && targetDay !== undefined) {
          return parsed.getDate() === Number(targetDay);
        }
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculates month statistics: total operational days (all days are working days), and monthly credits per employee.
 */
export function calculateMonthCalendar(year, monthIndex) {
  // Total days in month (monthIndex: 0 = Jan, 10 = Nov, 11 = Dec)
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  let fridaysCount = 0;
  let saturdaysCount = 0;
  let workingDaysCount = totalDays; // Every single day is an active working day

  const calendarDays = [];

  for (let d = 1; d <= totalDays; d++) {
    const dateObj = new Date(year, monthIndex, d);
    const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat

    if (dayOfWeek === 5) fridaysCount++;
    if (dayOfWeek === 6) saturdaysCount++;

    calendarDays.push({
      dayNumber: d,
      dayOfWeek,
      dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
      isOffDay: false, // No off days in the company
      dailyAllocation: 3
    });
  }

  const offDaysCount = 0; // Continuous full operation
  const allocationsPerEmployee = workingDaysCount * 3;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return {
    year,
    monthIndex,
    monthName: monthNames[monthIndex],
    totalDays,
    fridaysCount,
    saturdaysCount,
    offDaysCount,
    workingDaysCount,
    allocationsPerEmployee, // workingDays * 3
    calendarDays
  };
}

/**
 * Detect current active meal window or upcoming window based on current hour/minute
 */
export function getCurrentActiveMealWindow(date = new Date()) {
  const oman = getOmanTime(date);
  const currentTotalMins = oman.totalMinutes;

  // 1. Breakfast: 05:00 to 10:59 (300 to 659 mins)
  if (currentTotalMins >= 300 && currentTotalMins < 660) {
    return { ...MEAL_WINDOWS[0], status: 'ACTIVE', omanTime: oman.formattedTime12 };
  }

  // 2. Lunch: 11:00 to 16:59 (660 to 1019 mins)
  if (currentTotalMins >= 660 && currentTotalMins < 1020) {
    return { ...MEAL_WINDOWS[1], status: 'ACTIVE', omanTime: oman.formattedTime12 };
  }

  // 3. Dinner: 17:00 to 04:59 (>= 1020 mins or < 300 mins)
  return { ...MEAL_WINDOWS[2], status: 'ACTIVE', omanTime: oman.formattedTime12 };
}

/**
 * Calculates real-time employee meal allocation status
 */
export function getEmployeeRealtimeAllocations({
  employeeId,
  mealEntries = [],
  currentDate = new Date(),
  customYear,
  customMonthIndex,
  customDay,
  precomputedMonthStats = null
}) {
  const now = currentDate instanceof Date ? currentDate : new Date();
  const year = customYear ?? now.getFullYear();
  const monthIndex = customMonthIndex ?? now.getMonth();
  const currentDay = customDay ?? now.getDate();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTotalMins = currentHour * 60 + currentMinute;

  const monthStats = precomputedMonthStats || calculateMonthCalendar(year, monthIndex);
  const totalMonthlyQuota = monthStats.allocationsPerEmployee; // Total operational days * 3

  // Find all meals logged by this employee for this month
  const empMonthEntries = (mealEntries || []).filter((e) => {
    if (e.employeeId !== employeeId) return false;
    if (!e.date) return false;
    const [y, m] = String(e.date).split('-');
    if (y && m) {
      return parseInt(y, 10) === year && (parseInt(m, 10) - 1) === monthIndex;
    }
    const entryDate = new Date(e.date);
    return entryDate.getFullYear() === year && entryDate.getMonth() === monthIndex;
  });

  // Consumed count is the exact number of meals consumed by this employee
  const consumedCount = empMonthEntries.length;

  const todayDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
  const todayEntries = empMonthEntries.filter((e) => e.date === todayDateStr);

  const bfEntry = todayEntries.find((e) => e.mealType?.toLowerCase() === 'breakfast');
  const lunchEntry = todayEntries.find((e) => e.mealType?.toLowerCase() === 'lunch');
  const dinnerEntry = todayEntries.find((e) => e.mealType?.toLowerCase() === 'dinner');

  let expiredCount = 0;

    const todayMealsStatus = {
    isOffDay: false,
    breakfast: { status: 'AVAILABLE', label: '05:00 - 11:00', entry: null },
    lunch: { status: 'AVAILABLE', label: '11:00 - 17:00', entry: null },
    dinner: { status: 'AVAILABLE', label: '17:00 - 05:00', entry: null }
  };

  // 1. Breakfast (05:00 - 11:00 Oman Time: 300 - 660 mins)
  if (bfEntry) {
    todayMealsStatus.breakfast = { status: 'CONSUMED', label: '05:00 - 11:00', entry: bfEntry };
  } else if (currentTotalMins >= 660) {
    expiredCount++;
    todayMealsStatus.breakfast = { status: 'EXPIRED', label: '05:00 - 11:00', entry: null };
  } else {
    todayMealsStatus.breakfast = {
      status: currentTotalMins >= 300 ? 'ACTIVE_NOW' : 'UPCOMING',
      label: '05:00 - 11:00',
      entry: null
    };
  }

  // 2. Lunch (11:00 - 17:00 Oman Time: 660 - 1020 mins)
  if (lunchEntry) {
    todayMealsStatus.lunch = { status: 'CONSUMED', label: '11:00 - 17:00', entry: lunchEntry };
  } else if (currentTotalMins >= 1020) {
    expiredCount++;
    todayMealsStatus.lunch = { status: 'EXPIRED', label: '11:00 - 17:00', entry: null };
  } else {
    todayMealsStatus.lunch = {
      status: currentTotalMins >= 660 ? 'ACTIVE_NOW' : 'UPCOMING',
      label: '11:00 - 17:00',
      entry: null
    };
  }

  // 3. Dinner (17:00 - 05:00 Oman Time: >= 1020 mins or < 300 mins)
  if (dinnerEntry) {
    todayMealsStatus.dinner = { status: 'CONSUMED', label: '17:00 - 05:00', entry: dinnerEntry };
  } else {
    todayMealsStatus.dinner = {
      status: (currentTotalMins >= 1020 || currentTotalMins < 300) ? 'ACTIVE_NOW' : 'UPCOMING',
      label: '17:00 - 05:00',
      entry: null
    };
  }

  // Calculate remaining allocations
  const totalDeducted = consumedCount;
  const remainingMonthlyAllocations = Math.max(0, totalMonthlyQuota - consumedCount);
  const todayConsumedCount = todayEntries.length;
  const todayRemainingCount = Math.max(0, 3 - todayConsumedCount);

  return {
    employeeId,
    monthStats,
    totalMonthlyQuota,
    consumedCount,
    expiredCount,
    totalDeducted,
    remainingMonthlyAllocations,
    todayRemainingCount,
    todayRemaining: todayRemainingCount,
    monthRemaining: remainingMonthlyAllocations,
    todayMealsStatus,
    activeDay: currentDay,
    isTodayOffDay: false
  };
}

/**
 * Computes live allocations for an entire employee array efficiently
 */
export function getEmployeesAllocationMap(employees = [], mealEntries = [], currentDate = new Date(), customYear, customMonthIndex, customDay) {
  const now = currentDate instanceof Date ? currentDate : new Date();
  const year = customYear ?? now.getFullYear();
  const monthIndex = customMonthIndex ?? now.getMonth();
  const monthStats = calculateMonthCalendar(year, monthIndex);

  const map = {};
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    map[emp.id] = getEmployeeRealtimeAllocations({
      employeeId: emp.id,
      mealEntries,
      currentDate: now,
      customYear: year,
      customMonthIndex: monthIndex,
      customDay,
      precomputedMonthStats: monthStats
    });
  }
  return map;
}
