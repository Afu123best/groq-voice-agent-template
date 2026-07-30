const recordBtn = document.getElementById("recordBtn");

let mediaRecorder;
let audioChunks = [];

recordBtn.addEventListener("click", async () => {
    if (!mediaRecorder || mediaRecorder.state == "inactive") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunk = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");

            const response = await fetch("/transcribe", {
                method: "POST",
                body: formData
            });

            const data = await response.json();
            document.getElementById("transcript").textContent = data.text;

            const chatResponse = await fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: "browser-session-1", message: data.text })
            });

            const chatData = await chatResponse.json();
            document.getElementById("reply").textContent = chatData.reply;

            const ttsResponse = await fetch("/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: chatData.reply })
            });

            const audioData = await ttsResponse.blob();
            const audioURL = URL.createObjectURL(audioData);
            const audio = new Audio(audioURL);
            audio.play();
        };

        mediaRecorder.start();
        recordBtn.textContent = "Stop";
    } else {
        mediaRecorder.stop();
        recordBtn.textContent = "Record";
    }
});
