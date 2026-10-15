// Owner identity is configured on the server, never inherited from an hotel admin role.
export function isPlatformOwner(user, configuredId = process.env.PLATFORM_OWNER_USER_ID) {
  const id = String(configuredId || '').trim();
  return /^[1-9]\d*$/.test(id) && String(user?.id) === id && user?.role === 'admin' && user?.is_active === true;
}

export function requirePlatformOwner(req, res, next) {
  if (!isPlatformOwner(req.user)) return res.status(403).json({ message: 'Cet espace est réservé au propriétaire de la plateforme.' });
  return next();
}
