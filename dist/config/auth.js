"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.hashPassword = exports.verifyPassword = void 0;
const argon2_1 = __importDefault(require("argon2"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const verifyPassword = async (hash, password) => {
    try {
        return await argon2_1.default.verify(hash, password);
    }
    catch (error) {
        return false;
    }
};
exports.verifyPassword = verifyPassword;
const hashPassword = async (password) => {
    return await argon2_1.default.hash(password);
};
exports.hashPassword = hashPassword;
const generateToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });
};
exports.generateToken = generateToken;
