import api from './api';

// 出演者一覧の取得（ユーザー権限に基づいてフィルタリング）
export const getPerformers = async (filters = {}) => {
  try {
    // クエリパラメータを構築
    const queryParams = new URLSearchParams();
    
    if (filters.status) {
      queryParams.append('status', filters.status);
    }
    
    if (filters.sort) {
      queryParams.append('sort', filters.sort);
    }
    
    if (filters.expiring) {
      queryParams.append('expiring', filters.expiring);
    }
    
    if (filters.search) {
      queryParams.append('search', filters.search);
    }
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const response = await api.get(`/performers${query}`);
    return response.data;
  } catch (error) {
    console.error('出演者一覧取得エラー:', error);
    throw error;
  }
};

// 全出演者一覧の取得（管理者専用）
export const getAllPerformers = async (filters = {}) => {
  try {
    // クエリパラメータを構築
    const queryParams = new URLSearchParams();
    
    if (filters.status) {
      queryParams.append('status', filters.status);
    }
    
    if (filters.sort) {
      queryParams.append('sort', filters.sort);
    }
    
    if (filters.expiring) {
      queryParams.append('expiring', filters.expiring);
    }
    
    if (filters.search) {
      queryParams.append('search', filters.search);
    }
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const response = await api.get(`/performers/all${query}`);
    return response.data;
  } catch (error) {
    console.error('全出演者一覧取得エラー:', error);
    throw error;
  }
};

// 出演者詳細の取得
export const getPerformerById = async (id) => {
  try {
    const response = await api.get(`/performers/${id}`);
    return response.data;
  } catch (error) {
    console.error('出演者詳細取得エラー:', error);
    throw error;
  }
};

// 新規出演者の登録
export const createPerformer = async (performerData) => {
  try {
    const formData = new FormData();
    
    // 基本情報をFormDataに追加
    formData.append('lastName', performerData.lastName);
    formData.append('firstName', performerData.firstName);
    formData.append('lastNameRoman', performerData.lastNameRoman);
    formData.append('firstNameRoman', performerData.firstNameRoman);
    
    // ファイルをFormDataに追加
    if (performerData.agreementFile) {
      formData.append('agreementFile', performerData.agreementFile);
    }
    if (performerData.idFront) {
      formData.append('idFront', performerData.idFront);
    }
    if (performerData.idBack) {
      formData.append('idBack', performerData.idBack);
    }
    if (performerData.selfie) {
      formData.append('selfie', performerData.selfie);
    }
    if (performerData.selfieWithId) {
      formData.append('selfieWithId', performerData.selfieWithId);
    }
    
    const response = await api.post('/performers', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('出演者登録エラー:', error);
    throw error;
  }
};

// 出演者情報の更新
export const updatePerformer = async (id, performerData) => {
  try {
    const response = await api.put(`/performers/${id}`, performerData);
    return response.data;
  } catch (error) {
    console.error('出演者更新エラー:', error);
    throw error;
  }
};

// 出演者の書類を取得
export const getPerformerDocuments = async (performerId) => {
  try {
    const response = await api.get(`/performers/${performerId}/documents`);
    return response.data;
  } catch (error) {
    console.error('書類取得エラー:', error);
    throw error;
  }
};

// 出演者の削除
export const deletePerformer = async (performerId) => {
  try {
    const response = await api.delete(`/performers/${performerId}`);
    return response.data;
  } catch (error) {
    console.error('出演者削除エラー:', error);
    throw error;
  }
};

// 書類のダウンロード
export const downloadDocument = async (performerId, documentType) => {
  try {
    const response = await api.get(`/performers/${performerId}/documents/${documentType}`, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('書類ダウンロードエラー:', error);
    throw error;
  }
};

// 書類の検証（管理者専用）
export const verifyDocument = async (performerId, documentType) => {
  try {
    const response = await api.put(`/performers/${performerId}/documents/${documentType}/verify`);
    return response.data;
  } catch (error) {
    console.error('書類検証エラー:', error);
    throw error;
  }
};

// ユーザー権限を確認
export const checkUserRole = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data.role;
  } catch (error) {
    console.error('ユーザー権限確認エラー:', error);
    throw error;
  }
};

export default {
  getPerformers,
  getAllPerformers,
  getPerformerById,
  createPerformer,
  updatePerformer,
  getPerformerDocuments,
  deletePerformer,
  downloadDocument,
  verifyDocument,
  checkUserRole
};