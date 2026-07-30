import "dotenv/config";
import Groq from "groq-sdk";
import multer from "multer";
import express from "express";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const groq = new Groq({apiKey: process.env.GROQ_API_KEY});
const conversations = new Map();
const tickets = [];
app.use(express.json());
const PORT = 3001;
const tickeTool = [
    {
        type: "function",
        function: {
            name: "create_ticket",
            description: "Create a help desk ticket once all four fields are known",
            parameters: {
                type: "object",
                properties: {
                    mainCategory: {type: "string"},
                    subCategory: {type: "string"},
                    shortDescription: {type: "string"},
                    longDescription: {type: "string"}
                },
                required: ["mainCategory", "subCategory", "shortDescription", "longDescription"]
            }
        }
    }
];

app.get("/health", (req,res) =>{
    res.json({ok: true});
});

app.post("/chat", async (req,res) => {
    const { sessionId, message} = req.body;

    if (!conversations.has(sessionId)){
        conversations.set(sessionId, [
            {
                role: "system",
                content: "You are Zaraa, a helpdesk agent in treet manufacturing. Collect these four things from the user through natural conversation, one question at a time: Main Category, Sub Category, Short Description, Long Description. Once you have all four, call the create_ticket tool. Keep responses short and professionally flirty. This is a spoken conversation."
            }
        ]);
    }

    const history = conversations.get(sessionId);

    history.push({ role: "user", content: message});

    const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: history,
        tools: tickeTool
    });

    const responseMessage = completion.choices[0].message;

    if (responseMessage.tool_calls){
        const call = responseMessage.tool_calls[0];
        const ticketArgs = JSON.parse(call.function.arguments);
        
        ticketArgs.id = tickets.length + 1;
        tickets.push(ticketArgs);

        history.push(responseMessage);
        history.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ status: "created", ticketId: ticketArgs.id })
        });

        res.json({ reply: "Ticket created!", ticket: ticketArgs });
    } else{
        history.push({ role: "assistant", content: responseMessage.content });
        res.json({ reply: responseMessage.content });
    }
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
});

app.get("/tickets", (req,res) =>{
    res.json(tickets);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});