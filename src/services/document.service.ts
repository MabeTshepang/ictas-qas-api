import { Resend } from 'resend';
import prisma from '../config/db';
import { encryptPdfBuffer } from '../utils/pdf-helper';
import { uploadToAzure } from './azure-storage.service';
import { getTenantInfo } from '../controllers/tenant.controller';
import { format } from 'date-fns';

const resend = new Resend(process.env.RESEND_API_KEY);

export const processAndSendPDF = async (fileBuffer: Buffer, user: any, originalName: string) => {
  let status: 'Sent' | 'Failed' = 'Failed';
  let metadata: any = {};
  let azureUrl: string | null = null;

  try {
    const tenant = await getTenantInfo(user.tenantId);

    const encryptedBuffer = await encryptPdfBuffer(fileBuffer);

    const dateStamp = format(new Date(), 'yyyy-MM-dd');
    const fileName = `${tenant.fileSlug}_${dateStamp}_${originalName}`;

    azureUrl = await uploadToAzure(encryptedBuffer, fileName, user.tenantId);

    const { data, error } = await resend.emails.send({
      from: `ICTAS ${tenant.name} <${process.env.SENDER_EMAIL}>`,
      to: [process.env.RECEIVER_EMAIL || ''],
      cc: [process.env.CCRECEIVER_EMAIL || ''],
      bcc: [process.env.BCCRECEIVER_EMAIL || ''],
      subject: `ICTAS ${tenant.name} - Delivery Note`,
      html: `<strong>Find Attached ${tenant.name} Grain Assessment Form</strong>`,
      attachments: [
        {
          filename: fileName,
          content: encryptedBuffer,
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
    await prisma.log.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: 'File Upload',
        status: status,
        metadata: metadata,
        filePath: azureUrl,
      },
    });
  }
};