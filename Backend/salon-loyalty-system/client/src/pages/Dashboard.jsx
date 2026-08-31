import { useState, useEffect } from 'react';
import { fetchAccount, fetchRewards, redeemReward, useVoucher } from '../services/api';
import Navbar from '../components/Navbar';
import PointsCard from '../components/PointsCard';
import TierProgressCard from '../components/TierProgressCard';
import RewardCatalog from '../components/RewardCatalog';
import VoucherList from '../components/VoucherList';
import ActivityHistory from '../components/ActivityHistory';

import { useAuth } from '../context/AuthContext';
import { getTierInfo } from '../utils/tier';

const Dashboard = () => {
  const { user } = useAuth();
  const [account, setAccount] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [history, setHistory] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user?.customerId) return;
    try {
      const [accRes, rewRes] = await Promise.all([fetchAccount(user.customerId), fetchRewards()]);
      setAccount(accRes.data.account);
      setHistory(accRes.data.history);
      setVouchers(accRes.data.vouchers);
      setRewards(rewRes.data.rewards);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);



  const handleRedeem = async (rewardId, cost) => {
    if (account.available_points < cost) return;
    try {
      const res = await redeemReward(user.customerId, rewardId);
      if (res.data.success) {
        alert(`Reward Redeemed! Voucher Code: ${res.data.voucherCode}`);
        loadData();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to redeem reward');
    }
  };

  const handleUseVoucher = async (voucherCode) => {
    try {
      const res = await useVoucher(voucherCode);
      if (res.data.success) {
        alert(res.data.message);
        loadData();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to use voucher');
    }
  };

  if (loading && !account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Loading...
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500">
        <p className="text-xl font-bold text-slate-800">Error connecting to Database.</p>
        <p>Please ensure the backend is running.</p>
      </div>
    );
  }

  const points = account.available_points;
  const lifetimePoints = account.lifetime_points;
  const { tier, nextTier, nextTierReq } = getTierInfo(lifetimePoints);

  const pointsToNextTier = tier === 'VIP' ? 0 : nextTierReq - lifetimePoints;
  const progressPercent = tier === 'VIP' ? 100 : (lifetimePoints / nextTierReq) * 100;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-rose-200 pb-16">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        
        {/* Book Appointment Action */}
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <h3 className="font-bold text-rose-800">Book an Appointment</h3>
            <p className="text-sm text-rose-600">Book your next salon appointment and earn loyalty rewards.</p>
          </div>
          <button 
            onClick={() => window.location.href = 'http://localhost:3000/CustomerDashboard/salons.html'}
            className="bg-white border border-rose-200 text-rose-600 hover:bg-rose-100 px-4 py-2 rounded-xl font-bold transition-colors shadow-sm"
          >
            Book New Appointment
          </button>
        </div>

        {/* Points & Tier */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PointsCard points={points} lifetimePoints={lifetimePoints} />
          <TierProgressCard
            tier={tier}
            nextTier={nextTier}
            nextTierReq={nextTierReq}
            pointsToNextTier={pointsToNextTier}
            progressPercent={progressPercent}
          />
        </section>

        {/* Rewards */}
        <RewardCatalog rewards={rewards} points={points} onRedeem={handleRedeem} />

        {/* Vouchers & History */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <VoucherList vouchers={vouchers} onUseVoucher={handleUseVoucher} />
          <ActivityHistory history={history} />
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
