import { Resend } from 'resend';

// Ensure RESEND_API_KEY is in your .env
const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: SendEmailOptions) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `ICTAS Admin <${process.env.SENDER_EMAIL}>`,
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error("RESEND_ERROR:", error);
      throw new Error("Failed to send email");
    }

    return data;
  } catch (error) {
    console.error("EMAIL_SERVICE_EXCEPTION:", error);
    throw error;
  }
};