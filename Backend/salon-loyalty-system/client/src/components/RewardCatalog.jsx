import { getMoneyValue } from '../utils/currency';

const getIcon = (type) =>
  type === 'FIXED_DISCOUNT' ? '💰' : type === 'FREE_SERVICE' ? '💆‍♀️' : '🎨';

const RewardCatalog = ({ rewards, points, onRedeem }) => (
  <section>
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-bold text-slate-800">Available Rewards</h2>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {rewards.map((reward) => {
        const canAfford = points >= reward.points_cost;
        
        let displayTitle = reward.title;
        let displayDesc = reward.description;
        
        if (reward.reward_type === 'FIXED_DISCOUNT') {
          const moneyValue = getMoneyValue(reward.points_cost);
          // If the title ends with ' OFF' or starts with 'LKR ', we can safely replace it dynamically.
          // Since we know the schema, we can enforce a dynamic format.
          displayTitle = `LKR ${moneyValue} OFF`;
          displayDesc = `Get LKR ${moneyValue} off your next appointment`;
        }

        return (
          <div
            key={reward.id}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full"
          >
            <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center text-white shadow-sm bg-gradient-to-br from-amber-400 to-amber-500">
              <span className="text-2xl">{getIcon(reward.reward_type)}</span>
            </div>
            <h3 className="font-bold text-lg text-slate-800 leading-tight">{displayTitle}</h3>
            <p className="text-slate-500 text-sm mt-1 mb-6 flex-grow">{displayDesc}</p>

            <div className="mt-auto flex items-center justify-between">
              <span className={`font-bold ${canAfford ? 'text-rose-500' : 'text-slate-400'}`}>
                {reward.points_cost} pts
              </span>
              <button
                onClick={() => onRedeem(reward.id, reward.points_cost)}
                disabled={!canAfford}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  canAfford
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 group-hover:scale-105'
                    : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                }`}
              >
                Redeem
              </button>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

export default RewardCatalog;
