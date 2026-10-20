interface VotePointsBreakdownProps {
  freeVotes: number;
  paidVotes: number;
  freeVoteMultiplier: number;
  className?: string;
}

/** Shows how votes become tournament points: each free vote is worth the multiplier, each paid vote is 1 point. */
export function VotePointsBreakdown({ freeVotes, paidVotes, freeVoteMultiplier, className = "" }: VotePointsBreakdownProps) {
  const freePoints = freeVotes * freeVoteMultiplier;
  const paidPoints = paidVotes;
  const totalPoints = freePoints + paidPoints;
  const totalVotes = freeVotes + paidVotes;
  const freeShare = totalPoints > 0 ? (freePoints / totalPoints) * 100 : 0;

  return (
    <div className={className} data-testid="vote-points-breakdown">
      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">How points are counted</p>
      <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs tabular-nums">
        <dt className="flex items-center gap-1.5 text-white/60"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Free votes</dt>
        <dd className="text-right text-white/50">{freeVotes.toLocaleString()} × {freeVoteMultiplier}</dd>
        <dd className="text-right font-medium text-white">{freePoints.toLocaleString()} pts</dd>
        <dt className="flex items-center gap-1.5 text-white/60"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Paid votes</dt>
        <dd className="text-right text-white/50">{paidVotes.toLocaleString()} × 1</dd>
        <dd className="text-right font-medium text-white">{paidPoints.toLocaleString()} pts</dd>
        <dt className="border-t border-white/10 pt-1 text-white/80">Total</dt>
        <dd className="border-t border-white/10 pt-1 text-right text-white/50">{totalVotes.toLocaleString()} votes</dd>
        <dd className="border-t border-white/10 pt-1 text-right font-bold text-orange-400">{totalPoints.toLocaleString()} pts</dd>
      </dl>
      {totalPoints > 0 && (
        <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden flex" role="img" aria-label={`${Math.round(freeShare)}% of points from free votes`}>
          <div className="bg-blue-400 h-full" style={{ width: `${freeShare}%` }} />
          <div className="bg-orange-400 h-full" style={{ width: `${100 - freeShare}%` }} />
        </div>
      )}
    </div>
  );
}
