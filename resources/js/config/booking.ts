export const bookingSettings = {
  openingHour: 9,
  latestStartHour: 21,
  slotMinutes: 30,
  minimumDurationMinutes: 30,
  maximumDurationHours: 24,
  allowedFileExtensions: ["gcode", "3mf", "stl", "step", "stp"],
  maximumFileSizeMb: 100,
} as const;

export function createStartTimes() {
  const times: string[] = [];

  for (
    let minutes = bookingSettings.openingHour * 60;
    minutes <= bookingSettings.latestStartHour * 60;
    minutes += bookingSettings.slotMinutes
  ) {
    const hour = Math.floor(minutes / 60).toString().padStart(2, "0");
    const minute = (minutes % 60).toString().padStart(2, "0");
    times.push(`${hour}:${minute}`);
  }

  return times;
}

export function createDurations() {
  const durations: number[] = [];
  const maximumMinutes = bookingSettings.maximumDurationHours * 60;

  for (
    let minutes = bookingSettings.minimumDurationMinutes;
    minutes <= maximumMinutes;
    minutes += bookingSettings.slotMinutes
  ) {
    durations.push(minutes);
  }

  return durations;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} dakika`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} saat ${remainingMinutes} dakika` : `${hours} saat`;
}

export function calculateEndTime(date: string, time: string, durationMinutes: number) {
  if (!date || !time) return null;

  const end = new Date(`${date}T${time}:00`);
  end.setMinutes(end.getMinutes() + durationMinutes);

  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(end);
}
