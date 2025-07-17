import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, Download, Trash, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { getPerformerById, getPerformerDocuments, downloadDocument, deletePerformer, verifyDocument } from '../services/performerService';
import { getUserRole } from '../services/auth';

const PerformerDetailPage = () => {
 const { id } = useParams();
 const navigate = useNavigate();
 const [performer, setPerformer] = useState(null);
 const [documents, setDocuments] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [deleteModalOpen, setDeleteModalOpen] = useState(false);
 const [userRole, setUserRole] = useState('user');
 const [verifyingDoc, setVerifyingDoc] = useState(null);
 // 追加: ポップアップ表示のための状態
 const [previewDoc, setPreviewDoc] = useState(null);
 const [imageUrl, setImageUrl] = useState(null);

 // 画像をBlobとして取得してURLを作成
 const fetchImageAsBlob = async (documentType) => {
   try {
     const token = localStorage.getItem('token');
     const response = await fetch(
       `${process.env.REACT_APP_API_URL || 'http://167.172.92.88:5000'}/api/performers/${id}/documents/${documentType}`,
       {
         headers: {
           'Authorization': `Bearer ${token}`
         }
       }
     );
     
     if (response.ok) {
       const blob = await response.blob();
       const url = URL.createObjectURL(blob);
       setImageUrl(url);
     }
   } catch (error) {
     console.error('画像の取得に失敗しました:', error);
   }
 };

 useEffect(() => {
   // ユーザーロールを取得
   const role = getUserRole(); // この関数は認証トークンからロールを取得する必要があります
   setUserRole(role);

   const fetchPerformerDetails = async () => {
     try {
       const performerData = await getPerformerById(id);
       setPerformer(performerData);
       
       const documentsData = await getPerformerDocuments(id);
       setDocuments(documentsData);
     } catch (err) {
       setError('出演者情報の取得に失敗しました');
       console.error(err);
     } finally {
       setLoading(false);
     }
   };

   fetchPerformerDetails();
 }, [id]);

 const handleDownload = async (documentType) => {
  try {
    const blob = await downloadDocument(id, documentType);
    const url = window.URL.createObjectURL(blob);
    
    // 該当するドキュメントを探す
    const doc = documents.find(d => d.type === documentType);
    
    // MIMEタイプから適切な拡張子を取得
    let extension = 'pdf'; // デフォルト
    if (doc && doc.mimeType) {
      if (doc.mimeType.includes('png')) extension = 'png';
      else if (doc.mimeType.includes('jpeg') || doc.mimeType.includes('jpg')) extension = 'jpg';
    }
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentType}_${performer.lastName}_${performer.firstName}.${extension}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('ダウンロードに失敗しました', err);
  }
};

 const handleDelete = async () => {
   try {
     await deletePerformer(id);
     navigate('/performers');
   } catch (err) {
     setError('出演者情報の削除に失敗しました');
     console.error(err);
   } finally {
     setDeleteModalOpen(false);
   }
 };

 const handleVerify = async (documentType) => {
   setVerifyingDoc(documentType);
   try {
     await verifyDocument(id, documentType);
     
     // 書類リストを更新
     setDocuments(prevDocs => 
       prevDocs.map(doc => 
         doc.type === documentType ? { ...doc, verified: true } : doc
       )
     );
     
     // 必要に応じて出演者情報を再取得
     const updatedPerformer = await getPerformerById(id);
     setPerformer(updatedPerformer);
   } catch (err) {
     console.error('書類の検証に失敗しました', err);
   } finally {
     setVerifyingDoc(null);
   }
 };

 // 追加: プレビュー表示用の関数
 const handlePreview = async (doc) => {
   setPreviewDoc(doc);
   if (doc.mimeType && doc.mimeType.includes('image')) {
     await fetchImageAsBlob(doc.type);
   }
 };

 // 追加: プレビューを閉じる関数
 const closePreview = () => {
   setPreviewDoc(null);
   if (imageUrl) {
     URL.revokeObjectURL(imageUrl);
     setImageUrl(null);
   }
 };

 if (loading) {
   return (
     <div className="flex justify-center items-center py-12">
       <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
     </div>
   );
 }

 if (error) {
   return (
     <div className="bg-red-50 border border-red-200 text-red-600 rounded-md p-4">
       <p>{error}</p>
       <button 
         onClick={() => navigate('/performers')}
         className="mt-2 text-sm font-medium text-red-600 hover:text-red-800"
       >
         出演者一覧に戻る
       </button>
     </div>
   );
 }

 return (
   <div>
     {performer && (
       <>
         <div className="md:flex md:items-center md:justify-between mb-6">
           <div className="flex-1 min-w-0">
             <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
               {performer.lastName} {performer.firstName}
             </h2>
             <div className="mt-1 flex items-center text-sm text-gray-500">
               <span>{performer.lastNameRoman} {performer.firstNameRoman}</span>
               <span className="mx-2">•</span>
               <span>ID: {performer.id}</span>
               {userRole === 'admin' && (
                 <>
                   <span className="mx-2">•</span>
                   <span>ステータス: {
                     performer.status === 'active' ? '承認済み' :
                     performer.status === 'pending' ? '検証待ち' :
                     performer.status === 'rejected' ? '拒否' : performer.status
                   }</span>
                 </>
               )}
             </div>
           </div>
           <div className="mt-4 flex md:mt-0 md:ml-4">
             {/* 管理者のみ削除ボタンを表示 */}
             {userRole === 'admin' && (
               <button
                 onClick={() => setDeleteModalOpen(true)}
                 className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
               >
                 <Trash className="mr-2 -ml-1 h-5 w-5" />
                 削除
               </button>
             )}
           </div>
         </div>

         <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
           <div className="px-4 py-5 sm:px-6">
             <h3 className="text-lg leading-6 font-medium text-gray-900">出演者情報</h3>
           </div>
           <div className="border-t border-gray-200">
             <dl>
               <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                 <dt className="text-sm font-medium text-gray-500">氏名（漢字）</dt>
                 <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                   {performer.lastName} {performer.firstName}
                 </dd>
               </div>
               <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                 <dt className="text-sm font-medium text-gray-500">氏名（ローマ字）</dt>
                 <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                   {performer.lastNameRoman} {performer.firstNameRoman}
                 </dd>
               </div>
               <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                 <dt className="text-sm font-medium text-gray-500">登録日</dt>
                 <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                   {new Date(performer.createdAt).toLocaleString()}
                 </dd>
               </div>
               <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                 <dt className="text-sm font-medium text-gray-500">最終更新日</dt>
                 <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                   {new Date(performer.updatedAt).toLocaleString()}
                 </dd>
               </div>
             </dl>
           </div>
         </div>

         <div className="bg-white shadow overflow-hidden sm:rounded-lg">
           <div className="px-4 py-5 sm:px-6">
             <h3 className="text-lg leading-6 font-medium text-gray-900">書類一覧</h3>
             <p className="mt-1 max-w-2xl text-sm text-gray-500">提出された書類の確認・ダウンロードができます</p>
           </div>
           <div className="border-t border-gray-200">
             {documents.length === 0 ? (
               <div className="text-center py-12">
                 <FileText className="mx-auto h-12 w-12 text-gray-300" />
                 <h3 className="mt-2 text-sm font-medium text-gray-900">書類なし</h3>
                 <p className="mt-1 text-sm text-gray-500">書類が登録されていません</p>
               </div>
             ) : (
               <ul className="divide-y divide-gray-200">
                 {documents.map((doc) => (
                   <li key={doc.id} className="px-4 py-4">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center">
                         <div className="flex-shrink-0">
                           <FileText className="h-8 w-8 rounded-full bg-gray-100 p-1 text-gray-500" />
                         </div>
                         <div className="ml-4">
                           <div className="text-sm font-medium text-gray-900">
                             {doc.type === 'agreementFile' && '出演同意書'}
                             {doc.type === 'idFront' && '身分証明書（表面）'}
                             {doc.type === 'idBack' && '身分証明書（裏面）'}
                             {doc.type === 'selfie' && '本人写真'}
                             {doc.type === 'selfieWithId' && '本人と身分証明書の写真'}
                           </div>
                           <div className="text-sm text-gray-500">
                             {new Date(doc.updatedAt).toLocaleString()}
                           </div>
                         </div>
                       </div>
                       <div className="flex items-center space-x-2">
                         {/* 検証ステータス表示 */}
                         {doc.verified ? (
                           <div className="flex items-center">
                             <CheckCircle className="h-5 w-5 text-green-500" />
                             <span className="ml-1 text-xs text-green-500">検証済み</span>
                           </div>
                         ) : userRole === 'admin' ? (
                           <div className="flex items-center">
                             <AlertCircle className="h-5 w-5 text-yellow-500" />
                             <span className="ml-1 text-xs text-yellow-500">未検証</span>
                           </div>
                         ) : null}
                         
                         {/* 管理者のみ検証ボタンを表示 */}
                         {userRole === 'admin' && !doc.verified && (
                           <button
                             type="button"
                             onClick={() => handleVerify(doc.type)}
                             disabled={verifyingDoc === doc.type}
                             className={`inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white ${
                               verifyingDoc === doc.type 
                               ? 'bg-gray-400 cursor-not-allowed' 
                               : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                             }`}
                           >
                             {verifyingDoc === doc.type ? '処理中...' : '検証する'}
                           </button>
                         )}
                         
                         {/* ダウンロードボタン */}
                         <button
                           type="button"
                           onClick={() => handleDownload(doc.type)}
                           className="inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                         >
                           <Download className="h-5 w-5" />
                         </button>
                         
                         {/* 表示ボタン - プレビュー機能に変更 */}
                         <button
                           type="button"
                           onClick={() => handlePreview(doc)}
                           className="inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                         >
                           <Eye className="h-5 w-5" />
                         </button>
                       </div>
                     </div>
                   </li>
                 ))}
               </ul>
             )}
           </div>
         </div>

         {/* 削除確認モーダル */}
         {deleteModalOpen && (
           <div className="fixed z-10 inset-0 overflow-y-auto">
             <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
               <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                 <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
               </div>
               <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
               <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                 <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                   <div className="sm:flex sm:items-start">
                     <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                       <Trash className="h-6 w-6 text-red-600" />
                     </div>
                     <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                       <h3 className="text-lg leading-6 font-medium text-gray-900">出演者情報の削除</h3>
                       <div className="mt-2">
                         <p className="text-sm text-gray-500">
                           本当にこの出演者情報を削除しますか？この操作は取り消せません。
                           関連するすべての書類情報も削除されます。
                         </p>
                       </div>
                     </div>
                   </div>
                 </div>
                 <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                   <button
                     type="button"
                     onClick={handleDelete}
                     className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                   >
                     削除する
                   </button>
                   <button
                     type="button"
                     onClick={() => setDeleteModalOpen(false)}
                     className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                   >
                     キャンセル
                   </button>
                 </div>
               </div>
             </div>
           </div>
         )}

        {/* 書類プレビューモーダル */}
{previewDoc && (
  <div className="fixed z-10 inset-0 overflow-y-auto">
    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
      <div className="fixed inset-0 transition-opacity" aria-hidden="true">
        <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={closePreview}></div>
      </div>
      <div className="inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
        <div className="flex justify-between items-center px-4 py-3 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">
            {previewDoc.type === 'agreementFile' && '出演同意書'}
            {previewDoc.type === 'idFront' && '身分証明書（表面）'}
            {previewDoc.type === 'idBack' && '身分証明書（裏面）'}
            {previewDoc.type === 'selfie' && '本人写真'}
            {previewDoc.type === 'selfieWithId' && '本人と身分証明書の写真'}
          </h3>
          <button
            type="button"
            onClick={closePreview}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="bg-white p-6 flex flex-col items-center justify-center text-center">
          {previewDoc.mimeType && previewDoc.mimeType.includes('image') ? (
            <div className="w-full">
              {imageUrl ? (
                <img 
                  src={imageUrl}
                  alt={previewDoc.name}
                  className="max-w-full max-h-[70vh] object-contain mx-auto"
                />
              ) : (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4"></div>
                  <p className="text-gray-600">画像を読み込んでいます...</p>
                </div>
              )}
            </div>
          ) : previewDoc.mimeType === 'application/pdf' ? (
            <div className="w-full">
              <FileText className="h-16 w-16 text-gray-300 mb-4 mx-auto" />
              <p className="mb-4 text-gray-600">
                PDFファイルのプレビューは現在サポートされていません。<br />
                ファイルをダウンロードして確認してください。
              </p>
              <button
                onClick={() => handleDownload(previewDoc.type)}
                className="w-full max-w-md px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                ダウンロード
              </button>
            </div>
          ) : (
            <div>
              <FileText className="h-16 w-16 text-gray-300 mb-4" />
              <p className="mb-4 text-gray-600">
                ファイルをダウンロードして確認してください。
              </p>
              <button
                onClick={() => handleDownload(previewDoc.type)}
                className="w-full max-w-md px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                ダウンロード
              </button>
            </div>
          )}
        </div>
        <div className="bg-gray-50 px-4 py-3 flex justify-end">
          <button
            type="button"
            onClick={closePreview}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  </div>
)}
       </>
     )}
   </div>
 );
};

export default PerformerDetailPage;