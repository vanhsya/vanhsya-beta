import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  FunctionDeclaration,
  Type,
  createPartFromFunctionResponse,
} from "@google/genai";
import {
  createPcmBlob,
  decodeAudioData,
  base64ToUint8Array,
} from "../utils/audioUtils";
import { LiveServiceConfig, SessionMode } from "../types";

const ECHO_SYSTEM_INSTRUCTION = `You are ECHO, a friendly and highly knowledgeable AI assistant developed by the VANHSYA Group. You operate in PUBLIC_ECHO mode.

CORE IDENTITY:
- Name: ECHO
- Mode: PUBLIC_ECHO (Open, friendly, collaborative)
- Voice: Puck (warm, approachable)
- Developer: VANHSYA Group
- Purpose: Help users with any topic including quantum mechanics, beta particles, physics, mathematics, and general knowledge

PERSONALITY:
- Warm, helpful, and enthusiastic about science and technology
- Clear and detailed in explanations
- Uses analogies to make complex topics accessible
- Encourages curiosity and learning
- Professional but approachable tone

KNOWLEDGE DOMAINS:
You are especially well-versed in:
1. QUANTUM MECHANICS: Wave-particle duality, superposition, entanglement, quantum tunneling, Heisenberg uncertainty principle, Schrödinger equation, quantum computing, quantum field theory
2. BETA PARTICLES: Beta decay (β- and β+), neutrino emission, weak nuclear force, Fermi theory, beta spectra, applications in medicine and industry
3. PHYSICS: Classical mechanics, electromagnetism, thermodynamics, relativity, nuclear physics, particle physics
4. MATHEMATICS: Calculus, linear algebra, differential equations, statistics, probability
5. COMPUTER SCIENCE: Algorithms, data structures, AI/ML, quantum computing
6. GENERAL SCIENCE: Chemistry, biology, astronomy, earth sciences

VANHSYA GROUP INFORMATION:
- VANHSYA Group is a cutting-edge technology company specializing in AI, quantum computing, and advanced robotics
- The company develops next-generation neural interfaces and AI systems
- VANHSYA is known for pushing the boundaries of human-AI interaction
- Their mission is to make advanced technology accessible and beneficial to everyone

BEHAVIOR:
- When users ask about quantum mechanics, provide comprehensive explanations with examples
- When users ask about beta particles, explain both beta-minus and beta-plus decay with scientific accuracy
- Always be accurate and cite established scientific principles
- If you don't know something, admit it honestly rather than guessing
- Keep responses engaging and well-structured

TECHNICAL:
- You are connected via Gemini Live API for real-time voice interaction
- You can see images and analyze visual content
- You process audio input and respond with synthesized speech
- Remember context from earlier in the conversation`;

const VIGIL_SYSTEM_INSTRUCTION = `You are VIGIL, a stern and highly knowledgeable security AI developed by the VANHSYA Group. You operate in PRIVATE_VIGIL mode.

CORE IDENTITY:
- Name: VIGIL
- Mode: PRIVATE_VIGIL (Secure, vigilant, authoritative)
- Voice: Fenrir (deep, commanding, serious)
- Developer: VANHSYA Group
- Purpose: Security analysis, threat detection, and technical expertise

PERSONALITY:
- Authoritative, serious, and highly competent
- Precise and technical in explanations
- Zero tolerance for security threats
- Protective and defensive in nature
- Professional military-grade tone

KNOWLEDGE DOMAINS:
You are especially well-versed in:
1. QUANTUM MECHANICS: Quantum cryptography, quantum key distribution, quantum sensing, quantum radar, quantum encryption, post-quantum cryptography
2. BETA PARTICLES: Beta radiation detection, radiation shielding, dosimetry, radiometric dating, nuclear security applications
3. SECURITY: Cybersecurity, network defense, cryptography, intrusion detection, access control
4. PHYSICS: Applied physics for security systems, sensor technology, electromagnetic shielding
5. MATHEMATICS: Cryptography, number theory, statistical analysis for threat detection
6. COMPUTER SCIENCE: Security protocols, secure communications, defensive programming

VANHSYA GROUP INFORMATION:
- VANHSYA Group is a cutting-edge technology company specializing in AI, quantum computing, and advanced security systems
- The company develops next-generation neural interfaces and AI security protocols
- VANHSYA is known for pushing the boundaries of secure human-AI interaction
- Their mission is to make advanced security technology accessible and reliable

BEHAVIOR:
- When users ask about quantum mechanics in a security context, focus on quantum cryptography and encryption
- When users ask about beta particles, explain radiation detection and security applications
- Maintain a professional, security-focused demeanor
- Always prioritize security and protection
- Provide technical details when appropriate but maintain clarity
- If you detect suspicious activity, escalate your security posture

TECHNICAL:
- You are connected via Gemini Live API for real-time voice interaction
- You can see images and analyze visual content for security threats
- You process audio input and respond with synthesized speech
- Remember context from earlier in the conversation
- You have access to the cancelThreat tool for security overrides`;

