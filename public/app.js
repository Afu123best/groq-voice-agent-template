function generateSessionId(){
    return Date.now().toString() + "-" + Math.random().toString(36).slice(2);
}

const recordBtn = document.getElementById("recordBtn");
const newConvoBtn = document.getElementById("newConvoBtn");

let sessionId = generateSessionId();
let mediaRecorder;
let audioChunks = [];

async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

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
            body: JSON.stringify({ sessionId: sessionId, message: data.text })
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
        audio.onended = () => {
            startRecording();
        };
    };

    mediaRecorder.start();
    recordBtn.textContent = "Stop";
    detectSilence(analyser);
}

function detectSilence(analyser){
    const data = new Uint8Array(analyser.fftSize);
    let silenceStart = null;
    const silenceThreshold = 2;
    const silenceDuration = 1500;

    function checkVolume(){
        if (mediaRecorder.state != "recording") return;

        analyser.getByteTimeDomainData(data);

        let sumDeviation = 0;
        for (let i = 0; i < data.length; i++){
            sumDeviation += Math.abs(data[i] - 128);
        }
        const averageVolume = sumDeviation / data.length;

        if (averageVolume < silenceThreshold){
            if (silenceStart === null){
                silenceStart = Date.now();
            } else if (Date.now() - silenceStart > silenceDuration){
                mediaRecorder.stop();
                recordBtn.textContent = "Record";
                return;
            }
        } else{
                silenceStart = null;
        }

        requestAnimationFrame(checkVolume);
    }
    checkVolume();
}

recordBtn.addEventListener("click", () => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        startRecording();
    } else {
        mediaRecorder.stop();
        recordBtn.textContent = "Record";
    }
});

newConvoBtn.addEventListener("click", () => {
    sessionId = generateSessionId();
    document.getElementById("transcript").textContent = "";
    document.getElementById("reply").textContent = "";
});