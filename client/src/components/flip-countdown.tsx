import { useState, useEffect, useRef, useCallback } from "react";

interface FlipCardProps {
  value: string;
  label: string;
}

function FlipCard({ value, label }: FlipCardProps) {
  const [currentValue, setCurrentValue] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (value !== currentValue) {
      setPreviousValue(currentValue);
      setFlipping(true);
      const timeout = setTimeout(() => {
        setCurrentValue(value);
        setFlipping(false);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [value, currentValue]);

  return (
    <div className="flex flex-col items-center gap-2" data-testid={`countdown-${label.toLowerCase()}`}>
      <div className="relative w-[60px] h-[76px] sm:w-[80px] sm:h-[100px] md:w-[90px] md:h-[110px]" style={{ perspective: "400px" }}>
        <div className="absolute inset-0 rounded-lg overflow-hidden shadow-lg shadow-black/50">
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-[#1a1a1a] to-[#141414] border-b border-black/80 overflow-hidden rounded-t-lg">
            <span className="absolute bottom-0 left-0 right-0 text-center text-[28px] sm:text-[38px] md:text-[44px] font-bold text-[#FF5A09] leading-none translate-y-1/2" style={{ fontFamily: "'Courier New', monospace" }}>
              {currentValue}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-b from-[#111] to-[#0d0d0d] overflow-hidden rounded-b-lg">
            <span className="absolute top-0 left-0 right-0 text-center text-[28px] sm:text-[38px] md:text-[44px] font-bold text-[#FF5A09] leading-none -translate-y-1/2" style={{ fontFamily: "'Courier New', monospace" }}>
              {currentValue}
            </span>
          </div>
          <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-black/60 z-10" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[6px] h-[10px] bg-black/80 rounded-r-sm z-10" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[6px] h-[10px] bg-black/80 rounded-l-sm z-10" />
        </div>

        {flipping && (
          <>
            <div
              className="absolute top-0 left-0 right-0 h-1/2 rounded-t-lg overflow-hidden z-20"
              style={{
                animation: "flipTop 0.3s ease-in forwards",
                transformOrigin: "bottom",
                backfaceVisibility: "hidden",
              }}
            >
              <div className="w-full h-full bg-gradient-to-b from-[#1a1a1a] to-[#141414] relative">
                <span className="absolute bottom-0 left-0 right-0 text-center text-[28px] sm:text-[38px] md:text-[44px] font-bold text-[#FF5A09] leading-none translate-y-1/2" style={{ fontFamily: "'Courier New', monospace" }}>
                  {previousValue}
                </span>
              </div>
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 h-1/2 rounded-b-lg overflow-hidden z-20"
              style={{
                animation: "flipBottom 0.3s 0.15s ease-out forwards",
                transformOrigin: "top",
                backfaceVisibility: "hidden",
                transform: "rotateX(90deg)",
              }}
            >
              <div className="w-full h-full bg-gradient-to-b from-[#111] to-[#0d0d0d] relative">
                <span className="absolute top-0 left-0 right-0 text-center text-[28px] sm:text-[38px] md:text-[44px] font-bold text-[#FF5A09] leading-none -translate-y-1/2" style={{ fontFamily: "'Courier New', monospace" }}>
                  {value}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
      <span className="text-[10px] sm:text-xs uppercase tracking-[3px] text-white/50 font-medium">{label}</span>
    </div>
  );
}

interface FlipCountdownProps {
  targetDate: Date;
  title?: string;
}

export default function FlipCountdown({ targetDate, title }: FlipCountdownProps) {
  const calcTimeLeft = useCallback(() => {
    const now = new Date().getTime();
    const target = targetDate.getTime();
    const diff = Math.max(0, target - now);

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState(calcTimeLeft);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calcTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [calcTimeLeft]);

  const pad = (n: number) => n.toString().padStart(2, "0");

  const isExpired = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  return (
    <div className="flex flex-col items-center gap-6" data-testid="countdown-timer">
      {title && (
        <p className="text-white/50 text-xs sm:text-sm uppercase tracking-[4px] sm:tracking-[6px] text-center">{title}</p>
      )}
      {isExpired ? (
        <p className="text-[#FF5A09] text-lg sm:text-2xl uppercase tracking-[6px] font-bold">Voting Closed</p>
      ) : (
        <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
          <FlipCard value={pad(timeLeft.days)} label="Days" />
          <span className="text-[#FF5A09] text-2xl sm:text-3xl font-bold mt-[-20px]">:</span>
          <FlipCard value={pad(timeLeft.hours)} label="Hours" />
          <span className="text-[#FF5A09] text-2xl sm:text-3xl font-bold mt-[-20px]">:</span>
          <FlipCard value={pad(timeLeft.minutes)} label="Minutes" />
          <span className="text-[#FF5A09] text-2xl sm:text-3xl font-bold mt-[-20px]">:</span>
          <FlipCard value={pad(timeLeft.seconds)} label="Seconds" />
        </div>
      )}

      <style>{`
        @keyframes flipTop {
          0% { transform: rotateX(0deg); }
          100% { transform: rotateX(-90deg); }
        }
        @keyframes flipBottom {
          0% { transform: rotateX(90deg); }
          100% { transform: rotateX(0deg); }
        }
      `}</style>
    </div>
  );
}
