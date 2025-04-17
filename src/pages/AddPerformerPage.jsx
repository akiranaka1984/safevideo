import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPerformer } from '../services/performerService';

const AddPerformerPage = () => {
  const navigate = useNavigate();
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    lastNameRoman: '',
    firstNameRoman: '',
    agreementFile: null,
    idFront: null,
    idBack: null,
    selfie: null,
    selfieWithId: null
  });
  
  // 必須フィールドがすべて入力されているか確認
  const isFormValid = () => {
    return (
      formData.lastName &&
      formData.firstName &&
      formData.lastNameRoman &&
      formData.firstNameRoman &&
      formData.agreementFile &&
      formData.idFront &&
      formData.selfie
    );
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleFileChange = (e) => {
    const { name, files } = e.target;
    
    // ファイルのバリデーション
    if (files.length > 0) {
      const file = files[0];
      
      // ファイルサイズチェック (5MB)
      const maxFileSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxFileSize) {
        setError(`${name}：ファイルサイズが大きすぎます（5MB以下にしてください）`);
        return;
      }
      
      // 形式チェック
      const allowedTypes = name === 'agreementFile' 
        ? ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'] 
        : ['image/jpeg', 'image/jpg', 'image/png'];
        
      if (!allowedTypes.includes(file.type)) {
        setError(`${name}：サポートされていないファイル形式です（${name === 'agreementFile' ? 'PDF, ' : ''}JPG, PNGのみ使用可能）`);
        return;
      }
      
      // エラー表示をクリア
      if (error) {
        setError('');
      }
    }
    
    setFormData({
      ...formData,
      [name]: files[0]
    });
    
    console.log(`ファイル「${name}」が選択されました:`, files[0] ? files[0].name : 'なし');
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    try {
      // ファイルが選択されているか確認
      if (!formData.agreementFile || !formData.idFront || !formData.selfie) {
        setError('必須ファイル（許諾書、身分証明書表面、本人写真）がアップロードされていません。');
        setSubmitting(false);
        return;
      }
      
      console.log('出演者情報登録開始:', {
        name: `${formData.lastName} ${formData.firstName}`,
        files: {
          agreementFile: formData.agreementFile?.name,
          idFront: formData.idFront?.name,
          idBack: formData.idBack?.name,
          selfie: formData.selfie?.name,
          selfieWithId: formData.selfieWithId?.name
        }
      });
      
      const newPerformer = await createPerformer(formData);
      console.log('出演者情報登録成功:', newPerformer);
      
      navigate(`/performers/${newPerformer.id}`);
    } catch (err) {
      console.error('出演者情報登録エラー:', err);
      setError(err.message || '出演者情報の登録に失敗しました。サーバー側で問題が発生しています。');
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div>
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            出演者情報登録
          </h2>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 rounded-md p-3 text-sm">
          {error}
        </div>
      )}
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">出演者情報入力</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">必要な情報と書類をアップロードしてください</p>
        </div>
        
        <div className="border-t border-gray-200">
          <form onSubmit={handleSubmit} className="divide-y divide-gray-200">
            {/* 基本情報 */}
            <div className="px-4 py-5 space-y-6 sm:p-6">
              <div className="grid grid-cols-6 gap-6">
                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    姓（漢字）
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    id="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="mt-1 focus:ring-green-500 focus:border-green-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    名（漢字）
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    id="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="mt-1 focus:ring-green-500 focus:border-green-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor="lastNameRoman" className="block text-sm font-medium text-gray-700">
                    姓（ローマ字）
                  </label>
                  <input
                    type="text"
                    name="lastNameRoman"
                    id="lastNameRoman"
                    value={formData.lastNameRoman}
                    onChange={handleChange}
                    className="mt-1 focus:ring-green-500 focus:border-green-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor="firstNameRoman" className="block text-sm font-medium text-gray-700">
                    名（ローマ字）
                  </label>
                  <input
                    type="text"
                    name="firstNameRoman"
                    id="firstNameRoman"
                    value={formData.firstNameRoman}
                    onChange={handleChange}
                    className="mt-1 focus:ring-green-500 focus:border-green-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    required
                  />
                </div>
              </div>
            </div>
            
            {/* 書類アップロード */}
            <div className="px-4 py-5 space-y-6 sm:p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  出演同意書 <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="agreementFile"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500"
                      >
                        <span>ファイルを選択</span>
                        <input
                          id="agreementFile"
                          name="agreementFile"
                          type="file"
                          className="sr-only"
                          onChange={handleFileChange}
                          accept=".pdf,.jpg,.jpeg,.png"
                          required
                        />
                      </label>
                      <p className="pl-1">またはドラッグ＆ドロップ</p>
                    </div>
                    <p className="text-xs text-gray-500">PDF, PNG, JPG (最大5MB)</p>
                    {formData.agreementFile && (
                      <p className="text-xs text-green-500">
                        {formData.agreementFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    身分証明書（表面） <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="idFront"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500"
                        >
                          <span>ファイルを選択</span>
                          <input
                            id="idFront"
                            name="idFront"
                            type="file"
                            className="sr-only"
                            onChange={handleFileChange}
                            accept=".jpg,.jpeg,.png"
                            required
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG (最大5MB)</p>
                      {formData.idFront && (
                        <p className="text-xs text-green-500">
                          {formData.idFront.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    身分証明書（裏面）
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="idBack"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500"
                        >
                          <span>ファイルを選択</span>
                          <input
                            id="idBack"
                            name="idBack"
                            type="file"
                            className="sr-only"
                            onChange={handleFileChange}
                            accept=".jpg,.jpeg,.png"
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG (最大5MB)</p>
                      {formData.idBack && (
                        <p className="text-xs text-green-500">
                          {formData.idBack.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    本人写真 <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="selfie"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500"
                        >
                          <span>ファイルを選択</span>
                          <input
                            id="selfie"
                            name="selfie"
                            type="file"
                            className="sr-only"
                            onChange={handleFileChange}
                            accept=".jpg,.jpeg,.png"
                            required
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG (最大5MB)</p>
                      {formData.selfie && (
                        <p className="text-xs text-green-500">
                          {formData.selfie.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    本人と身分証明書の写真
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="selfieWithId"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500"
                        >
                          <span>ファイルを選択</span>
                          <input
                            id="selfieWithId"
                            name="selfieWithId"
                            type="file"
                            className="sr-only"
                            onChange={handleFileChange}
                            accept=".jpg,.jpeg,.png"
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG (最大5MB)</p>
                      {formData.selfieWithId && (
                        <p className="text-xs text-green-500">
                          {formData.selfieWithId.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 送信ボタン */}
            <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
              <button
                type="button"
                onClick={() => navigate('/performers')}
                className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mr-3"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={submitting || !isFormValid()}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300 disabled:cursor-not-allowed"
              >
                {submitting ? '登録中...' : '登録'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddPerformerPage;