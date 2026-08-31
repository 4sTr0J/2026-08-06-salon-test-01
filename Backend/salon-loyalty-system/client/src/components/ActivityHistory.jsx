import { Clock } from 'lucide-react';

const ActivityHistory = ({ history }) => (
  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
      <Clock className="w-5 h-5 text-indigo-500" /> Recent Activity
    </h3>
    {history.length === 0 ? (
      <p className="text-slate-500 text-sm">No activity yet.</p>
    ) : (
      <div className="space-y-3">
        {history.map((h) => (
          <div
            key={h.id}
            className="flex justify-between items-center text-sm py-2 border-b border-slate-50 last:border-0"
          >
            <span className="text-slate-600">{h.description}</span>
            <span className={`font-bold ${h.points > 0 ? 'text-emerald-500' : 'text-slate-700'}`}>
              {h.points > 0 ? '+' : ''}
              {h.points}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ActivityHistory;
