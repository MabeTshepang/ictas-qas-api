"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAndSendPDF = void 0;
const resend_1 = require("resend");
const db_1 = __importDefault(require("../config/db"));
const pdf_helper_1 = require("../utils/pdf-helper");
const azure_storage_service_1 = require("./azure-storage.service");
const tenant_controller_1 = require("../controllers/tenant.controller");
const date_fns_1 = require("date-fns");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
const processAndSendPDF = async (fileBuffer, user, originalName) => {
    let status = 'Failed';
    let metadata = {};
    let azureUrl = null;
    try {
        const tenant = await (0, tenant_controller_1.getTenantInfo)(user.tenantId);
        const encryptedBuffer = await (0, pdf_helper_1.encryptPdfBuffer)(fileBuffer);
        const dateStamp = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
        const fileName = `${tenant.fileSlug}_${dateStamp}_${originalName}`;
        azureUrl = await (0, azure_storage_service_1.uploadToAzure)(encryptedBuffer, fileName, user.tenantId);
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
        if (error)
            throw new Error(error.message);
        status = 'Sent';
        metadata = { resendId: data?.id };
        return { id: data?.id, url: azureUrl };
    }
    catch (err) {
        status = 'Failed';
        metadata = { error: err.message };
        throw err;
    }
    finally {
        await db_1.default.log.create({
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
exports.processAndSendPDF = processAndSendPDF;
