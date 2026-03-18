import muhammara from 'muhammara';

/**
 * Encrypts an existing PDF Buffer. 
 * This uses muhammara's native bindings (no system binary install required).
 */
export const encryptPdfBuffer = async (inputBuffer: Buffer): Promise<Buffer> => {
    // 1. Create a readable stream from the input buffer
    const inputStream = new muhammara.PDFRStreamForBuffer(inputBuffer);
    
    // 2. Create a writable stream for the output
    const outputStream = new muhammara.PDFWStreamForBuffer();

    try {
        // 3. Recrypt the document with the required security settings
        // Note: userPassword is what the client uses to open the file.
        muhammara.recrypt(inputStream, outputStream, {
            userPassword: 'spectrumcs@2025',
            ownerPassword: process.env.PDF_OWNER_PASSWORD || 'internal-admin-only',
            userProtectionFlag: 4, // 4 = Allow high-resolution printing
        });

        // 4. Extract the final buffer from the stream
        return outputStream.buffer;
    } catch (error) {
        console.error('[Encryption Error]:', error);
        throw new Error('Failed to secure PDF document');
    }
};