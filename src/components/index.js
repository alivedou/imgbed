"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { signIn, signOut } from "next-auth/react";
import { ToastContainer, toast } from "react-toastify";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import LoginModal from './LoginModal';

// ==========================================
// 1. Footer Component (页脚组件)
// ==========================================
export function Footer() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <footer className="w-full h-full text-center bg-white flex flex-col justify-center items-center py-2">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3">
        <p className="text-[10px] text-zinc-400 font-medium">
          Copyright &copy; 2026 <Link href="https://github.com/alivedou/imgbed" className="text-zinc-600 hover:text-black transition-colors" target="_blank" rel="noopener noreferrer">imgbed</Link> | Powered by adou | Open Source under MIT License
        </p>
        <span className="hidden sm:inline text-zinc-300 text-[10px]">|</span>
        <button 
          onClick={() => setShowDisclaimer(true)}
          className="text-[10px] font-semibold text-zinc-500 hover:text-red-500 hover:underline cursor-pointer transition-colors"
        >
          Disclaimer (免责声明)
        </button>
      </div>

      {showDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden transform transition-all duration-300 scale-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50">
              <h3 className="text-xs font-bold text-zinc-800 tracking-wide flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                SITE DISCLAIMER & TERMS
              </h3>
              <button 
                onClick={() => setShowDisclaimer(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto text-left space-y-4 text-xs leading-relaxed text-zinc-600">
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 text-red-800 font-medium leading-normal mb-2">
                This site is a personal, non-commercial technical experiment providing temporary encrypted file transfer.
              </div>
              
              <div className="space-y-3 font-normal">
                <p className="flex gap-2">
                  <span className="font-bold text-zinc-800 shrink-0">1.</span>
                  <span>Uploading or sharing illegal content, infringing content, pornography, violence, malware, etc. is strictly prohibited. Violations will result in immediate data destruction and cooperation with authorities.</span>
                </p>
                <p className="flex gap-2">
                  <span className="font-bold text-zinc-800 shrink-0">2.</span>
                  <span>This site operates on an auto-deletion model. No guarantees are made regarding data permanence, security, or integrity. Users should back up important data.</span>
                </p>
                <p className="flex gap-2">
                  <span className="font-bold text-zinc-800 shrink-0">3.</span>
                  <span>All content is provided by uploaders and does not represent the views of this site. The site assumes no liability for disputes or losses arising from use.</span>
                </p>
                <p className="flex gap-2">
                  <span className="font-bold text-zinc-800 shrink-0">4.</span>
                  <span>The site may suspend or terminate service at any time due to server conditions without prior notice.</span>
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-100 text-center font-semibold text-zinc-800">
                By using this site, you acknowledge and agree to these terms.
              </div>
            </div>

            {/* Footer button */}
            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex justify-end">
              <button 
                onClick={() => setShowDisclaimer(false)}
                className="px-5 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                I Understand & Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}

// ==========================================
// 2. FullScreenIcon Component (全屏/退出全屏图标组件)
// ==========================================
export function FullScreenIcon(props) {
  const [fullscreen, setFullscreen] = useState(false);

  // 监听全屏 API 状态变化，从而动态调整返回的矢量图标路径
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <svg
      className="PhotoView-Slider__toolbarIcon"
      fill="white"
      width="44"
      height="44"
      viewBox="0 0 768 768"
      {...props}
    >
      <path
        d={
          fullscreen
            ? 'M511.5 256.5h96v63h-159v-159h63v96zM448.5 607.5v-159h159v63h-96v96h-63zM256.5 256.5v-96h63v159h-159v-63h96zM160.5 511.5v-63h159v159h-63v-96h-96z'
            : 'M448.5 160.5h159v159h-63v-96h-96v-63zM544.5 544.5v-96h63v159h-159v-63h96zM160.5 319.5v-159h159v63h-96v96h-63zM223.5 448.5v96h96v63h-159v-159h63z'
        }
      />
    </svg>
  );
}

// ==========================================
// 3. ImageModal Component (图片/视频预览灯箱弹窗组件)
// ==========================================
const imageExtensions = [
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp',
  'svg', 'ico', 'heic', 'heif', 'raw', 'psd', 'ai', 'eps'
];

const videoExtensions = [
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'ogg',
  'ogv', 'm4v', '3gp', '3g2', 'mpg', 'mpeg', 'mxf', 'vob'
];

// 获取文件名后缀的通用逻辑
const getFileExtension = (url) => {
  const parts = url.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

// 重构代理之后的图片物理获取路径
const getImgUrl = (url) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return url.startsWith("/file/") || url.startsWith("/cfile/") || url.startsWith("/rfile/") ? `${origin}/api${url}` : url;
};

export function ImageModal({ selectedImageIndex, setSelectedImageIndex, data }) {
  const [imgSize, setImgSize] = useState(0.8);

  const handleIncreaseSize = () => {
    setImgSize((prevSize) => Math.min(prevSize + 0.1, 2));
  };

  const handleDecreaseSize = () => {
    setImgSize((prevSize) => Math.max(prevSize - 0.1, 0.5));
  };

  const handleCloseImage = useCallback(() => {
    setSelectedImageIndex(null);
  }, [setSelectedImageIndex]);

  const handlePrevImage = useCallback(() => {
    setSelectedImageIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : data.length - 1));
  }, [setSelectedImageIndex, data.length]);

  const handleNextImage = useCallback(() => {
    setSelectedImageIndex((prevIndex) => (prevIndex < data.length - 1 ? prevIndex + 1 : 0));
  }, [setSelectedImageIndex, data.length]);

  if (selectedImageIndex === null) return null;

  const fileUrl = getImgUrl(data[selectedImageIndex].url);
  const fileExtension = getFileExtension(fileUrl);

  const renderFile = () => {
    if (imageExtensions.includes(fileExtension)) {
      return (
        <img
          key={`image-${selectedImageIndex}`}
          src={fileUrl}
          alt={`Uploaded ${selectedImageIndex}`}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />
      );
    } else if (videoExtensions.includes(fileExtension)) {
      return (
        <video
          key={`video-${selectedImageIndex}`}
          src={fileUrl}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-xl"
          controls
          autoPlay
        >
          Your browser does not support the video tag.
        </video>
      );
    } else {
      return (
        <div className="p-12 bg-white flex flex-col items-center gap-4 rounded-xl border border-zinc-200">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-900 uppercase tracking-widest">Unsupported File</p>
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={handleCloseImage}></div>
      
      <div className="relative z-50 flex flex-col items-center gap-6 pointer-events-none">
        <div 
          className="transition-transform duration-200 pointer-events-auto shadow-2xl rounded-xl border border-zinc-200 bg-white p-1"
          style={{ transform: `scale(${imgSize.toFixed(1)})` }}
        >
          {renderFile()}
        </div>

        {/* 悬浮多功能操控栏 */}
        <div className="flex items-center gap-4 p-2 bg-black/50 backdrop-blur-lg rounded-full border border-white/20 pointer-events-auto shadow-xl">
          <button
            className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
            onClick={handlePrevImage}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            className="w-10 h-10 flex items-center justify-center text-white hover:text-red-400 transition-colors"
            onClick={handleCloseImage}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <button
            className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
            onClick={handleNextImage}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="w-px h-6 bg-white/20 mx-1"></div>

          <button
            className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white transition-colors text-lg font-bold"
            onClick={handleIncreaseSize}
          >
            +
          </button>
          <button
            className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white transition-colors text-lg font-bold"
            onClick={handleDecreaseSize}
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. LoadingOverlay Component (全屏模糊状态加载等候组件)
// ==========================================
export function LoadingOverlay({ loading }) {
  if (!loading) return null;

  return (
    <div className="backdrop-blur-[2px] bg-white/30 inset-0 absolute flex items-center justify-center z-50 transition-all duration-300">
      <div className="bg-white p-4 rounded-xl shadow-xl border border-zinc-100 flex items-center gap-3">
        <FontAwesomeIcon icon={faSpinner} className="text-zinc-900 animate-spin" />
        <span className="text-xs font-bold tracking-widest text-zinc-900 uppercase">Processing</span>
      </div>
    </div>
  );
}

// ==========================================
// 5. SignIn Component (LoginPage - 默认全屏登录过渡页组件)
// ==========================================
export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <LoginModal isOpen={true} isPage={true} />
      <ToastContainer />
    </div>
  );
}

// ==========================================
// 6. SignOutButton Component (安全登出按钮组件)
// ==========================================
export function SignOutButton() {
  return (
    <button onClick={() => signOut()}>
      Sign Out
    </button>
  );
}

// ==========================================
// 7. SwitchButton Component (Switcher - 图片违规拦截快捷黑名单开关组件)
// ==========================================
const updateRating = async (initName, rating) => {
  try {
    const res = await fetch(`/api/admin/block`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        "name": initName,
        "rating": rating
      }),
    });
    const res_data = await res.json();
    if (res_data.success) {
      toast.success('Success!');
    } else {
      toast.error('Failed!');
    }
  } catch (error) {
    toast.error(error.message);
  }
};

