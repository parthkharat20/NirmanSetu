export const requireAuth = (req, res, next) => {
  // In a full production system, this would verify a JWT or Session token
  // For this stage, we verify a shared secret or allow bypass for development
  
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const authHeader = req.headers.authorization;
  const apiKey = process.env.DASHBOARD_API_KEY;

  if (apiKey && authHeader === `Bearer ${apiKey}`) {
    return next();
  }

  // Fallback: If no API key is configured, allow for now (warn in console)
  if (!apiKey) {
    console.warn('⚠️ DASHBOARD_API_KEY not set. API is unprotected.');
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
};
