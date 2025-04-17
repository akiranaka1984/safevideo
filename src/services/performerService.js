import api from './api';

// 出演者一覧の取得
export const getPerformers = async () => {
  try {
    // APIが実装されていない場合はモックデータを返す
    // const response = await api.get('/performers');
    // return response.data;
    
    // モックデータ
    return [
      {
        id: 1,
        lastName: '山田',
        firstName: '太郎',
        lastNameRoman: 'Yamada',
        firstNameRoman: 'Taro',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 2,
        lastName: '佐藤',
        firstName: '花子',
        lastNameRoman: 'Sato',
        firstNameRoman: 'Hanako',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 3,
        lastName: '鈴木',
        firstName: '一郎',
        lastNameRoman: 'Suzuki',
        firstNameRoman: 'Ichiro',
        createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  } catch (error) {
    console.error('出演者一覧取得エラー:', error);
    throw error;
  }
};

// 出演者詳細の取得
export const getPerformerById = async (id) => {
  try {
    // APIが実装されていない場合はモックデータを返す
    // const response = await api.get(`/performers/${id}`);
    // return response.data;
    
    // モックデータ
    const performers = await getPerformers();
    const performer = performers.find(p => p.id === parseInt(id));
    
    if (!performer) {
      throw new Error('出演者が見つかりません');
    }
    
    return performer;
  } catch (error) {
    console.error('出演者詳細取得エラー:', error);
    throw error;
  }
};

// 新規出演者の登録
export const createPerformer = async (performerData) => {
  try {
    // 実際のAPI通信はコメントアウト
    // const formData = new FormData();
    
    // // 基本情報をFormDataに追加
    // formData.append('lastName', performerData.lastName);
    // formData.append('firstName', performerData.firstName);
    // formData.append('lastNameRoman', performerData.lastNameRoman);
    // formData.append('firstNameRoman', performerData.firstNameRoman);
    
    // // ファイルをFormDataに追加
    // if (performerData.agreementFile) {
    //   formData.append('agreementFile', performerData.agreementFile);
    // }
    // if (performerData.idFront) {
    //   formData.append('idFront', performerData.idFront);
    // }
    // if (performerData.idBack) {
    //   formData.append('idBack', performerData.idBack);
    // }
    // if (performerData.selfie) {
    //   formData.append('selfie', performerData.selfie);
    // }
    // if (performerData.selfieWithId) {
    //   formData.append('selfieWithId', performerData.selfieWithId);
    // }
    
    // const response = await api.post('/performers', formData, {
    //   headers: {
    //     'Content-Type': 'multipart/form-data'
    //   }
    // });
    
    // return response.data;
    
    // モックデータ (フロントエンド開発用)
    console.log('登録されたデータ:', performerData);
    
    // 新しい出演者オブジェクトを返す
    return {
      id: 4, // 新しいID
      lastName: performerData.lastName,
      firstName: performerData.firstName,
      lastNameRoman: performerData.lastNameRoman,
      firstNameRoman: performerData.firstNameRoman,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: {
        agreementFile: performerData.agreementFile ? {
          verified: false,
          name: performerData.agreementFile.name
        } : null,
        idFront: performerData.idFront ? {
          verified: false,
          name: performerData.idFront.name
        } : null,
        idBack: performerData.idBack ? {
          verified: false,
          name: performerData.idBack.name
        } : null,
        selfie: performerData.selfie ? {
          verified: false,
          name: performerData.selfie.name
        } : null,
        selfieWithId: performerData.selfieWithId ? {
          verified: false,
          name: performerData.selfieWithId.name
        } : null
      }
    };
  } catch (error) {
    console.error('出演者登録エラー:', error);
    throw error;
  }
};

// 出演者の書類を取得
export const getPerformerDocuments = async (performerId) => {
  try {
    // APIが実装されていない場合はモックデータを返す
    // const response = await api.get(`/performers/${performerId}/documents`);
    // return response.data;
    
    // モックデータ
    return [
      {
        id: 'agreementFile',
        type: 'agreementFile',
        name: '出演同意書',
        originalName: '同意書_山田.pdf',
        mimeType: 'application/pdf',
        verified: true,
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'idFront',
        type: 'idFront',
        name: '身分証明書（表面）',
        originalName: '運転免許証_表.jpg',
        mimeType: 'image/jpeg',
        verified: true,
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'idBack',
        type: 'idBack',
        name: '身分証明書（裏面）',
        originalName: '運転免許証_裏.jpg',
        mimeType: 'image/jpeg',
        verified: false,
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'selfie',
        type: 'selfie',
        name: '本人写真',
        originalName: '本人写真.jpg',
        mimeType: 'image/jpeg',
        verified: true,
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  } catch (error) {
    console.error('書類取得エラー:', error);
    throw error;
  }
};

// 出演者の削除
export const deletePerformer = async (performerId) => {
  try {
    // APIが実装されていない場合はダミー処理
    // const response = await api.delete(`/performers/${performerId}`);
    // return response.data;
    
    // ダミー処理
    console.log(`出演者ID: ${performerId} を削除しました`);
    return { message: '出演者情報が削除されました' };
  } catch (error) {
    console.error('出演者削除エラー:', error);
    throw error;
  }
};

// 書類のダウンロード
export const downloadDocument = async (performerId, documentType) => {
  try {
    // APIが実装されていない場合はダミー処理
    // const response = await api.get(`/performers/${performerId}/documents/${documentType}`, {
    //   responseType: 'blob'
    // });
    // return response.data;
    
    // ダミー処理
    alert(`書類 ${documentType} のダウンロード処理はまだ実装されていません`);
    return new Blob(['ダミーデータ'], { type: 'application/octet-stream' });
  } catch (error) {
    console.error('書類ダウンロードエラー:', error);
    throw error;
  }
};