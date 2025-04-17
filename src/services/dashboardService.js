import api from './api';

/**
 * ダッシュボードの統計情報を取得する
 * @returns {Promise<Object>} 統計情報
 */
export const getDashboardStats = async () => {
  try {
    const response = await api.get('/dashboard/stats');
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * ダッシュボードの最近のアクティビティを取得する
 * @param {number} limit 取得する件数
 * @returns {Promise<Array>} 最近のアクティビティの配列
 */
export const getRecentActivity = async (limit = 10) => {
  try {
    const response = await api.get(`/dashboard/activity?limit=${limit}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * ダッシュボードの統計グラフデータを取得する
 * @param {string} type グラフの種類（monthly, weekly, daily）
 * @returns {Promise<Object>} グラフデータ
 */
export const getDashboardChartData = async (type = 'monthly') => {
  try {
    const response = await api.get(`/dashboard/chart?type=${type}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};