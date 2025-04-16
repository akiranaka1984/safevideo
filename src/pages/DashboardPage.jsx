import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Video, Plus } from 'lucide-react';
import { getVideos } from '../services/videoService';

const DashboardPage = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const data = await getVideos();
        setVideos(data);
      } catch (err) {
        setError('動画の取得に失敗しました');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">動画一覧</h1>
        <Link
          to="/videos/add"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <Plus className="mr-2" size={16} />
          新規動画登録
        </Link>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 rounded-md p-3 text-sm">
          {error}
        </div>
      )}
      
      <div className="bg-white shadow overflow-hidden rounded-lg">
        <ul className="divide-y divide-gray-200">
          {videos.map(video => (
            <li key={video._id} className="px-6 py-4 hover:bg-gray-50">
              <Link to={`/videos/${video._id}`} className="block">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="p-1 bg-gray-100 rounded-md">
                        <Video size={20} className="text-gray-500" />
                      </div>
                    </div>
                    <div>
                      <div className="text-md font-medium text-gray-900">{video.title}</div>
                      <div className="flex items-center mt-1">
                        <span className="text-xs text-gray-500">ID: #{video._id}</span>
                        <span className="mx-2 text-gray-300">|</span>
                        <span className="text-xs text-gray-500 flex items-center">
                          <User size={12} className="mr-1" />
                          {video.performerCount || 0} 名
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className="text-xs text-blue-600 hover:text-blue-800">
                      詳細を見る →
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
          
          {videos.length === 0 && (
            <li className="px-6 py-12 text-center text-gray-500">
              <div className="flex flex-col items-center">
                <Video size={32} className="text-gray-300 mb-3" />
                <p>登録された動画がありません</p>
                <Link
                  to="/videos/add"
                  className="mt-3 inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-green-500 hover:bg-green-600"
                >
                  <Plus size={14} className="mr-1" />
                  動画を登録する
                </Link>
              </div>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default DashboardPage;