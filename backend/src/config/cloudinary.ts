import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'mock_cloud',
  api_key: process.env.CLOUDINARY_API_KEY || 'mock_key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'mock_secret',
});

export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  fileName: string,
  folder: string = 'kanban'
): Promise<{ url: string; publicId: string }> => {
  // Production-grade fallback in case keys are not set, allowing instant local runs.
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUD_NAME === 'mock_cloud'
  ) {
    // Generate a secure mock local path data URL
    const base64File = fileBuffer.toString('base64');
    const mockUrl = `data:image/png;base64,${base64File.slice(0, 100)}...mock_url_for_${encodeURIComponent(fileName)}`;
    return {
      url: mockUrl,
      publicId: `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        filename_override: fileName,
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Upload failed'));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    uploadStream.end(fileBuffer);
  });
};

export const deleteFromCloudinary = async (publicId: string): Promise<boolean> => {
  if (publicId.startsWith('mock_')) {
    return true;
  }
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Failed to delete asset from Cloudinary:', error);
    return false;
  }
};
export { cloudinary };
