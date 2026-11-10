"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Square, Send, X, AlertCircle } from "lucide-react";

interface VoiceDictationProps {
  onTranscriptChange: (text: string) => void;
  onSend?: (finalText: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceDictation({
  onTranscriptChange,
  onSend,
  disabled = false,
  className = "",
}: VoiceDictationProps) {
  const [isListening, setIsListening] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [interimText, setInterimText] = useState("");

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baseTranscriptRef = useRef<string>("");

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSeconds(0);
  }, []);

  const stopRecognition = useCallback((keepText = true) => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    stopTimer();
    setIsListening(false);
    setInterimText("");
    if (!keepText) {
      onTranscriptChange("");
    }
  }, [stopTimer, onTranscriptChange]);

  const startListening = () => {
    setErrorMessage(null);

    // Check Web Speech API support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      baseTranscriptRef.current = "";
      setInterimText("");

      recognition.onstart = () => {
        setIsListening(true);
        setSeconds(0);
        timerRef.current = setInterval(() => {
          setSeconds((s) => s + 1);
        }, 1000);
      };

      recognition.onresult = (event: any) => {
        let finalStr = "";
        let interimStr = "";

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            finalStr += item[0].transcript + " ";
          } else {
            interimStr += item[0].transcript;
          }
        }

        const combined = (finalStr + interimStr).trim();
        setInterimText(combined);
        onTranscriptChange(combined);
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech recognition error:", e.error);
        if (e.error === "not-allowed" || e.error === "permission-denied") {
          setErrorMessage("Microphone permission denied. Please allow microphone access in your browser.");
        } else if (e.error !== "no-speech") {
          setErrorMessage(`Speech error: ${e.error}`);
        }
        stopRecognition(true);
      };

      recognition.onend = () => {
        setIsListening(false);
        stopTimer();
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error("Speech start error:", err);
      setErrorMessage("Could not access microphone.");
      setIsListening(false);
      stopTimer();
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopRecognition(false);
  };

  const handleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = interimText.trim();
    stopRecognition(true);
    if (onSend && current) {
      onSend(current);
    }
  };

  useEffect(() => {
    return () => {
      stopRecognition(false);
    };
  }, [stopRecognition]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Non-intrusive error banner */}
      {errorMessage && (
        <div className="absolute bottom-full left-0 mb-2 z-50 flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-950/90 border border-rose-500/40 text-rose-200 text-xs shadow-xl backdrop-blur-md max-w-xs animate-in fade-in slide-in-from-bottom-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="ml-auto text-rose-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!isListening ? (
        /* Normal State: Mic button */
        <button
          type="button"
          onClick={startListening}
          disabled={disabled}
          title="Dictate with voice"
          aria-label="Start voice dictation"
          className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Mic className="w-4 h-4 stroke-[2.2]" />
        </button>
      ) : (
        /* Active Recording Capsule: Clean, sleek, non-colliding */
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-violet-950/80 border border-violet-500/50 text-white shadow-lg shadow-violet-900/30 animate-in fade-in zoom-in-95 duration-150">
          {/* Pulsing indicator */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
          </span>

          {/* Timer */}
          <span className="text-xs font-mono font-bold text-violet-200 tabular-nums">
            {formatTime(seconds)}
          </span>

          {/* Sound waves animation */}
          <div className="flex items-center gap-0.5 h-3 px-1">
            <span className="w-0.5 h-2.5 bg-violet-400 rounded-full animate-pulse" />
            <span className="w-0.5 h-4 bg-violet-300 rounded-full animate-pulse delay-75" />
            <span className="w-0.5 h-1.5 bg-violet-400 rounded-full animate-pulse delay-150" />
            <span className="w-0.5 h-3.5 bg-violet-300 rounded-full animate-pulse delay-200" />
          </div>

          {/* Cancel button */}
          <button
            type="button"
            onClick={handleCancel}
            title="Cancel dictation"
            aria-label="Cancel recording"
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20 text-neutral-300 hover:text-rose-300 transition-colors ml-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Done / Send button */}
          <button
            type="button"
            onClick={handleDone}
            title="Send voice message"
            aria-label="Finish recording"
            className="w-5 h-5 rounded-full bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition-all active:scale-95 shadow-sm"
          >
            <Send className="w-2.5 h-2.5 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
}
