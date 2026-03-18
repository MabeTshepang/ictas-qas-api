import { BlobServiceClient } from '@azure/storage-blob';
import path from 'path';

const AZURE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const CONTAINER_NAME = 'uploads';

export const uploadToAzure = async (fileBuffer: Buffer, fileName: string, tenantId: string) => {
  if (!AZURE_CONNECTION_STRING) throw new Error("Azure Storage Connection String is missing");

  const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

  // Create container if it doesn't exist (only happens once)
  await containerClient.createIfNotExists();

  // Organize path: tenantId / year / month / filename
  const blobPath = `${tenantId}/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

  // Upload the encrypted buffer
  await blockBlobClient.uploadData(fileBuffer, {
    blobHTTPHeaders: { blobContentType: "application/pdf" }
  });

  return blockBlobClient.url; // Returns the permanent URL (accessible via SAS later)
};
export const uploadBrandingToAzure = async (fileBuffer: Buffer, fileName: string) => {
  if (!AZURE_CONNECTION_STRING) {
    throw new Error("Azure Storage Connection String is missing");
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

  await containerClient.createIfNotExists();

  const extension = path.extname(fileName).toLowerCase();
  let contentType = "application/octet-stream";
  
  if (extension === ".jpg" || extension === ".jpeg") contentType = "image/jpeg";
  else if (extension === ".png") contentType = "image/png";

  const blobPath = `branding/${fileName}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

  await blockBlobClient.uploadData(fileBuffer, {
    blobHTTPHeaders: { 
      blobContentType: contentType,
      blobCacheControl: "max-age=3600" 
    }
  });
  return blockBlobClient.url;
};
export const downloadFromAzure = async (blobUrl: string): Promise<Buffer> => {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error("Azure Connection String missing");

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const CONTAINER_NAME = 'uploads'; // Ensure this matches your Azure container name
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

  // 1. Extract everything after the container name
  // This handles the case where the URL might have a SAS token (?) at the end
  const urlParts = blobUrl.split(`${CONTAINER_NAME}/`);
  if (urlParts.length < 2) throw new Error("Invalid Azure URL format");

  // 2. Remove any URL parameters (SAS tokens) and decode URI components (like %20 for spaces)
  const blobPathWithPotentialQuery = urlParts[1];
  const blobPath = decodeURIComponent(blobPathWithPotentialQuery.split('?')[0]);

  console.log("Attempting to download blob:", blobPath); // Debug this in your terminal!

  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

  // 3. Perform the download
  const downloadResponse = await blockBlobClient.download(0);
  
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = downloadResponse.readableStreamBody!;
    stream.on('data', (data) => chunks.push(data instanceof Buffer ? data : Buffer.from(data)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => {
       console.error("Stream Error:", err);
       reject(err);
    });
  });
};