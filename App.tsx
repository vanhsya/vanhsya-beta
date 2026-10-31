import React, { useState, useEffect, useRef, useCallback } from "react";
import Scene from "./components/Scene";
import UI from "./components/UI";
import { SystemStatus, ChatMessage, SessionMode } from "./types";
import { LiveService } from "./services/liveService";
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus>(SystemStatus.OPTIMAL);
  const [mode, setMode] = useState<SessionMode>(SessionMode.PUBLIC);
  const [hasStarted, setHasStarted] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [audioVolume, setAudioVolume] = useState(0);
  const [touchCountPublic, setTouchCountPublic] = useState(0);
  const [touchCountPrivate, setTouchCountPrivate] = useState(0);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [hasMic, setHasMic] = useState<boolean | null>(null);
  const [signalStrength, setSignalStrength] = useState<number>(100);

  const [isScanning, setIsScanning] = useState(false);
  const [enhancedImageUrl, setEnhancedImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  const liveServiceRef = useRef<LiveService | null>(null);
  const neuralSynthRef = useRef<AudioContext | null>(null);

  const triggerProceduralNoise = useCallback((strength: number) => {
    try {
      if (!neuralSynthRef.current) {
        neuralSynthRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      }
      const ctx = neuralSynthRef.current;
      if (ctx.state === "suspended") ctx.resume();

      // Procedural white noise duration: 0.2 to 0.7 seconds of static
      const duration = 0.2 + Math.random() * 0.5;
      // Volume scales inversely with signal strength
      const volume = Math.max(0.003, (1 - strength / 100) * 0.04);

      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate actual procedural white noise + heavy dust crackle spikes
      for (let i = 0; i < bufferSize; i++) {
        const crackle =
          Math.random() < 0.008 ? (Math.random() * 2 - 1) * 3.0 : 0;
        data[i] = (Math.random() * 2 - 1) * 0.4 + crackle;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Classically tuned bandpass filter to sound like analog AM radio tuning static
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(
        700 + Math.random() * 1500,
        ctx.currentTime,
      );
      filter.Q.setValueAtTime(1.1, ctx.currentTime);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + duration,
      );

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.start();
      source.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error("NeuralSynth procedural white noise failed:", e);
    }
  }, []);

  // Fluctuating Signal Strength HUD driver & Dynamic static bursts
  useEffect(() => {
    if (!hasStarted) return;

    const interval = setInterval(() => {
      setSignalStrength((prev) => {
        const base = isOnline ? 92 : 23;
        const fluctuation = Math.round(Math.random() * 14 - 7); // +/- 7%
        const next = Math.max(5, Math.min(100, base + fluctuation));

        // When signal strength is low, randomly trigger procedural static crackles
        if (next < 45 && Math.random() < 0.38) {
          triggerProceduralNoise(next);
        }
        return next;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [hasStarted, isOnline, triggerProceduralNoise]);

  // Connectivity Listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (hasStarted) handleStart();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setStatus(SystemStatus.OFFLINE);
      if (liveServiceRef.current) liveServiceRef.current.isOffline = true;
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [hasStarted]);

  const playNeuralSound = useCallback(
    (mode: SessionMode) => {
      if (!neuralSynthRef.current) {
        neuralSynthRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      }
      const ctx = neuralSynthRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const noise = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Tuning Effect
      if (mode === SessionMode.PUBLIC) {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.2);
      }

      // Static burst
      noise.type = "square";
      noise.frequency.setValueAtTime(12000, ctx.currentTime);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.02, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.05,
      );
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();
      noise.stop(ctx.currentTime + 0.05);

      // If signal strength is low, add an extra dynamic layer of dirty radio white noise feedback
      if (signalStrength < 45) {
        try {
          const burstDuration = 0.15;
          const burstBufferSize = ctx.sampleRate * burstDuration;
          const burstBuffer = ctx.createBuffer(
            1,
            burstBufferSize,
            ctx.sampleRate,
          );
          const burstData = burstBuffer.getChannelData(0);
          for (let i = 0; i < burstBufferSize; i++) {
            const crackleSpike =
              Math.random() < 0.02 ? Math.random() * 2 - 1 : 0;
            burstData[i] = (Math.random() * 2 - 1) * 0.3 + crackleSpike;
          }
          const burstSource = ctx.createBufferSource();
          burstSource.buffer = burstBuffer;

          const burstFilter = ctx.createBiquadFilter();
          burstFilter.type = "bandpass";
          burstFilter.frequency.setValueAtTime(1000, ctx.currentTime);
          burstFilter.Q.setValueAtTime(1.5, ctx.currentTime);

          const burstGain = ctx.createGain();
          burstGain.gain.setValueAtTime(0.04, ctx.currentTime);
          burstGain.gain.exponentialRampToValueAtTime(
            0.0001,
            ctx.currentTime + burstDuration,
          );

          burstSource.connect(burstFilter);
          burstFilter.connect(burstGain);
          burstGain.connect(ctx.destination);
          burstSource.start();
          burstSource.stop(ctx.currentTime + burstDuration);
        } catch (err) {
          console.error(
            "Touch feedback low signal static injection failed:",
            err,
          );
        }
      }

      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    },
    [signalStrength],
  );

  const handleTouch = useCallback(() => {
    if (mode === SessionMode.PUBLIC) setTouchCountPublic((p) => p + 1);
    else setTouchCountPrivate((p) => p + 1);
    playNeuralSound(mode);
  }, [mode, playNeuralSound]);

  const addChatMessage = useCallback(
    (text: string, role: "user" | "model") => {
      setChatHistory((prev) => [
        ...prev,
        { role, text, timestamp: Date.now(), mode, isLocal: !isOnline },
      ]);
    },
    [mode, isOnline],
  );

  const handleStart = async () => {
    try {
      setStatus(SystemStatus.INITIALIZING);
      const service = new LiveService({
        onVolumeChange: (vol) => setAudioVolume(vol),
        onClose: () => console.log("Connection offline"),
        onThreatCancel: () => setMode(SessionMode.PUBLIC),
        onTranscript: (text, role) => addChatMessage(text, role),
        onMicStatus: (granted) => setHasMic(granted),
      });
      await service.connect(mode);
      liveServiceRef.current = service;
      setHasStarted(true);
      setStatus(isOnline ? SystemStatus.OPTIMAL : SystemStatus.OFFLINE);
    } catch (error) {
      console.error("Linkage failed", error);
      setHasStarted(true);
      setStatus(SystemStatus.OFFLINE);
    }
  };

  const handleToggleMode = async () => {
    const newMode =
      mode === SessionMode.PUBLIC ? SessionMode.PRIVATE : SessionMode.PUBLIC;
    setMode(newMode);
    if (liveServiceRef.current) {
      await liveServiceRef.current.switchMode(newMode);
    }
    playNeuralSound(newMode);
  };

  const handleSendText = async (text: string) => {
    if (liveServiceRef.current) {
      addChatMessage(text, "user");
      await liveServiceRef.current.sendText(text);
    } else if (!isOnline) {
      addChatMessage(text, "user");
      setTimeout(
        () =>
          addChatMessage(
            "LOCAL_PROTOCOL: Frequency unstable. Running local diagnostics.",
            "model",
          ),
        500,
      );
    }
  };

  const handleImageEnhance = async (base64: string) => {
    if (isScanning || !isOnline) return;
    setIsScanning(true);
    setOriginalImageUrl(base64);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: { data: base64.split(",")[1], mimeType: "image/png" },
            },
            { text: "Analyze and enhance robotic visual asset." },
          ],
        },
      });
      const part = response.candidates[0].content.parts.find(
        (p) => p.inlineData,
      );
      if (part)
        setEnhancedImageUrl(`data:image/png;base64,${part.inlineData.data}`);
    } catch (err) {
      console.error(err);
    }
    setIsScanning(false);
  };

  return (
    <div className="w-full h-screen bg-[#050008] overflow-hidden select-none">
      <Scene
        status={status}
        mode={mode}
        audioVolume={audioVolume}
        onTouch={handleTouch}
      />
      <UI
        status={status}
        mode={mode}
        onStart={handleStart}
        hasStarted={hasStarted}
        onSendText={handleSendText}
        onToggleMode={handleToggleMode}
        onImageUpload={handleImageEnhance}
        chatHistory={chatHistory}
        touchCountPublic={touchCountPublic}
        touchCountPrivate={touchCountPrivate}
        isOnline={isOnline}
        audioVolume={audioVolume}
        hasMic={hasMic}
        signalStrength={signalStrength}
      />
    </div>
  );
};
export default App;
