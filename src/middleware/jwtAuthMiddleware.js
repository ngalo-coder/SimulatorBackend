/**
 * @deprecated Use authMiddleware.js instead
 * This file re-exports from the consolidated authMiddleware for backward compatibility.
 */
import { authenticateToken, optionalAuth, requireRoles } from './authMiddleware.js';

export const protect = authenticateToken;
export { optionalAuth };

/**
 * @deprecated Use requireRoles('admin') from authMiddleware instead
 */
export const isAdmin = (req, res, next) => {
  authenticateToken(req, res, (err) => {
    if (err) return next(err);
    const guard = requireRoles('admin');
    return guard(req, res, next);
  });
};

export default { protect, isAdmin, optionalAuth };