import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPerformer } from '../services/performerService';
import { trackEvent, trackPerformerRegistration, trackDocumentUpload, trackError, trackPageView, ANALYTICS_EVENTS } from '../services/firebaseAnalytics';

const AddPerformerPage = () => {
  const navigate = useNavigate();
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState({});
  const [registrationStartTime, setRegistrationStartTime] = useState(null);
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
  
  // Track page view and registration start
  useEffect(() => {
    trackPageView('Add Performer Page');
    trackEvent(ANALYTICS_EVENTS.PERFORMER_REGISTRATION_START, {
      timestamp: new Date().toISOString()
    });
    setRegistrationStartTime(Date.now());
  }, []);
  
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
    
    // Track step completion for name fields
    if (value && (name === 'lastName' || name === 'firstName' || name === 'lastNameRoman' || name === 'firstNameRoman')) {
      trackPerformerRegistration('name_input', {
        field: name,
        stepNumber: 1
      });
    }
  };
  
  const handleFileChange = (e) => {
    const { name, files } = e.target;
    
    // ファイルのバリデーション
    if (files.length > 0) {
      const file = files[0];
      
      // ファイルサイズチェック (5MB)
      const maxFileSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxFileSize) {
        const errorMsg = `${name}：ファイルサイズが大きすぎます（5MB以下にしてください）`;
        setError(errorMsg);
        trackDocumentUpload(name, file.size, false, { message: 'File too large', code: 'SIZE_LIMIT_EXCEEDED' });
        trackError('validation_error', errorMsg, null, { documentType: name, fileSize: file.size });
        return;
      }
      
      // 形式チェック
      const allowedTypes = name === 'agreementFile' 
        ? ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'] 
        : ['image/jpeg', 'image/jpg', 'image/png'];
        
      if (!allowedTypes.includes(file.type)) {
        const errorMsg = `${name}：サポートされていないファイル形式です（${name === 'agreementFile' ? 'PDF, ' : ''}JPG, PNGのみ使用可能）`;
        setError(errorMsg);
        trackDocumentUpload(name, file.size, false, { message: 'Invalid file type', code: 'INVALID_TYPE' });
        trackError('validation_error', errorMsg, null, { documentType: name, fileType: file.type });
        return;
      }
      
      // エラー表示をクリア
      if (error) {
        setError('');
      }
      
      // Track successful document upload
      trackDocumentUpload(name, file.size, true);
      trackPerformerRegistration('document_upload', {
        documentType: name,
        fileSize: file.size,
        stepNumber: 2
      });
    }
    
    setFormData({
      ...formData,
      [name]: files[0]
    });
    
    console.log(`ファイル「${name}」が選択されました:`, files[0] ? files[0].name : 'なし');
  };

  // ドラッグ関連のハンドラー
  const handleDrag = (e, fieldName) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive({ ...dragActive, [fieldName]: true });
    } else if (e.type === "dragleave") {
      setDragActive({ ...dragActive, [fieldName]: false });
    }
  };

  const handleDrop = (e, fieldName) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive({ ...dragActive, [fieldName]: false });
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      
      // ファイルサイズチェック (5MB)
      const maxFileSize = 5 * 1024 * 1024;
      if (file.size > maxFileSize) {
        const errorMsg = `${fieldName}：ファイルサイズが大きすぎます（5MB以下にしてください）`;
        setError(errorMsg);
        trackDocumentUpload(fieldName, file.size, false, { message: 'File too large', code: 'SIZE_LIMIT_EXCEEDED' });
        trackError('validation_error', errorMsg, null, { documentType: fieldName, fileSize: file.size });
        return;
      }
      
      // 形式チェック
      const allowedTypes = fieldName === 'agreementFile' 
        ? ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'] 
        : ['image/jpeg', 'image/jpg', 'image/png'];
        
      if (!allowedTypes.includes(file.type)) {
        const errorMsg = `${fieldName}：サポートされていないファイル形式です（${fieldName === 'agreementFile' ? 'PDF, ' : ''}JPG, PNGのみ使用可能）`;
        setError(errorMsg);
        trackDocumentUpload(fieldName, file.size, false, { message: 'Invalid file type', code: 'INVALID_TYPE' });
        trackError('validation_error', errorMsg, null, { documentType: fieldName, fileType: file.type });
        return;
      }
      
      // エラー表示をクリア
      if (error) {
        setError('');
      }
      
      // Track successful document upload via drag and drop
      trackDocumentUpload(fieldName, file.size, true);
      trackPerformerRegistration('document_upload', {
        documentType: fieldName,
        fileSize: file.size,
        uploadMethod: 'drag_drop',
        stepNumber: 2
      });
      
      setFormData({
        ...formData,
        [fieldName]: file
      });
      
      console.log(`ファイル「${fieldName}」がドロップされました:`, file.name);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    // テキストフィールドのバリデーション
    if (!formData.lastName || !formData.firstName || !formData.lastNameRoman || !formData.firstNameRoman) {
      const errorMsg = 'すべての名前フィールドを入力してください。';
      setError(errorMsg);
      setSubmitting(false);
      trackError('validation_error', errorMsg, null, { step: 'name_validation' });
      return;
    }
    
    try {
      // ファイルが選択されているか確認
      if (!formData.agreementFile || !formData.idFront || !formData.selfie) {
        const errorMsg = '必須ファイル（出演同意書、身分証明書表面、本人写真）がアップロードされていません。';
        setError(errorMsg);
        setSubmitting(false);
        trackError('validation_error', errorMsg, null, { step: 'file_validation' });
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
      
      // Track successful registration completion
      const registrationDuration = Date.now() - registrationStartTime;
      trackEvent(ANALYTICS_EVENTS.PERFORMER_REGISTRATION_COMPLETE, {
        performerId: newPerformer.id,
        duration: registrationDuration,
        hasAllDocuments: !!(formData.agreementFile && formData.idFront && formData.idBack && formData.selfie && formData.selfieWithId)
      });
      trackPerformerRegistration('registration_complete', {
        performerId: newPerformer.id,
        duration: registrationDuration,
        stepNumber: 3
      });
      
      navigate(`/performers/${newPerformer.id}`);
    } catch (err) {
      console.error('出演者情報登録エラー:', err);
      const errorMsg = err.message || '出演者情報の登録に失敗しました。サーバー側で問題が発生しています。';
      setError(errorMsg);
      
      // Track registration error
      trackError('api_error', errorMsg, err.stack, {
        endpoint: 'createPerformer',
        registrationDuration: Date.now() - registrationStartTime
      });
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
                    姓（漢字）<span className="text-red-500 ml-1">*必須</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    id="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="mt-1 focus:ring-green-500 focus:border-green-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                </div>

                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    名（漢字）<span className="text-red-500 ml-1">*必須</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    id="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="mt-1 focus:ring-green-500 focus:border-green-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                </div>

                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor="lastNameRoman" className="block text-sm font-medium text-gray-700">
                    姓（ローマ字）<span className="text-red-500 ml-1">*必須</span>
                  </label>
                  <input
                    type="text"
                    name="lastNameRoman"
                    id="lastNameRoman"
                    value={formData.lastNameRoman}
                    onChange={handleChange}
                    className="mt-1 focus:ring-green-500 focus:border-green-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                </div>

                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor="firstNameRoman" className="block text-sm font-medium text-gray-700">
                    名（ローマ字）<span className="text-red-500 ml-1">*必須</span>
                  </label>
                  <input
                    type="text"
                    name="firstNameRoman"
                    id="firstNameRoman"
                    value={formData.firstNameRoman}
                    onChange={handleChange}
                    className="mt-1 focus:ring-green-500 focus:border-green-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
            
            {/* 書類アップロード */}
            <div className="px-4 py-5 space-y-6 sm:p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  出演同意書 <span className="text-red-500">*必須</span>
                </label>
                <div 
                  className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${dragActive.agreementFile ? 'border-green-500 bg-green-50' : 'border-gray-300'} border-dashed rounded-md transition-colors`}
                  onDragEnter={(e) => handleDrag(e, "agreementFile")}
                  onDragLeave={(e) => handleDrag(e, "agreementFile")}
                  onDragOver={(e) => handleDrag(e, "agreementFile")}
                  onDrop={(e) => handleDrop(e, "agreementFile")}
                >
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
                        />
                      </label>
                      <p className="pl-1">またはドラッグ&ドロップ</p>
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
                    身分証明書（表面） <span className="text-red-500">*必須</span>
                  </label>
                  <div 
                    className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${dragActive.idFront ? 'border-green-500 bg-green-50' : 'border-gray-300'} border-dashed rounded-md transition-colors`}
                    onDragEnter={(e) => handleDrag(e, "idFront")}
                    onDragLeave={(e) => handleDrag(e, "idFront")}
                    onDragOver={(e) => handleDrag(e, "idFront")}
                    onDrop={(e) => handleDrop(e, "idFront")}
                  >
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
                          <p className="pl-1">またはドラッグ&ドロップ</p>
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
                    身分証明書（裏面）<span className="text-red-500 ml-1"></span>
                  </label>
                  <div 
                    className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${dragActive.idBack ? 'border-green-500 bg-green-50' : 'border-gray-300'} border-dashed rounded-md transition-colors`}
                    onDragEnter={(e) => handleDrag(e, "idBack")}
                    onDragLeave={(e) => handleDrag(e, "idBack")}
                    onDragOver={(e) => handleDrag(e, "idBack")}
                    onDrop={(e) => handleDrop(e, "idBack")}
                  >
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
                          <p className="pl-1">またはドラッグ&ドロップ</p>
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
                    本人写真 <span className="text-red-500">*必須</span>
                  </label>
                  <div 
                    className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${dragActive.selfie ? 'border-green-500 bg-green-50' : 'border-gray-300'} border-dashed rounded-md transition-colors`}
                    onDragEnter={(e) => handleDrag(e, "selfie")}
                    onDragLeave={(e) => handleDrag(e, "selfie")}
                    onDragOver={(e) => handleDrag(e, "selfie")}
                    onDrop={(e) => handleDrop(e, "selfie")}
                  >
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
                          <p className="pl-1">またはドラッグ&ドロップ</p>
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
                    本人と身分証明書の写真<span className="text-red-500 ml-1">*必須</span>
                  </label>
                  <div 
                    className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${dragActive.selfieWithId ? 'border-green-500 bg-green-50' : 'border-gray-300'} border-dashed rounded-md transition-colors`}
                    onDragEnter={(e) => handleDrag(e, "selfieWithId")}
                    onDragLeave={(e) => handleDrag(e, "selfieWithId")}
                    onDragOver={(e) => handleDrag(e, "selfieWithId")}
                    onDrop={(e) => handleDrop(e, "selfieWithId")}
                  >
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
                          <p className="pl-1">またはドラッグ&ドロップ</p>
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
                onClick={() => {
                  // Track registration abandonment
                  const registrationDuration = Date.now() - registrationStartTime;
                  trackEvent(ANALYTICS_EVENTS.PERFORMER_REGISTRATION_ABANDONED, {
                    duration: registrationDuration,
                    completedFields: {
                      hasName: !!(formData.lastName && formData.firstName),
                      hasRomanName: !!(formData.lastNameRoman && formData.firstNameRoman),
                      hasAgreement: !!formData.agreementFile,
                      hasIdFront: !!formData.idFront,
                      hasIdBack: !!formData.idBack,
                      hasSelfie: !!formData.selfie,
                      hasSelfieWithId: !!formData.selfieWithId
                    }
                  });
                  navigate('/performers');
                }}
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