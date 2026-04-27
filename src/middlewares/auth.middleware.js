const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bizstack-secret-key-change-in-production');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const checkPermission = (moduleKey, action) => {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Check if user has wildcard permission
    const hasWildcard = user.permissions?.some(p => 
      p.moduleKey === '*' && p.action === '*'
    );
    
    if (hasWildcard) {
      return next();
    }
    
    // Check specific permission
    const hasPermission = user.permissions?.some(p => 
      p.moduleKey === moduleKey && (p.action === action || p.action === '*')
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

module.exports = { authenticate, checkPermission };
