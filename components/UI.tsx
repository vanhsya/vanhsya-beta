import React, { useEffect, useState, useRef, useMemo } from "react";
import { SystemStatus, ChatMessage, SessionMode } from "../types";

interface UIProps {
  status: SystemStatus;
  mode: SessionMode;
  onStart: () => void;
  hasStarted: boolean;
  onSendText: (text: string) => void;
  onToggleMode: () => void;
  onImageUpload: (base64: string) => void;
  chatHistory?: ChatMessage[];
  touchCountPublic: number;
  touchCountPrivate: number;
  isOnline: boolean;
  audioVolume: number;
  hasMic?: boolean | null;
  signalStrength?: number;
}

const UI: React.FC<UIProps> = ({
  status,
  mode,
  onStart,
  hasStarted,
  onSendText,
  onToggleMode,
  onImageUpload,
  chatHistory = [],
  touchCountPublic,
  touchCountPrivate,
  isOnline,
  audioVolume,
  hasMic = null,
  signalStrength = 100,
}) => {
  const [inputText, setInputText] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [draftInput, setDraftInput] = useState<string>("");
  const [showAbout, setShowAbout] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendText(inputText);
      setCommandHistory((prev) => {
        // Avoid duplicate consecutive entries
        if (prev.length > 0 && prev[prev.length - 1] === inputText) {
          return prev;
        }
        return [...prev, inputText];
      });
      setInputText("");
      setHistoryIndex(-1);
      setDraftInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length === 0) return;

      let newIndex = historyIndex;
      if (historyIndex === -1) {
        // Store current typed content as draft
        setDraftInput(inputText);
        newIndex = commandHistory.length - 1;
      } else if (historyIndex > 0) {
        newIndex = historyIndex - 1;
      }

      setHistoryIndex(newIndex);
      setInputText(commandHistory[newIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;

      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInputText(commandHistory[newIndex]);
      } else {
        setHistoryIndex(-1);
        setInputText(draftInput);
      }
    }
  };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const radarRef = useRef<HTMLCanvasElement>(null);
  const isPrivate = mode === SessionMode.PRIVATE;

  const color = isPrivate ? "#ff0000" : "#5a47e7";
  const frequency = isPrivate ? "104.9 MHz" : "88.4 MHz";

  useEffect(() => {
    if (chatScrollRef.current)
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatHistory]);

  // Frequency Oscilloscope
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStarted) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;

      const sliceWidth = canvas.width / 50;
      let x = 0;

      for (let i = 0; i < 50; i++) {
        const v = (audioVolume / 128.0) * (Math.random() * 20 + 10);
        const y = canvas.height / 2 + (i % 2 === 0 ? v : -v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.stroke();
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [hasStarted, audioVolume, color]);

  // Neural Radar Sweep
  useEffect(() => {
    const canvas = radarRef.current;
    if (!canvas || !hasStarted) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let angle = 0;
    let animId: number;

    const drawRadar = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = canvas.width / 2 - 5;

      // Circles
      ctx.strokeStyle = `${color}44`;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (r / 3) * i, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Sweep
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + 0.2);
      ctx.lineTo(cx, cy);
      const gradient = ctx.createConicGradient(angle, cx, cy);
      gradient.addColorStop(0, `${color}00`);
      gradient.addColorStop(0.2, `${color}88`);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Blips (Hits)
      const hitCount = isPrivate ? touchCountPrivate : touchCountPublic;
      if (hitCount > 0) {
        ctx.fillStyle = color;
        for (let i = 0; i < (hitCount % 5) + 1; i++) {
          const bX = cx + Math.cos(i * 2) * (r * 0.6);
          const bY = cy + Math.sin(i * 2) * (r * 0.6);
          ctx.beginPath();
          ctx.arc(bX, bY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      angle += 0.03;
      animId = requestAnimationFrame(drawRadar);
    };
    drawRadar();
    return () => cancelAnimationFrame(animId);
  }, [hasStarted, color, isPrivate, touchCountPublic, touchCountPrivate]);

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 bg-[#050008] z-[200] flex items-center justify-center p-6">
        <div className="border border-[#5a47e7] p-12 text-center max-w-lg w-full bg-black/80 backdrop-blur-3xl shadow-[0_0_50px_rgba(90,71,231,0.2)]">
          <h1 className="text-5xl font-bold mb-2 tracking-[0.5em] text-white font-['Orbitron'] uppercase">
            VANHSYA
          </h1>
          <div className="h-px w-full bg-[#5a47e7]/30 my-6"></div>
          <p className="text-[10px] text-[#5a47e7] font-mono mb-8 tracking-[0.3em] uppercase leading-loose">
            Neural Radio Transmission Interface
            <br />
            Quantum-Enhanced AI Communication System
            <br />
            Secure Encryption: {isOnline ? "AES-256 CLOUD" : "LOCAL AIR-GAP"}
            <br />
            Status: Standby...
          </p>
          <div className="text-[9px] text-white/30 font-mono mb-6 tracking-wider">
            Developed by VANHSYA Group
          </div>
          <button
            onClick={onStart}
            className="group relative w-full overflow-hidden py-5 border border-[#5a47e7] text-[#5a47e7] font-bold tracking-[0.4em] uppercase transition-all hover:bg-[#5a47e7] hover:text-white"
          >
            <span className="relative z-10">Engage Neural Link</span>
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-[110] transition-colors duration-1000 ${isPrivate ? "bg-red-500/5" : "bg-blue-500/5"}`}
    >
      {/* Top Banner - Tactical HUD */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <div
            className={`border p-3 px-5 rounded-sm backdrop-blur-md font-mono text-xs tracking-widest uppercase transition-all flex items-center gap-4 ${isPrivate ? "border-red-500 text-red-500 bg-red-950/40" : "border-[#5a47e7] text-[#5a47e7] bg-black/40"}`}
          >
            <div className="flex flex-col">
              <span className="text-[8px] opacity-60">Frequency</span>
              <span className="font-bold text-lg font-['Orbitron']">
                {frequency}
              </span>
            </div>
            <div className="w-px h-10 bg-current opacity-20 mx-2"></div>
            <div className="flex flex-col">
              <span className="text-[8px] opacity-60">Mode</span>
              <span className="font-bold text-sm tracking-tighter">
                {isPrivate ? "VIGIL_PRI" : "ECHO_PUB"}
              </span>
            </div>
            <div className="w-px h-10 bg-current opacity-20 mx-2"></div>
            <div className="flex flex-col">
              <span className="text-[8px] opacity-60">Mic Link</span>
              <span
                className={`font-bold text-xs tracking-tight ${hasMic === false ? "text-red-500 line-through" : hasMic === true ? "text-green-400" : "text-yellow-500 opacity-80"}`}
              >
                {hasMic === null ? "STANDBY" : hasMic ? "ACTIVE" : "DENIED"}
              </span>
            </div>

            {/* Pulsating Wave Icon */}
            <div className="flex items-center ml-2 relative w-6 h-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="absolute inset-0 border-2 rounded-full animate-ping opacity-50"
                  style={{
                    borderColor: color,
                    animationDuration: `${1 / (1 + audioVolume / 50)}s`,
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>

            {!isOnline && (
              <span className="ml-4 px-2 py-1 bg-yellow-500 text-black font-black text-[9px] rounded-sm">
                OFFLINE
              </span>
            )}
          </div>

          <button
            onClick={onToggleMode}
            className={`pointer-events-auto border p-2 px-6 font-mono text-[9px] uppercase tracking-[0.3em] transition-all flex items-center gap-2 hover:scale-105 active:scale-95 ${isPrivate ? "bg-red-500 text-black border-red-500" : "bg-[#5a47e7] text-white border-[#5a47e7]"}`}
          >
            <div className="w-2 h-2 rounded-full bg-current animate-ping"></div>
            Relink Channel
          </button>
        </div>

        <div className="flex flex-col items-end gap-2 text-[10px] font-mono uppercase tracking-widest">
          <div className="flex gap-4 p-2 bg-black/40 border border-white/10 rounded">
            <div className="flex flex-col items-end">
              <span className="text-[#5a47e7] text-[8px]">ECHO_SYNC</span>
              <span className="text-white text-lg font-['Orbitron']">
                {touchCountPublic.toString().padStart(4, "0")}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-red-500 text-[8px]">VIGIL_SYNC</span>
              <span className="text-red-500 text-lg font-['Orbitron']">
                {touchCountPrivate.toString().padStart(4, "0")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[8px] opacity-50">LASER_GRID</span>
              <div
                className={`w-3 h-3 rounded-full ${audioVolume > 20 ? "bg-white shadow-[0_0_10px_white]" : "bg-white/20"} transition-all`}
              ></div>
            </div>
            <div className="flex flex-col items-end">
              <span
                className={`text-[9px] tracking-wider transition-all duration-300 ${signalStrength < 45 ? "text-yellow-500 font-bold animate-pulse" : "opacity-50 text-white"}`}
              >
                {signalStrength < 45 ? "⚠️ SIGNAL LOW" : "Signal Gain"}
              </span>
              <div className="flex gap-1 h-3 items-end mt-0.5">
                {[1, 2, 3, 4, 5].map((i) => {
                  const limit = i * 20;
                  const isLit = signalStrength >= limit - 15;
                  return (
                    <div
                      key={i}
                      className={`w-1 bg-current transition-all duration-300 ${isLit ? (isPrivate ? "text-red-500" : "text-blue-400") : "text-white/20"}`}
                      style={{
                        height: `${i * 20}%`,
                        opacity: isLit
                          ? audioVolume > 5
                            ? Math.random() * 0.4 + 0.6
                            : 1
                          : 0.2,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* About Toggle */}
        <button
          onClick={() => setShowAbout(!showAbout)}
          className={`pointer-events-auto border p-2 px-3 font-mono text-[8px] uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 ${isPrivate ? "border-red-500/50 text-red-500 hover:bg-red-500/10" : "border-[#5a47e7]/50 text-[#5a47e7] hover:bg-[#5a47e7]/10"}`}
        >
          ℹ️ SYS.INFO
        </button>
      </div>

      {/* About Panel */}
      {showAbout && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 pointer-events-auto">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAbout(false)}
          ></div>
          <div
            className={`relative border p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto ${isPrivate ? "border-red-500 bg-red-950/90" : "border-[#5a47e7] bg-black/90"}`}
          >
            <button
              onClick={() => setShowAbout(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white text-2xl leading-none"
            >
              ×
            </button>

            <h2 className="text-3xl font-bold mb-4 tracking-[0.3em] text-white font-['Orbitron'] uppercase">
              {isPrivate ? "VIGIL" : "VANHSYA"}
            </h2>
            <div
              className={`h-px w-full ${isPrivate ? "bg-red-500/30" : "bg-[#5a47e7]/30"} my-4`}
            ></div>

            <div className="space-y-6 text-white/80 font-mono text-xs leading-relaxed">
              <div>
                <h3
                  className={`text-sm font-bold uppercase tracking-widest mb-2 ${isPrivate ? "text-red-400" : "text-[#5a47e7]"}`}
                >
                  About VANHSYA Group
                </h3>
                <p className="text-white/70">
                  VANHSYA Group is a cutting-edge technology company
                  specializing in AI, quantum computing, and advanced robotics.
                  We develop next-generation neural interfaces and AI systems
                  that push the boundaries of human-AI interaction.
                </p>
              </div>

              <div>
                <h3
                  className={`text-sm font-bold uppercase tracking-widest mb-2 ${isPrivate ? "text-red-400" : "text-[#5a47e7]"}`}
                >
                  Quantum Mechanics Capabilities
                </h3>
                <p className="text-white/70">
                  Our AI systems are equipped with comprehensive knowledge of
                  quantum mechanics, including wave-particle duality,
                  superposition, entanglement, quantum tunneling, and quantum
                  computing principles. ECHO and VIGIL can explain complex
                  quantum phenomena with clarity and precision.
                </p>
              </div>

              <div>
                <h3
                  className={`text-sm font-bold uppercase tracking-widest mb-2 ${isPrivate ? "text-red-400" : "text-[#5a47e7]"}`}
                >
                  Beta Particle Expertise
                </h3>
                <p className="text-white/70">
                  The system has deep knowledge of beta decay processes,
                  including beta-minus (β⁻) and beta-plus (β⁺) decay, neutrino
                  emission, weak nuclear force interactions, and applications in
                  medicine, industry, and nuclear security.
                </p>
              </div>

              <div>
                <h3
                  className={`text-sm font-bold uppercase tracking-widest mb-2 ${isPrivate ? "text-red-400" : "text-[#5a47e7]"}`}
                >
                  System Architecture
                </h3>
                <p className="text-white/70">
                  Powered by Gemini 2.5 Flash Live API for real-time voice
                  interaction.
                  <br />
                  Built with React, Three.js, and WebGL for immersive 3D
                  visualization.
                  <br />
                  Features quantum-enhanced neural radio transmission interface.
                </p>
              </div>

              <div
                className={`h-px w-full ${isPrivate ? "bg-red-500/30" : "bg-[#5a47e7]/30"} my-4`}
              ></div>

              <div className="text-center">
                <p className="text-white/50 text-[10px] uppercase tracking-[0.3em]">
                  Developed by VANHSYA Group
                </p>
                <p className="text-white/30 text-[9px] mt-2">
                  © 2026 VANHSYA Group. All rights reserved.
                </p>
                <p className="text-white/20 text-[8px] mt-1">
                  Quantum-Enhanced AI Communication Systems
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Neural Chat Stream */}
      <div className="absolute top-48 left-6 bottom-40 w-80 pointer-events-auto">
        <div
          className={`h-full border backdrop-blur-xl flex flex-col overflow-hidden transition-all shadow-2xl ${isPrivate ? "border-red-500/40 bg-red-950/30" : "border-[#5a47e7]/40 bg-black/40"}`}
        >
          <div className="p-3 border-b border-inherit bg-black/20 flex justify-between items-center">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-70">
              Neural Logs
            </span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 animate-pulse delay-75"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500/20 animate-pulse delay-150"></div>
            </div>
          </div>
          {hasMic === false && (
            <div className="p-3 bg-red-950/40 border-b border-red-500/30 font-mono text-[9px] uppercase tracking-wide text-red-400 leading-normal animate-pulse">
              ⚠️ [MIC_LINK_DENIED]: Voice streaming suspended. Text interface
              fully operational. Use the Command Uplink terminal to interact.
            </div>
          )}
          <div
            ref={chatScrollRef}
            className="flex-grow overflow-y-auto p-4 space-y-4 no-scrollbar scroll-smooth"
          >
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`text-[8px] font-mono mb-1 uppercase opacity-50 flex gap-2 ${msg.mode === SessionMode.PRIVATE ? "text-red-400" : "text-blue-400"}`}
                >
                  {msg.role === "user"
                    ? "Operator"
                    : msg.mode === SessionMode.PRIVATE
                      ? "Vigil_7"
                      : "Echo_3"}
                </div>
                <div
                  className={`max-w-[95%] px-3 py-2 text-[11px] font-mono border leading-relaxed shadow-sm transition-all ${msg.role === "user" ? "border-white/20 text-white bg-white/5 italic" : msg.mode === SessionMode.PRIVATE ? "border-red-500/40 text-red-200 bg-red-950/40" : "border-[#5a47e7]/40 text-blue-200 bg-[#5a47e7]/10"}`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Command Center */}
      <div className="absolute bottom-6 left-6 right-6 flex items-end gap-6 pointer-events-auto">
        {/* Oscilloscope */}
        <div className="flex-grow max-w-sm hidden md:block">
          <div className="mb-2 text-[9px] font-mono opacity-50 uppercase tracking-[0.2em] flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
            </svg>
            Broadcasting Waveform
          </div>
          <canvas
            ref={canvasRef}
            width={400}
            height={60}
            className="w-full h-16 border border-white/5 bg-black/30 rounded-sm"
          />
        </div>

        {/* Command Input */}
        <div className="flex-grow max-w-3xl">
          <form onSubmit={handleSubmit} className="relative flex group">
            <div className="absolute -top-6 left-0 text-[8px] font-mono uppercase tracking-widest opacity-40">
              Command Uplink Channel 01
            </div>
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Tuning input for ${isPrivate ? "VIGIL" : "ECHO"}...`}
              className={`w-full border font-mono p-4 px-6 focus:outline-none transition-all text-sm tracking-wider ${isPrivate ? "bg-red-950/40 border-red-500/50 text-red-400 placeholder:text-red-900" : "bg-black/80 border-[#5a47e7]/50 text-[#5a47e7] placeholder:text-[#5a47e7]/40"}`}
            />
            <button
              type="submit"
              className={`border-y border-r px-10 font-black font-['Orbitron'] text-xs tracking-[0.2em] transition-all hover:brightness-125 ${isPrivate ? "bg-red-600 text-black border-red-500" : "bg-[#5a47e7] text-white border-[#5a47e7]"}`}
            >
              SEND
            </button>
          </form>
        </div>

        {/* Radar Array */}
        <div className="hidden lg:block relative">
          <div className="mb-2 text-right text-[9px] font-mono opacity-50 uppercase tracking-[0.2em]">
            Neural Radar Array
          </div>
          <canvas
            ref={radarRef}
            width={120}
            height={120}
            className="rounded-full border border-white/5 bg-black/40 p-1"
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div
              className="w-16 h-16 border border-current rounded-full animate-ping"
              style={{ color }}
            ></div>
          </div>
        </div>
      </div>

      {/* Right Utility Bar */}
      <div className="absolute top-48 right-6 w-12 flex flex-col gap-4 pointer-events-auto">
        <input
          type="file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              const r = new FileReader();
              r.onload = (ev) => onImageUpload(ev.target?.result as string);
              r.readAsDataURL(f);
            }
          }}
          className="hidden"
          id="asset-up"
        />
        <label
          htmlFor="asset-up"
          className={`w-12 h-12 flex items-center justify-center border cursor-pointer hover:bg-white/5 transition-all ${isPrivate ? "border-red-500/50 text-red-500" : "border-[#5a47e7]/50 text-[#5a47e7]"}`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
        </label>
      </div>

      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};
export default UI;
