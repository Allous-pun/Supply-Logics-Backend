const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: 'dcyp5aihp',
  api_key: '468746196187498',
  api_secret: 'mFHc8z_lR1ekWws4mWWMRV_N0Tc'
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
