const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const validateOrgCode = async (req, res, next) => {
  // Skip for public routes
  const publicPaths = ['/api/auth/login', '/api/auth/register-owner', '/api/organizations'];
  
  if (publicPaths.includes(req.path) && req.method === 'POST') {
    return next();
  }
  
  const orgCode = req.headers['x-org-code'];
  
  if (!orgCode) {
    return res.status(400).json({ error: 'Organization code (x-org-code header) is required' });
  }
  
  const organization = await prisma.organization.findUnique({
    where: { orgCode }
  });
  
  if (!organization) {
    return res.status(401).json({ error: 'Invalid organization code' });
  }
  
  if (!organization.isActive) {
    return res.status(401).json({ error: 'Organization is deactivated' });
  }
  
  req.organization = organization;
  req.orgCode = orgCode;
  next();
};

module.exports = validateOrgCode;
