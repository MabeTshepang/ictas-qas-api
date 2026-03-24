import ImageKit, { toFile } from '@imagekit/nodejs';
import path from 'path';

const imagekit = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
});

export const uploadToImageKit = async (fileBuffer: Buffer, originalName: string) => {
  try {
    const ext = path.extname(originalName).toLowerCase();
    const fileName = `tenant_bg_${Date.now()}${ext}`;

    const result = await imagekit.files.upload({
      file: await toFile(fileBuffer, fileName),
      fileName: fileName,
      folder: "ictas",
      useUniqueFileName: true,
    });

    return result.url;

  } catch (error: any) {
    console.error("ImageKit SDK Error:", error.message);
    throw new Error(`Cloud upload failed: ${error.message}`);
  }
};