"use client";
import { useState, useRef, useCallback } from "react";
import { signOut } from "next-auth/react"
import Image from "next/image";
import { faImages, faTrashAlt, faUpload, faSearchPlus, faCog, faSignInAlt, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ToastContainer } from "react-toastify";
import { toast } from "react-toastify";
import { useEffect } from 'react';
import { Footer, LoadingOverlay } from '@/components';
import Link from "next/link";
import LoginModal from '@/components/LoginModal';

// 登录快捷按钮辅助函数式组件
const LoginButton = ({ onClick, href, children }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium transition-colors bg-black text-white hover:bg-zinc-800 rounded-md border border-black shadow-sm"
  >
    {children}
  </button>
);

// 主应用门户级首页面板 React 组件
export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState([]); // 用户已选待上传暂存文件数组
  const [uploadedImages, setUploadedImages] = useState([]); // 服务器已成功回调并持久化的上传结果列表
  const [uploadedFilesNum, setUploadedFilesNum] = useState(0); // 本次上传成功的总数
  const [selectedImage, setSelectedImage] = useState(null); // 上传后点击预览大图
  const [activeTab, setActiveTab] = useState('preview'); // 分享格式选择页签
  const [uploading, setUploading] = useState(false); // 进行物理上传时的全局加锁背景遮罩状态
  const [IP, setIP] = useState(''); // 用户端来源 IP 地址
  const [Total, setTotal] = useState('?'); // 全网已承载文件累计总数
  const [selectedOption, setSelectedOption] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected_upload_option') || 'r2';
    }
    return 'r2';
  }); // 选择将文件上传到的具体网关或渠道D桶
  const [isAuthapi, setisAuthapi] = useState(false); // 会话是否已获得登录管理层鉴权
  const [Loginuser, setLoginuser] = useState(''); // 获取当期管理员或用户具体会话身份标识
  const [boxType, setBoxtype] = useState("img"); // 预览浮层内容的类型
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false); // 悬浮登录快捷框开启/关闭状态

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const parentRef = useRef(null);

  let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
  }

  // 初始化拉取各接口环境与服务器态势并建立动态轮询
  useEffect(() => {
    ip();
    getTotal();
    isAuth();
    // 自动轻量化轮询：秒级同步图床总量计数，防止因跨标签管理物理删除产生显示失衡
    const totalInterval = setInterval(getTotal, 60000);
    return () => {
      clearInterval(totalInterval);
    };
  }, []);

  // 1. IP 拉取：异步检测用户的当前局网/公网出口 IP 并更新回显
  const ip = async () => {
    try {
      const res = await fetch(`/api/ip`, {
        method: "GET",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      setIP(data.ip);
    } catch (error) {
      console.error('Request error (ip):', error);
    }
  };

  // 2. 鉴权检测：侦测当前 Session 的 NextAuth 登录关联情况与管理员权限
  const isAuth = async () => {
    try {
      const res = await fetch(`/api/enableauthapi/isauth`, {
        method: "GET",
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        setisAuthapi(true)
        setLoginuser(data.role)
      } else {
        setisAuthapi(false)
        const saved = localStorage.getItem('selected_upload_option') || 'r2';
        setSelectedOption(saved);
      }
    } catch (error) {
      console.error('Request error (isAuth):', error);
    }
  };

  // 3. 统计计数：通过安全数据拉取总数
  const getTotal = async () => {
    try {
      const res = await fetch(`/api/total?_t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      setTotal(data.total);
    } catch (error) {
      console.error('Request error:', error);
    }
  }

  // 4. 输入变更：支持用户手动在对话弹窗与拖拽区中批量塞入文件资源
  const handleFileChange = (event) => {
    const newFiles = event.target.files;
    const filteredFiles = Array.from(newFiles).filter(file =>
      !selectedFiles.find(selFile => selFile.name === file.name));
    // 过滤掉已经在已成功上传的 uploadedImages 文件集里的文件
    const uniqueFiles = filteredFiles.filter(file =>
      !uploadedImages.find(upImg => upImg.name === file.name)
    );

    setSelectedFiles([...selectedFiles, ...uniqueFiles]);
  };

  // 5. 状态清除：擦除本地选空待上和已上传结果记录
  const handleClear = () => {
    setSelectedFiles([]);
    setUploadedImages([]);
    setUploadedFilesNum(0);
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // 6. 大小计算器：统计当期所选批量资源的总体积
  const getTotalSizeInMB = (files) => {
    const totalSizeInBytes = Array.from(files).reduce((acc, file) => acc + file.size, 0);
    return (totalSizeInBytes / (1024 * 1024)).toFixed(2); // 转换为MB并保留两位小数
  };

  // 7. 多介质文件分段上传具体通道逻辑
  const handleUpload = async (file = null) => {
    setUploading(true);

    const filesToUpload = file ? [file] : selectedFiles;

    if (filesToUpload.length === 0) {
      toast.error('Please select files to upload');
      setUploading(false);
      return;
    }

    const formFieldName = "file";
    let successCount = 0;

    try {
      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append(formFieldName, file);

        try {
          // 根据通道前缀的不同，分发匹配不同的 API 端点接口路由
          const targetUrl = selectedOption === "tgchannel" || selectedOption === "r2"
            ? `/api/enableauthapi/${selectedOption}`
            : `/api/${selectedOption}`;

          const response = await fetch(targetUrl, {
            method: 'POST',
            body: formData,
            headers: headers
          });

          if (response.ok) {
            const result = await response.json();

            const imageRecord = {
              url: result.url,
              name: file.name,
              type: file.type
            };

            // 上传成功后将成品计入已成功资源池并出栈带暂存队列
            setUploadedImages((prevImages) => [...prevImages, imageRecord]);
            setSelectedFiles((prevFiles) => prevFiles.filter(f => f !== file));
            successCount++;
          } else {
            // 发生异常，提炼服务端具体原因
            let errorMsg;
            try {
              const errorData = await response.json();
              errorMsg = errorData.message || `Error uploading image ${file.name}`;
            } catch (jsonError) {
              errorMsg = `Unknown error uploading image ${file.name}`;
            }

            // 细化和分类不同状态代码做精准的用户通知
            switch (response.status) {
              case 400:
                toast.error(`Invalid request: ${errorMsg}`);
                break;
              case 403:
                toast.error(`Forbidden access: ${errorMsg}`);
                break;
              case 404:
                toast.error(`Resource not found: ${errorMsg}`);
                break;
              case 500:
                toast.error(`Server error: ${errorMsg}`);
                break;
              case 401:
                toast.error(`Unauthorized: ${errorMsg}`);
                break;
              default:
                toast.error(`Error uploading ${file.name}: ${errorMsg}`);
            }
          }
        } catch (error) {
          toast.error(`Error uploading ${file.name}`);
        }
      }

      setUploadedFilesNum(uploadedFilesNum + successCount);
      toast.success(`Successfully uploaded ${successCount} images`);

    } catch (error) {
      console.error('Error during upload process:', error);
      toast.error('Upload error');
    } finally {
      setUploading(false);
    }
  };

  // 8. 剪贴板粘贴上传侦听器：支持在拖拽容器范围内粘贴实体文件或者系统截图
  const handlePaste = (event) => {
    const clipboardItems = event.clipboardData.items;

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.kind === 'file' && item.type.includes('image')) {
        const file = item.getAsFile();
        setSelectedFiles([...selectedFiles, file]);
        break; // 每次仅快捷粘贴并拦截第一个单张文件
      }
    }
  };

  // 9. 拖拽物理松手行为拦截器
  const handleDrop = (event) => {
    event.preventDefault();
    const files = event.dataTransfer.files;

    if (files.length > 0) {
      const filteredFiles = Array.from(files).filter(file => !selectedFiles.find(selFile => selFile.name === file.name));
      setSelectedFiles([...selectedFiles, ...filteredFiles]);
    }
  };

  // 10. 拖拽进入容器的视觉预备过程拦截
  const handleDragOver = (event) => {
    event.preventDefault();
  };

  // 动态依待传项目数量来递增容器缩略框尺寸
  const calculateMinHeight = () => {
    const rows = Math.ceil(selectedFiles.length / 4);
    return `${rows * 100}px`;
  };

  // 11. 处理点击缩略图进行大图/视频全屏级灯箱展示
  const handleImageClick = (index) => {
    if (selectedFiles[index].type.startsWith('image/')) {
      setBoxtype("img");
    } else if (selectedFiles[index].type.startsWith('video/')) {
      setBoxtype("video");
    } else {
      setBoxtype("other");
    }

    setSelectedImage(URL.createObjectURL(selectedFiles[index]));
  };

  const handleCloseImage = () => {
    setSelectedImage(null);
  };

  const handleRemoveImage = (index) => {
    const updatedFiles = selectedFiles.filter((_, idx) => idx !== index);
    setSelectedFiles(updatedFiles);
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Link copied successfully`);
    } catch (err) {
      toast.error("Failed to copy link")
    }
  };

  const handleCopyCode = async () => {
    const codeElements = parentRef.current.querySelectorAll('code');
    const values = Array.from(codeElements).map(code => code.textContent);
    try {
      await navigator.clipboard.writeText(values.join("\n"));
      toast.success(`Link copied successfully`);

    } catch (error) {
      toast.error(`Failed to copy link\n${error}`)
    }
  }

  const handlerenderImageClick = (imageUrl, type) => {
    setBoxtype(type);
    setSelectedImage(imageUrl);
  };

  // 按类型解析预览图渲染
  const renderFile = (data, index) => {
    const fileUrl = data.url;
    if (data.type.startsWith('image/')) {
      return (
        <img
          key={`image-${index}`}
          src={data.url}
          alt={`Uploaded ${index}`}
          className="object-cover w-36 h-40 m-2"
          onClick={() => handlerenderImageClick(fileUrl, "img")}
        />
      );

    } else if (data.type.startsWith('video/')) {
      return (
        <video
          key={`video-${index}`}
          src={data.url}
          className="object-cover w-36 h-40 m-2"
          controls
          onClick={() => handlerenderImageClick(fileUrl, "video")}
        >
          Your browser does not support the video tag.
        </video>
      );

    } else {
      return (
        <img
          key={`image-${index}`}
          src={data.url}
          alt={`Uploaded ${index}`}
          className="object-cover w-36 h-40 m-2"
          onClick={() => handlerenderImageClick(fileUrl, "other")}
        />
      );
    }
  };


  // 12. 页签内联格式化展现器控制：支持多类链接格式转换一键复制
  const renderTabContent = () => {
    switch (activeTab) {
      case 'preview':
        return (
          <div className=" flex flex-col ">
            {uploadedImages.map((data, index) => (
              <div key={index} className="m-2 rounded-2xl ring-offset-2 ring-2  ring-slate-100 flex flex-row ">
                {renderFile(data, index)}
                <div className="flex flex-col justify-center w-4/5">
                  {[
                    { text: data.url, onClick: () => handleCopy(data.url) },
                    { text: `![${data.name}](${data.url})`, onClick: () => handleCopy(`![${data.name}](${data.url})`) },
                    { text: `<a href="${data.url}" target="_blank"><img src="${data.url}"></a>`, onClick: () => handleCopy(`<a href="${data.url}" target="_blank"><img src="${data.url}"></a>`) },
                    { text: `[img]${data.url}[/img]`, onClick: () => handleCopy(`[img]${data.url}[/img]`) },
                  ].map((item, i) => (
                    <input
                      key={`input-${i}`}
                      readOnly
                      value={item.text}
                      onClick={item.onClick}
                      className="px-3 my-1 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-800 focus:outline-none placeholder-gray-400"
                    />
                  ))}
                </div>
              </div>

            ))}
          </div>
        );
      case 'htmlLinks':
        return (
          <div ref={parentRef} className=" p-4 bg-slate-100  " onClick={handleCopyCode}>
            {uploadedImages.map((data, index) => (
              <div key={index} className="mb-2 ">
                <code className=" w-2 break-all">{`<img src="${data.url}" alt="${data.name}" />`}</code>
              </div>
            ))}
          </div >
        );
      case 'markdownLinks':
        return (
          <div ref={parentRef} className=" p-4 bg-slate-100  " onClick={handleCopyCode}>
            {uploadedImages.map((data, index) => (
              <div key={index} className="mb-2">
                <code className=" w-2 break-all">{`![${data.name}](${data.url})`}</code>
              </div>
            ))}
          </div>
        );
      case 'bbcodeLinks':
        return (
          <div ref={parentRef} className=" p-4 bg-slate-100  " onClick={handleCopyCode}>
            {uploadedImages.map((data, index) => (
              <div key={index} className="mb-2">
                <code className=" w-2 break-all">{`[img]${data.url}[/img]`}</code>
              </div>
            ))}
          </div>
        );
      case 'viewLinks':
        return (
          <div ref={parentRef} className=" p-4 bg-slate-100  " onClick={handleCopyCode}>
            {uploadedImages.map((data, index) => (
              <div key={index} className="mb-2">
                <code className=" w-2 break-all">{`${data.url}`}</code>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const handleSelectChange = (e) => {
    const value = e.target.value;
    setSelectedOption(value); // 更新选择框的值
    localStorage.setItem('selected_upload_option', value);
  };


  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  // 13. 右上角导航按钮动态渲染：根据会话鉴权状态动态组合图标按钮
  const renderButton = () => {
    switch (Loginuser) {
      case 'user':
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSignOut}
              title="Logout"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:text-red-500 hover:bg-zinc-50 transition-all duration-150 shadow-sm"
            >
              <FontAwesomeIcon icon={faSignOutAlt} className="w-4 h-4" />
            </button>
          </div>
        );
      case 'admin':
        return (
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <button
                id="header-admin-btn"
                title="Admin Dashboard"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:text-black hover:bg-zinc-50 transition-all duration-150 shadow-sm"
              >
                <FontAwesomeIcon icon={faCog} className="w-4 h-4" />
              </button>
            </Link>
            <button
              onClick={handleSignOut}
              title="Logout"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:text-red-500 hover:bg-zinc-50 transition-all duration-150 shadow-sm"
            >
              <FontAwesomeIcon icon={faSignOutAlt} className="w-4 h-4" />
            </button>
          </div>
        );
      default:
        // 默认未登录状态（即 Visitor 访客组，无特殊修改与上传权限，只具备浏览权）
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLoginModalOpen(true)}
              title="Login"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:text-black hover:bg-zinc-50 transition-all duration-150 shadow-sm"
            >
              <FontAwesomeIcon icon={faSignInAlt} className="w-4 h-4" />
            </button>
          </div>
        );
    }
  };

  return (
    <main className=" overflow-auto h-full flex w-full min-h-screen flex-col items-center justify-between">
      {/* 顶部通栏导航 */}
      <header className="fixed top-0 h-[50px] left-0 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md flex z-50 justify-center items-center">
        <div className="flex justify-between items-center w-full max-w-5xl px-6">
          <nav className="flex items-center gap-2 text-sm font-bold tracking-tight text-zinc-900">
            IMAGE HUB
            {Loginuser === 'admin' ? (
              <span className="text-[10px] font-semibold bg-zinc-900 text-white px-1.5 py-0.5 rounded uppercase tracking-widest cursor-default">Admin</span>
            ) : Loginuser === 'user' ? (
              <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded border border-zinc-200 uppercase tracking-widest cursor-default">User</span>
            ) : (
              <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-200 uppercase tracking-widest cursor-default">Visitor</span>
            )}
          </nav>
          {renderButton()}
        </div>
      </header>
      <div className="mt-[60px] w-9/10 sm:w-9/10 md:w-9/10 lg:w-9/10 xl:w-3/5 2xl:w-2/3">

        {/* 欢迎语及通道上传控制 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="flex flex-col">
            <h1 className="text-zinc-900 text-2xl font-bold tracking-tight">Upload Center</h1>
            <div className="text-sm text-zinc-500">
              Max size 20 MB • <span className="text-zinc-900 font-medium">{Total}</span> images hosted • Your IP: <span className="text-zinc-900 font-medium">{IP}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Gateway</span>
            <select
              value={selectedOption}
              onChange={handleSelectChange}
              className="text-sm py-1.5 pl-2 pr-8 border border-zinc-200 rounded-md bg-white hover:border-zinc-300 focus:ring-0 focus:outline-none transition-colors appearance-none cursor-pointer min-w-[120px]"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a1a1aa'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.25rem' }}
            >
              <option value="r2">R2</option>
              <option value="tgchannel">TG</option>
            </select>
          </div>
        </div>

        {/* 拖拽式及粘贴预览主容器 */}
        <div
          className="border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50 hover:bg-zinc-50 transition-colors relative"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onPaste={handlePaste}
          style={{ minHeight: calculateMinHeight() }}
        >
          <div className="flex flex-wrap gap-4 p-4 min-h-[240px]">
            <LoadingOverlay loading={uploading} />
            {selectedFiles.map((file, index) => (
              <div key={index} className="group relative rounded-lg w-40 h-44 border border-zinc-200 bg-white shadow-sm flex flex-col items-center overflow-hidden">
                <div className="relative w-full h-32 border-b border-zinc-100" onClick={() => handleImageClick(index)}>
                  {file.type.startsWith('image/') && (
                    <Image
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${file.name}`}
                      fill={true}
                    />
                  )}
                  {file.type.startsWith('video/') && (
                    <video
                      src={URL.createObjectURL(file)}
                      controls
                      className="w-full h-full"
                    />
                  )}
                  {!file.type.startsWith('image/') && !file.type.startsWith('video/') && (
                    <div className="flex items-center justify-center w-full h-full bg-gray-200 text-gray-700">
                      <p>{file.name}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-row items-center justify-center w-full grow gap-2 p-2">
                  <button
                    className="p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors"
                    onClick={() => handleImageClick(index)}
                  >
                    <FontAwesomeIcon icon={faSearchPlus} size="sm" />
                  </button>
                  <button
                    className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                    onClick={() => handleRemoveImage(index)}
                  >
                    <FontAwesomeIcon icon={faTrashAlt} size="sm" />
                  </button>
                  <button
                    className="p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors"
                    onClick={() => handleUpload(file)}
                  >
                    <FontAwesomeIcon icon={faUpload} size="sm" />
                  </button>
                </div>
              </div>
            ))}


            {selectedFiles.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-zinc-400 text-sm">
                  Drop files here or paste from clipboard
                </div>
              </div>
            )}

          </div>
        </div>

        {/* 底部选择、清除和上传动作条 */}
        <div className="w-full rounded-lg border border-zinc-200 shadow-sm overflow-hidden mt-6 grid grid-cols-8 bg-white">
          <div className="md:col-span-1 col-span-8">
            <label
              htmlFor="file-upload"
              className="w-full h-10 bg-white hover:bg-zinc-50 border-r border-zinc-200 cursor-pointer flex items-center justify-center text-sm font-medium text-zinc-900 transition-colors"
            >
              <FontAwesomeIcon icon={faImages} size="sm" className="mr-2" />
              Select
            </label>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileChange}
              multiple
            />
          </div>
          <div className="md:col-span-5 col-span-8">
            <div className="w-full h-10 leading-10 px-4 text-xs font-medium text-zinc-500 bg-white text-center md:text-left">
              Selected <span className="text-zinc-900 font-bold">{selectedFiles.length}</span> • Total <span className="text-zinc-900 font-bold">{getTotalSizeInMB(selectedFiles)} MB</span>
            </div>
          </div>
          <div className="md:col-span-1 col-span-3">
            <div
              className="w-full bg-white hover:bg-zinc-50 border-l border-zinc-200 cursor-pointer h-10 flex items-center justify-center text-sm font-medium text-red-500 transition-colors"
              onClick={handleClear}
            >
              <FontAwesomeIcon icon={faTrashAlt} size="sm" className="mr-2" />
              Clear
            </div>
          </div>
          <div className="md:col-span-1 col-span-5">
            <div
              className={`w-full bg-black hover:bg-zinc-800 cursor-pointer h-10 flex items-center justify-center text-sm font-medium text-white transition-colors ${uploading ? 'pointer-events-none opacity-50' : ''}`}
              onClick={() => handleUpload()}
            >
              <FontAwesomeIcon icon={faUpload} size="sm" className="mr-2" />
              Upload
            </div>
          </div>
        </div>


        <ToastContainer position="bottom-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" />
        <div className="w-full mt-4 min-h-[200px] mb-[60px] ">

          {
            uploadedImages.length > 0 && (<>
              <div className="flex flex-wrap border-b border-zinc-200 mb-6 px-1">
                {[
                  { id: 'preview', label: 'Preview' },
                  { id: 'htmlLinks', label: 'HTML' },
                  { id: 'markdownLinks', label: 'Markdown' },
                  { id: 'bbcodeLinks', label: 'BBCode' },
                  { id: 'viewLinks', label: 'Links' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 relative -bottom-[1px] ${activeTab === tab.id ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {renderTabContent()}
            </>
            )
          }
        </div>

      </div>

      {/* 媒体全屏高级图片大图/视频展示悬浮控制灯箱 */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={handleCloseImage}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col items-center justify-center z-50 pointer-events-none">
            <button
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors pointer-events-auto"
              onClick={handleCloseImage}
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="bg-white p-1 rounded-xl shadow-2xl border border-zinc-200 pointer-events-auto overflow-hidden">
              {boxType === "img" ? (
                <img
                  src={selectedImage}
                  alt="Selected"
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                  loading="lazy"
                />
              ) : boxType === "video" ? (
                <video
                  src={selectedImage}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg outline-none"
                  controls
                  autoPlay
                />
              ) : (
                <div className="p-8 bg-white flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-zinc-900 uppercase tracking-widest">Unsupported Media</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 h-[50px] bg-white border-t border-zinc-200 w-full flex z-50 justify-center items-center">
        <Footer />
      </div>
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
        onSuccess={async () => {
          await isAuth();
          setIsLoginModalOpen(false);
        }}
      />
    </main>
  );
}