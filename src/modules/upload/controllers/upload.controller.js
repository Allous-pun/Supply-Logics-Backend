const multer = require('multer');
const { uploadImage } = require('../../../utils/cloudinary');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  }
});

const uploadOrganizationLogo = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Convert buffer to base64
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    const result = await uploadImage(base64Image, `organizations/${orgCode}/logo`);
    
    // Update organization logo URL
    const organization = await prisma.organization.update({
      where: { orgCode },
      data: { logo: result.secure_url }
    });
    
    res.json({
      message: 'Logo uploaded successfully',
      logoUrl: result.secure_url,
      publicId: result.public_id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const uploadUserAvatar = async (req, res) => {
  try {
    const { userId } = req.params;
    const orgCode = req.headers['x-org-code'];
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    const result = await uploadImage(base64Image, `organizations/${orgCode}/users/${userId}/avatar`);
    
    // You can add avatar field to User model if needed
    res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl: result.secure_url,
      publicId: result.public_id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  upload,
  uploadOrganizationLogo,
  uploadUserAvatar
};
