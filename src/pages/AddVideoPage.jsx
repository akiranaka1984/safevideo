import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createVideo } from '../services/videoService';

const AddVideoPage = () => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    try {
      const newVideo = await createVideo({
        title,
        url,
        description
      });
      
      navigate(`/videos/${newVideo._id}`);
    } catch (err) {
      setError(err.message || '動画の登録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div>
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            新規動画登録
          </h2>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 rounded-md p-3 text-sm">
          {error}
        </div>
      )}
      
      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              動画タイトル
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="タイトルを入力してください"
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700">
              動画URL
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="https://video.example.com/video-id"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">FC2、YouTube、Vimeoなどの動画URLを入力してください</p>
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              補足説明
            </label>
            <div className="mt-1">
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border border-gray-300 rounded-md"
                placeholder="動画に関する補足説明を入力してください"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">出演者・撮出者・作品について、補足事項がある場合にご記入ください。入力内容は、審査の際に参照します。</p>
          </div>
          
          <div className="flex justify-end space-x-3 pt-5">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-500 border border-transparent rounded-md shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '登録中...' : '登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddVideoPage;