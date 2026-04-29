// src/utils/cloudinary.js
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadImage = async (imagePath, folder = 'bizstack') => {
  try {
    const result = await cloudinary.uploader.upload(imagePath, {
      folder: folder,
      use_filename: true,
      unique_filename: true
    });
    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

const uploadMultipleImages = async (images, folder = 'bizstack') => {
  try {
    const uploadPromises = images.map(image => uploadImage(image, folder));
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    console.error('Cloudinary multiple upload error:', error);
    throw error;
  }
};

const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  uploadMultipleImages,
  deleteImage
};