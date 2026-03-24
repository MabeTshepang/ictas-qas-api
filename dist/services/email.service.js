"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const resend_1 = require("resend");
// Ensure RESEND_API_KEY is in your .env
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
const sendEmail = async ({ to, subject, html }) => {
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
    }
    catch (error) {
        console.error("EMAIL_SERVICE_EXCEPTION:", error);
        throw error;
    }
};
exports.sendEmail = sendEmail;
