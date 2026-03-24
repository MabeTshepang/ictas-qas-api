import muhammara from 'muhammara';

export const encryptPdfBuffer = async (inputBuffer: Buffer): Promise<Buffer> => {
    const inputStream = new muhammara.PDFRStreamForBuffer(inputBuffer);
    
    const outputStream = new muhammara.PDFWStreamForBuffer();

    try {

        muhammara.recrypt(inputStream, outputStream, {
            userPassword: 'spectrumcs@2025',
            ownerPassword: process.env.PDF_OWNER_PASSWORD || 'internal-admin-only',
            userProtectionFlag: 4,
        });

        return outputStream.buffer;
    } catch (error) {
        console.error('[Encryption Error]:', error);
        throw new Error('Failed to secure PDF document');
    }
};