import { Resend } from 'resend';
import prisma from '../config/db';
import { encryptPdfBuffer } from '../utils/pdf-helper';
import { uploadToAzure } from './azure-storage.service';

const resend = new Resend(process.env.RESEND_API_KEY);

export const processAndSendPDF = async (fileBuffer: Buffer, user: any, originalName: string) => {
  let status: 'Sent' | 'Failed' = 'Failed';
  let metadata: any = {};
  let azureUrl: string | null = null;

  try {
    // 1. Encrypt PDF
    const encryptedBuffer = await encryptPdfBuffer(fileBuffer);

    // 2. Permanent Storage in Azure (Always store, even if email fails later)
    const fileName = `pandamatenga_${Date.now()}_${originalName}`;
    azureUrl = await uploadToAzure(encryptedBuffer, fileName, user.tenantId);

    // 4. Send via Resend
    const { data, error } = await resend.emails.send({
      from: `ICTAS BAMB <${process.env.SENDER_EMAIL}>`,
      to: [process.env.RECEIVER_EMAIL || ''],
      cc: [process.env.CCRECEIVER_EMAIL || ''],
      bcc: [process.env.BCCRECEIVER_EMAIL || ''],
      subject: "ICTAS BAMB - Delivery Note",
      html: "<strong>Find Attached Pandamatenga BAMB Grain Assessment Form</strong>",
      attachments: [
        {
          filename: originalName, // The name of the file (e.g., scan001.pdf)
          content: encryptedBuffer, // In Node.js, Resend accepts the Buffer directly
        },
      ],
    });

    if (error) throw new Error(error.message);

    status = 'Sent';
    metadata = { resendId: data?.id };
    return { id: data?.id, url: azureUrl };

  } catch (err: any) {
    status = 'Failed';
    metadata = { error: err.message };
    throw err;
  } finally {
    // 5. ATOMIC AUDIT LOG
    await prisma.log.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: 'File Upload',
        status: status,
        metadata: metadata,
        filePath: azureUrl, // Now stores the Azure Blob URL
      },
    });
  }
};