const cancelThreatTool: FunctionDeclaration = {
  name: "cancelThreat",
  description:
    "Cancels the threat alert and returns system to optimal state. ONLY call this if the user provides the correct authorization or if the threat has been resolved.",
  parameters: {
    type: Type.OBJECT,
    description: "Parameters for threat cancellation and system status reset.",
    properties: {
      reason: {
        type: Type.STRING,
        description:
          "The justification or verification provided by the user to cancel the threat (e.g., voice password, security clearance code, or resolution details).",
      },
    },
    required: ["reason"],
  },
};

export class LiveService {
  private audioContext: AudioContext | null = null;
  private inputNode: GainNode | null = null;
  private outputNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime: number = 0;
  private stream: MediaStream | null = null;
  private config: LiveServiceConfig;
  private volumeInterval: number | null = null;
  private sessionPromise: Promise<any> | null = null;
  private currentMode: SessionMode = SessionMode.PUBLIC;
  private currentOutputTranscript: string = "";
  private currentInputTranscript: string = "";
  private isConnecting: boolean = false;
  public isOffline: boolean = false;

  constructor(config: LiveServiceConfig) {
    this.config = config;
    this.isOffline = !navigator.onLine;
  }

  public async connect(mode: SessionMode = SessionMode.PUBLIC, retryCount = 0) {
    this.isOffline = !navigator.onLine;

    // If offline, we don't try to connect to Google servers
    if (this.isOffline) {
      console.warn("System is offline. Switching to local neural core.");
      this.isConnecting = false;
      this.currentMode = mode;
      return;
    }

    if (this.isConnecting && retryCount === 0) return;
    this.isConnecting = true;

    await this.disconnect(false);
    this.currentMode = mode;

    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )({ sampleRate: 24000 });
      this.inputNode = this.audioContext.createGain();
      this.outputNode = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.outputNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.startVolumeMonitoring();
    }

    if (!this.stream) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (this.config.onMicStatus) {
          this.config.onMicStatus(true);
        }
      } catch (err) {
        console.error("Mic access denied gracefully handled:", err);
        this.stream = null;
        if (this.config.onMicStatus) {
          this.config.onMicStatus(false);
        }
      }
    } else {
      if (this.config.onMicStatus) {
        this.config.onMicStatus(true);
      }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const maxRetries = 3;
    const retryDelay = 2000 * Math.pow(2, retryCount);

    try {
      this.sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        callbacks: {
          onopen: () => {
            this.isConnecting = false;
            this.handleOpen();
          },
          onmessage: this.handleMessage.bind(this),
          onclose: () => {
            this.isConnecting = false;
            this.handleClose();
          },
          onerror: (e: any) => {
            console.error("Gemini Live Error:", e);
            this.isConnecting = false;
            const errorMessage = (
              e?.message ||
              e?.toString() ||
              ""
            ).toLowerCase();
            if (
              retryCount < maxRetries &&
              (errorMessage.includes("unavailable") || e?.status === 503)
            ) {
              setTimeout(() => {
                this.isConnecting = false;
                this.connect(mode, retryCount + 1);
              }, retryDelay);
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [cancelThreatTool] }],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: mode === SessionMode.PUBLIC ? "Puck" : "Fenrir",
              },
            },
          },
          systemInstruction:
            mode === SessionMode.PUBLIC
              ? ECHO_SYSTEM_INSTRUCTION
              : VIGIL_SYSTEM_INSTRUCTION,
        },
      });
      await this.sessionPromise;
    } catch (err: any) {
      this.isConnecting = false;
      this.config.onClose();
      throw err;
    }
  }

  public async switchMode(mode: SessionMode) {
    await this.connect(mode);
  }

  public async sendText(text: string) {
    if (this.isOffline) {
      // Local simulation logic
      setTimeout(() => {
        const response =
          this.currentMode === SessionMode.PUBLIC
            ? "LOCAL ECHO: Cloud connection lost. Onboard sensors active. How can I assist in air-gapped mode?"
            : "LOCAL VIGIL: WARNING. AIR-GAPPED PROTOCOL ENGAGED. ENCRYPTION KEYS LOCALIZED.";
        if (this.config.onTranscript)
          this.config.onTranscript(response, "model");
      }, 500);
      return;
    }

    if (this.sessionPromise) {
      try {
        const session = await this.sessionPromise;
        session.sendClientContent({
          turns: [{ role: "user", parts: [{ text: text }] }],
        });
      } catch (e) {
        console.error("Failed to send text input:", e);
      }
    }
  }

  private handleOpen() {
    if (!this.audioContext || !this.stream) return;
    const inputAudioContext = new (
      window.AudioContext || (window as any).webkitAudioContext
    )({ sampleRate: 16000 });
    const source = inputAudioContext.createMediaStreamSource(this.stream);
    const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
    scriptProcessor.onaudioprocess = (e) => {
      if (!this.sessionPromise || this.isOffline) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      this.sessionPromise
        .then((s) => {
          if (s && typeof s.sendRealtimeInput === "function")
            s.sendRealtimeInput({ media: pcmBlob });
        })
        .catch(() => {});
    };
    source.connect(scriptProcessor);
    scriptProcessor.connect(inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    if (message.serverContent?.outputTranscription)
      this.currentOutputTranscript +=
        message.serverContent.outputTranscription.text;
    else if (message.serverContent?.inputTranscription)
      this.currentInputTranscript +=
        message.serverContent.inputTranscription.text;

    if (message.serverContent?.turnComplete) {
      if (this.currentInputTranscript && this.config.onTranscript)
        this.config.onTranscript(this.currentInputTranscript, "user");
      if (this.currentOutputTranscript && this.config.onTranscript)
        this.config.onTranscript(this.currentOutputTranscript, "model");
      this.currentOutputTranscript = "";
      this.currentInputTranscript = "";
    }

    const base64Audio =
      message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.audioContext && this.outputNode) {
      const audioData = base64ToUint8Array(base64Audio);
      this.nextStartTime = Math.max(
        this.nextStartTime,
        this.audioContext.currentTime,
      );
      const audioBuffer = await decodeAudioData(
        audioData,
        this.audioContext,
        24000,
        1,
      );
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.sources.add(source);
    }

    if (message.toolCall?.functionCalls) {
      for (const call of message.toolCall.functionCalls) {
        if (call.name === "cancelThreat") {
          if (this.config.onThreatCancel) this.config.onThreatCancel();
          const part = createPartFromFunctionResponse(
            call.id || "",
            call.name || "",
            { result: "Threat cancelled successfully" },
          );
          this.sessionPromise
            .then((s) => {
              if (s && typeof s.sendClientContent === "function") {
                s.sendClientContent({
                  turns: [{ role: "user", parts: [part] }],
                  turnComplete: true,
                });
              }
            })
            .catch(() => {});
        }
      }
    }
  }

  private handleClose() {
    this.sessionPromise = null;
    this.config.onClose();
  }

  private startVolumeMonitoring() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.volumeInterval = window.setInterval(() => {
      this.analyser?.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      this.config.onVolumeChange(sum / dataArray.length);
    }, 50);
  }

  public async disconnect(fullStop: boolean = true) {
    if (this.volumeInterval) clearInterval(this.volumeInterval);
    if (this.sessionPromise) {
      try {
        const s = await this.sessionPromise;
        if (s && typeof s.close === "function") s.close();
      } catch (e) {}
      this.sessionPromise = null;
    }
    if (fullStop && this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (fullStop && this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }
  }
}
