import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <Link to="/" className="flex items-center">
              <div className="mr-2 bg-white rounded-md p-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-900">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <span className="font-semibold text-white">SafeVideo<span className="text-xs text-gray-400">.org</span></span>
            </Link>
          </div>
          
          <div className="flex space-x-6">
            <Link to="/cancellation" className="text-sm text-gray-300 hover:text-white">
              Cancellation
            </Link>
            <Link to="/faqs" className="text-sm text-gray-300 hover:text-white">
              FAQs
            </Link>
            <Link to="/contact" className="text-sm text-gray-300 hover:text-white">
              Contact
            </Link>
            <Link to="/terms" className="text-sm text-gray-300 hover:text-white">
              Terms of Use
            </Link>
            <Link to="/privacy" className="text-sm text-gray-300 hover:text-white">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;