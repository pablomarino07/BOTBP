import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODELOS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

async function test() {
    for (const m of MODELOS) {
        console.log("Testing:", m);
        try {
            const model = genAI.getGenerativeModel({ model: m });
            const res = await model.generateContent("hola");
            console.log("OK:", m);
        } catch (e) {
            console.log("ERR:", m, e.message);
        }
    }
}
test();
