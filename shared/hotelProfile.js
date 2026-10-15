export const DEFAULT_HOTEL_PROFILE = Object.freeze({
  name: 'Mon hôtel',
  department: 'Réception',
  timezone: 'Europe/Paris'
});

export function sanitizeHotelProfile(value = {}) {
  const text = (key, fallback, length) =>
    typeof value?.[key] === 'string' && value[key].trim()
      ? value[key].trim().slice(0, length)
      : fallback;
  let timezone = text('timezone', DEFAULT_HOTEL_PROFILE.timezone, 80);
  try { new Intl.DateTimeFormat('fr-FR', { timeZone: timezone }); }
  catch { timezone = DEFAULT_HOTEL_PROFILE.timezone; }
  return {
    name: text('name', DEFAULT_HOTEL_PROFILE.name, 80),
    department: text('department', DEFAULT_HOTEL_PROFILE.department, 60),
    timezone
  };
}