export function Switcher({ initialChecked, initName }) {
  const [isChecked, setIsChecked] = useState(initialChecked === 3);
  const isDisabled = initName.startsWith('/file') || initName.startsWith('/cfile') || initName.startsWith('/rfile');

  useEffect(() => {
    setIsChecked(initialChecked === 3);
  }, [initialChecked]);

  const handleCheckboxChange = async () => {
    if (!isDisabled) return;

    const newRating = isChecked ? 1 : 3;
    await updateRating(initName, newRating);
    setIsChecked(!isChecked);
  };

  return (
    <label className="autoSaverSwitch relative inline-flex cursor-pointer select-none items-center">
      <input
        type="checkbox"
        name="autoSaver"
        className="sr-only"
        checked={isChecked}
        onChange={handleCheckboxChange}
        disabled={!isDisabled}
      />
      <span
        className={`slider mr-2 flex h-[20px] w-[36px] items-center rounded-full p-0.5 duration-200 transition-colors ${isChecked ? 'bg-black' : 'bg-zinc-200'}`}
      >
        <span
          className={`dot h-[14px] w-[14px] rounded-full bg-white shadow-sm duration-200 ${isChecked ? 'translate-x-4' : ''}`}
        ></span>
      </span>
    </label>
  );
}

// ==========================================
// 8. Tooltip Component (TooltipItem - 气泡文字提示辅助工具组件)
// ==========================================
export function TooltipItem({ children, tooltipsText, position }) {
  return (
    <div className="">
      <div className="">
        <div className="group relative inline-block">
          <button className="inline-flex rounded">
            {children}
          </button>
          <div
            className={` ${
              (position === "right" &&
                `absolute bg-zinc-900 text-white left-full top-1/2 z-20 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity`) ||
              (position === "top" &&
                `absolute bg-zinc-900 text-white bottom-full left-1/2 z-20 mb-3 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity`) ||
              (position === "left" &&
                `absolute bg-zinc-900 text-white right-full top-1/2 z-20 mr-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity`) ||
              (position === "bottom" &&
                `absolute bg-zinc-900 text-white left-1/2 top-full z-20 mt-3 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity`)
            }`}
          >
            {/* 指向性微型倒三角 */}
            <span
              className={` ${
                (position === "right" &&
                  `absolute left-[-3px] top-1/2 -z-10 h-2 w-2 -translate-y-1/2 rotate-45 rounded-sm bg-primary`) ||
                (position === "top" &&
                  `absolute bottom-[-3px] left-1/2 -z-10 h-2 w-2 -translate-x-1/2 rotate-45 rounded-sm bg-primary`) ||
                (position === "left" &&
                  `absolute right-[-3px] top-1/2 -z-10 h-2 w-2 -translate-y-1/2 rotate-45 rounded-sm bg-primary`) ||
                (position === "bottom" &&
                  `absolute left-1/2 top-[-3px] -z-10 h-2 w-2 -translate-x-1/2 rotate-45 rounded-sm bg-primary`)
              } `}
            ></span>
            {tooltipsText}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ==========================================
// 9. Table Component (后台管理数据主列表项渲染组件)
// ==========================================
export function Table({ data: initialData = [] }) {
  const [data, setData] = useState(initialData);
  const [modalData, setModalData] = useState(null); // 分享面板绑定的活动数据
  const [itemToDelete, setItemToDelete] = useState(null); // 即将执行彻底物理删除的项目标识
  const modalRef = useRef(null);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // 点击遮罩层关闭模态弹窗
  const handleClickOutside = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      setModalData(null);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // 获取真实物理或代理存储链接
  const getImgUrl = (url) => {
    return url.startsWith("/file/") || url.startsWith("/cfile/") || url.startsWith("/rfile/") ? `${origin}/api${url}` : url;
  };

  const handleNameClick = (item) => {
    setModalData(item);
  };

  const handleCloseModal = () => {
    setModalData(null);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`Link copied successfully`);
    });
  };

  // 通过后台 API 请求永久删除选中图片物理介质及对应 D1 数据库记录
  const deleteItem = async (initName) => {
    try {
      const res = await fetch(`/api/admin/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: initName,
        }),
      });
      const res_data = await res.json();
      if (res_data.success) {
        toast.success('Deleted successfully!');
        setData(prevData => prevData.filter(item => item.url !== initName));
      } else {
        toast.error(res_data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = (initName) => {
    setItemToDelete(initName);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      await deleteItem(itemToDelete);
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => {
    setItemToDelete(null);
  };

  // 辅助解析：截取链接段中最后一串文字
  function getLastSegment(url) {
    const lastSlashIndex = url.lastIndexOf('/');
    return url.substring(lastSlashIndex + 1);
  }

  // 动态渲染列表中的媒体内容主体类型预览（自动区分音频/视频/普通图片格式渲染）
  const renderFile = (fileUrl, index) => {
    const _url = getLastSegment(fileUrl);
    const getFileExtensionLocal = (url) => {
      const parts = url.split('.');
      return parts.length > 1 ? parts.pop().toLowerCase() : '';
    };
    const fileExtension = getFileExtensionLocal(_url);

    const imageExtensionsLocal = [
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp',
      'svg', 'ico', 'heic', 'heif', 'raw', 'psd', 'ai', 'eps'
    ];

    const videoExtensionsLocal = [
      'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'ogg',
      'ogv', 'm4v', '3gp', '3g2', 'mpg', 'mpeg', 'mxf', 'vob'
    ];

    if (imageExtensionsLocal.includes(fileExtension)) {
      return (
        <img
          key={`image-${index}`}
          src={fileUrl}
          alt={`Uploaded ${index}`}
          className="w-full h-full object-cover"
        />
      );
    } else if (videoExtensionsLocal.includes(fileExtension)) {
      return (
        <video
          key={`video-${index}`}
          src={fileUrl}
          className="w-full h-full object-cover"
          controls
        >
          Your browser does not support the video tag.
        </video>
      );
    } else {
      return (
        <img
          key={`image-${index}`}
          src={fileUrl}
          alt={`Uploaded ${index}`}
          className="w-full h-full object-cover"
        />
      );
    }
  };

  // 全屏预览灯箱切换
  function toggleFullScreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      const element = document.querySelector('.PhotoView-Portal');
      if (element) {
        element.requestFullscreen();
      }
    }
  }

  const isVideo = (url) => {
    return /\.(mp4|mkv|avi|mov|wmv|flv|webm|ogg|ogv|m4v|3gp|3g2|mpg|mpeg|mxf|vob)$/i.test(url);
  };

  const elementSize = 400;

  return (
    <div className="w-full">
      <div className="overflow-x-auto border border-zinc-200 rounded-lg shadow-sm bg-white">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead className="bg-zinc-50/50">
              <tr>
                <th className="py-2 px-4 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-[160px]">Name</th>
                <th className="sticky left-0 z-10 bg-zinc-50/50 py-2 px-4 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-[50px]">Preview</th>
                <th className="py-2 px-4 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-[100px]">Time</th>
                <th className="py-2 px-4 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-[80px]">IP</th>
                <th className="py-2 px-4 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-[40px]">PV</th>
                <th className="py-2 px-4 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-[30px]">R</th>
                <th className="sticky right-0 z-10 bg-zinc-50/50 py-2 px-4 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-[80px]">Actions</th>
              </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
          <PhotoProvider
            maskOpacity={0.5}
            toolbarRender={({ rotate, onRotate, onScale, scale }) => {
              return (
                <>
                  <svg
                    className="PhotoView-Slider__toolbarIcon"
                    width="44"
                    height="44"
                    viewBox="0 0 768 768"
                    fill="white"
                    onClick={() => onScale(scale + 0.5)}
                  >
                    <path d="M384 640.5q105 0 180.75-75.75t75.75-180.75-75.75-180.75-180.75-75.75-180.75 75.75-75.75 180.75 75.75 180.75 180.75 75.75zM384 64.5q132 0 225.75 93.75t93.75 225.75-93.75 225.75-225.75 93.75-225.75-93.75-93.75-225.75 93.75-225.75 225.75-93.75zM415.5 223.5v129h129v63h-129v129h-63v-129h-129v-63h129v-129h63z" />
                  </svg>
                  <svg
                    className="PhotoView-Slider__toolbarIcon"
                    width="44"
                    height="44"
                    viewBox="0 0 768 768"
                    fill="white"
                    onClick={() => onScale(scale - 0.5)}
                  >
                    <path d="M384 640.5q105 0 180.75-75.75t75.75-180.75-75.75-180.75-180.75-75.75-180.75 75.75-75.75 180.75 75.75 180.75 180.75 75.75zM384 64.5q132 0 225.75 93.75t93.75 225.75-93.75 225.75-225.75 93.75-225.75-93.75-93.75-225.75 93.75-225.75 225.75-93.75zM223.5 352.5h321v63h-321v-63z" />
                  </svg>
                  <svg
                    className="PhotoView-Slider__toolbarIcon"
                    onClick={() => onRotate(rotate + 90)}
                    width="44"
                    height="44"
                    fill="white"
                    viewBox="0 0 768 768"
                  >
                    <path d="M565.5 202.5l75-75v225h-225l103.5-103.5c-34.5-34.5-82.5-57-135-57-106.5 0-192 85.5-192 192s85.5 192 192 192c84 0 156-52.5 181.5-127.5h66c-28.5 111-127.5 192-247.5 192-141 0-255-115.5-255-256.5s114-256.5 255-256.5c70.5 0 135 28.5 181.5 75z" />
                  </svg>
                  {document.fullscreenEnabled && <FullScreenIcon onClick={toggleFullScreen} />}
                </>
              );
            }}
          >
            {data.map((item, index) => (
              <tr key={index} className="group hover:bg-zinc-50/30 transition-colors">
                <td onClick={() => handleNameClick(item)} className="py-2 px-4 text-xs font-semibold text-zinc-900 truncate max-w-[150px] cursor-pointer hover:underline transition-all">
                  {item.url.split('?')[0]}
                </td>
                <td className="sticky left-0 z-10 bg-white group-hover:bg-zinc-50/30 py-2 px-4 border-l border-zinc-100">
                  <div className="w-8 h-8 mx-auto overflow-hidden rounded-md relative shadow-sm border border-zinc-200">
                    {isVideo(getImgUrl(item.url)) ? (
                      <PhotoView
                        key={item.url}
                        width={elementSize}
                        height={elementSize}
                        render={({ scale, attrs }) => {
                          const width = attrs.style.width;
                          const offset = (width - elementSize) / elementSize;
                          const childScale = scale === 1 ? scale + offset : 1 + offset;
                          return (
                            <div {...attrs} className={`flex-none bg-white ${attrs.className || ''}`}>
                              {renderFile(getImgUrl(item.url), index)}
                            </div>
                          );
                        }}
                      >
                        {renderFile(getImgUrl(item.url), index)}
                      </PhotoView>
                    ) : (
                      <PhotoView key={item.url} src={getImgUrl(item.url)}>
                        <div className="cursor-pointer h-full w-full">
                           {renderFile(getImgUrl(item.url), index)}
                        </div>
                      </PhotoView>
                    )}
                  </div>
                </td>
                <td className="py-2 px-4 text-[10px] text-zinc-500 font-medium leading-tight">
                  {item.time.includes(' ') ? (
                    <>
                      <div className="text-zinc-900">{item.time.split(' ')[0]}</div>
                      <div className="text-zinc-400">{item.time.split(' ')[1]}</div>
                    </>
                  ) : item.time}
                </td>
                <td className="py-2 px-4 text-[10px] text-zinc-400">
                  <TooltipItem tooltipsText={item.ip} position="bottom">
                    <div className="truncate max-w-[70px] font-mono">{item.ip}</div>
                  </TooltipItem>
                </td>
                <td className="py-2 px-4 text-[10px] text-zinc-900 font-bold text-center">{item.total}</td>
                <td className="py-2 px-4 text-[10px] text-zinc-900 font-bold text-center">{item.rating}</td>
                <td className="sticky right-0 z-10 bg-white group-hover:bg-zinc-50/30 py-2 px-4 border-l border-zinc-100">
                  <div className="flex flex-row justify-center items-center gap-2">
                    <Switcher initialChecked={item.rating} initName={item.url} />
                    <button
                      onClick={() => handleDelete(item.url)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <FontAwesomeIcon icon={faTrashAlt} size="sm" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </PhotoProvider>
        </tbody>
      </table>
      </div>

      {/* 分享格式弹发面板（支持 HTML、Markdown、Raw URL 与 BB-Code 复制） */}
      {modalData && (
        <div onClick={handleClickOutside} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          <div ref={modalRef} className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-zinc-200 animate-in fade-in zoom-in duration-200">
            <button className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 transition-colors" onClick={handleCloseModal}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor font-bold">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-6 pt-10 flex flex-col gap-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 px-1">Share Links</h4>
              {[
                { label: 'URL', text: getImgUrl(modalData.url), onClick: () => handleCopy(getImgUrl(modalData.url)) },
                { label: 'MD', text: `![${modalData.url}](${getImgUrl(modalData.url)})`, onClick: () => handleCopy(`![${modalData.url}](${getImgUrl(modalData.url)})`) },
                { label: 'HTML', text: `<img src="${getImgUrl(modalData.url)}">`, onClick: () => handleCopy(`<img src="${getImgUrl(modalData.url)}">`) },
                { label: 'BB', text: `[img]${getImgUrl(modalData.url)}[/img]`, onClick: () => handleCopy(`[img]${getImgUrl(modalData.url)}[/img]`) },
              ].map((item, i) => (
                <div key={i} className="group relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-300">{item.label}</span>
                  <input
                    readOnly
                    value={item.text}
                    onClick={item.onClick}
                    className="w-full pl-12 pr-3 py-2 text-xs font-medium text-zinc-600 bg-zinc-50/50 border border-zinc-100 rounded-md cursor-pointer hover:bg-zinc-50 hover:border-zinc-200 transition-all focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 确认彻底物理级移除二次判定提示框 */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 border border-zinc-200 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold tracking-tight text-zinc-900 mb-2">Are you sure?</h3>
            <p className="text-sm text-zinc-500 mb-6 font-medium">This action will permanently delete this item. This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-md text-sm font-bold shadow-sm hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
