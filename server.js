import "dotenv/config";
import Groq from "groq-sdk";
import multer from "multer";
import express from "express";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const groq = new Groq({apiKey: process.env.GROQ_API_KEY});
app.use(express.json());
const PORT = 3001;

app.get("/health", (req,res) =>{
    res.json({ok: true});
});

app.post("/chat", async (req,res) => {
    const {message} = req.body;

    const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
            {role: "user", content: message}
        ]
    });

    const reply = completion.choices[0].message.content;

    res.json({ reply });
});

app.post("/transcribe", upload.single("audio"), async (req,res) => {
    const file = req.file;

    const transcription = await groq.audio.transcriptions.create({
        file: new File([file.buffer], "audio.webm", { type: file.mimetype }),
        model: "whisper-large-v3-turbo"
    });

    res.json({ text: transcription.text });
});

app.post("/tts", async (req,res) => {
    const { text } = req.body;  

    const response = await groq.audio.speech.create({
        model: "canopylabs/orpheus-v1-english",
        voice: "hannah",
        input: text,
        response_format: "wav"
    });

    const buffer = Buffer.from(await response.arrayBuffer());

    res.set("Content-Type", "audio/wav");
    res.send(buffer);
})

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});