import { Star } from 'lucide-react';

const getGradient = (tierLevel) =>
  tierLevel === 'GOLD'
    ? 'from-amber-400 to-amber-500'
    : tierLevel === 'VIP'
    ? 'from-purple-500 to-indigo-600'
    : 'from-slate-400 to-slate-500';

const TierProgressCard = ({ tier, nextTier, nextTierReq, pointsToNextTier, progressPercent }) => (
  <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col justify-center">
    <div className="flex items-center gap-3 mb-6">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br ${getGradient(tier)} text-white`}>
        <Star className="w-6 h-6" fill="currentColor" />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-slate-800">{tier} Member</h3>
        <p className="text-slate-500 text-sm">Keep earning to unlock {nextTier} perks!</p>
      </div>
    </div>

    <div className="space-y-3">
      <div className="flex justify-between text-sm font-medium">
        <span className="text-slate-700">
          Progress to {tier === 'VIP' ? 'MAX' : `${nextTier} Member — ${nextTierReq?.toLocaleString() || ''} points`}
        </span>
        {tier !== 'VIP' && <span className="text-slate-500">{pointsToNextTier?.toLocaleString()} pts left</span>}
      </div>
      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${getGradient(tier)}`}
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        ></div>
      </div>
    </div>
  </div>
);

export default TierProgressCard;
