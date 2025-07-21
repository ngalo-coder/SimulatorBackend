// Simple auth middleware for the contribution system
// This should be replaced with your actual authentication system

export const extractUserInfo = (req, res, next) => {
  // TODO: Replace with your actual authentication logic
  // For now, using headers or session data as fallback
  
  const userId = req.headers['x-user-id'] || req.session?.userId || 'demo-user-123';
  const userEmail = req.headers['x-user-email'] || req.session?.userEmail || 'demo@example.com';
  const userName = req.headers['x-user-name'] || req.session?.userName || 'Demo User';
  
  // Attach user info to request
  req.user = {
    id: userId,
    email: userEmail,
    name: userName
  };
  
  next();
};

export const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id || req.user.id === 'anonymous') {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this feature'
    });
  }
  next();
};

// Admin check middleware
export const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this feature'
    });
  }
  
  // TODO: Replace with your actual admin check logic
  const isUserAdmin = req.user.role === 'admin' || 
                     req.user.isAdmin === true || 
                     req.headers['x-admin-access'] === 'true';
  
  if (!isUserAdmin) {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'This feature requires administrator privileges'
    });
  }
  
  next();
};

// Alias for backward compatibility with existing routes
export const protect = requireAuth;

export default {
  extractUserInfo,
  requireAuth,
  protect,
  isAdmin
};