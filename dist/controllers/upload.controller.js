"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUpload = void 0;
const document_service_1 = require("../services/document.service");
const handleUpload = async (req, res) => {
    const user = req.user;
    if (!req.file) {
        return res.status(400).json({ error: 'No PDF file provided' });
    }
    try {
        const result = await (0, document_service_1.processAndSendPDF)(req.file.buffer, user, req.file.originalname);
        res.status(200).json({
            message: 'Processing complete',
            auditUrl: result.url
        });
    }
    catch (error) {
        console.error("UPLOAD_CONTROLLER_ERROR:", error.message);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};
exports.handleUpload = handleUpload;
