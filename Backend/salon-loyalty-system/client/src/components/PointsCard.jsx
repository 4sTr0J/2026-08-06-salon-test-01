import { TrendingUp } from 'lucide-react';
import { getMoneyValue } from '../utils/currency';

const PointsCard = ({ points, lifetimePoints }) => (
  <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl shadow-slate-900/10">
    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-white/10 blur-3xl rounded-full"></div>

    <div className="relative z-10">
      <h2 className="text-slate-300 font-medium tracking-wide text-sm uppercase">Available Balance</h2>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-6xl font-bold tracking-tight">{points}</span>
        <span className="text-slate-300 font-medium">Pts</span>
      </div>
      <p className="mt-2 text-slate-400 text-sm flex items-center gap-1">
        <TrendingUp className="w-4 h-4" />
        Equivalent to LKR {getMoneyValue(points)} value
      </p>
    </div>

    <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center relative z-10">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wider">Lifetime Earned</p>
        <p className="font-semibold">{lifetimePoints} Pts</p>
      </div>
    </div>
  </div>
);

export default PointsCard;
