import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-3 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-4 text-sm">
            <Link to="/cancellation" className="text-gray-300 hover:text-white">
              キャンセル規約
            </Link>
            <Link to="/faqs" className="text-gray-300 hover:text-white">
              よくある質問
            </Link>
            <Link to="/contact" className="text-gray-300 hover:text-white">
              お問い合わせ
            </Link>
            <Link to="/terms" className="text-gray-300 hover:text-white">
              利用規約
            </Link>
            <Link to="/privacy" className="text-gray-300 hover:text-white">
              プライバシーポリシー
            </Link>
          </div>
          
          <div className="text-gray-400 text-sm">
            © 2025 SafeVideo.org All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;