import axios from 'axios';

const API_URL = 'http://localhost:5001/api/loyalty';

export const fetchAccount = (customerId) => axios.get(`${API_URL}/account/${customerId}`);
export const fetchRewards = () => axios.get(`${API_URL}/rewards`);
export const redeemReward = (customerId, rewardId) => axios.post(`${API_URL}/redeem`, { customerId, rewardId });
export const useVoucher = (voucherCode) => axios.post(`${API_URL}/use-voucher`, { voucherCode });
export const earnPoints = (customerId, points) => axios.post(`${API_URL}/earn`, { customerId, points });
