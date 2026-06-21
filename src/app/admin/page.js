'use client'
import { signOut } from "next-auth/react"
import { Table } from "@/components"
import { useState, useEffect, useCallback } from 'react';
import { ToastContainer, toast } from "react-toastify";
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';

// 管理员专用控制面板页面
export default function Admin() {
  const [listData, setListData] = useState([]) // 当前分页加载对应的图表数据条目
  const [currentPage, setCurrentPage] = useState(1); // 页面当前的活动页签索引
  const [searchTotal, setSearchTotal] = useState(0); // 统计搜索或过滤结果匹配出的总可分页数
  const [inputPage, setInputPage] = useState(1); // 输入跳转的页码绑定
  const [searchQuery, setSearchQuery] = useState(''); // 搜索框绑定的字符串查询对象

  // 回调拉取主分页列表数据
  const getListdata = useCallback(async (page) => {
    try {
      const res = await fetch(`/api/admin/list`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({
          page: (page - 1),
          query: searchQuery, // 传递搜索查询
        })
      })
      const res_data = await res.json()
      if (!res_data?.success) {
        toast.error(res_data.message)
      } else {
        // 由于可能存在的历史脏数据，前端按 URL 去重
        const uniqueData = Array.from(new Map((res_data.data || []).map(item => [item.url, item])).values());
        setListData(uniqueData)
        const totalPages = Math.ceil(res_data.total / 10);
        setSearchTotal(totalPages);
      }

    } catch (error) {
      toast.error(error.message)
    }

  }, [searchQuery]);

  // 页数变动时自动重新拉取图表
  useEffect(() => {
    getListdata(currentPage)
  }, [currentPage, getListdata]);

  // 分页控制按钮：向后翻页
  const handleNextPage = () => {
    const nextPage = currentPage + 1;
    if (nextPage > searchTotal) { // 检查下一页是否在总页数范围内
      toast.error('You are on the last page!')
    }
    if (nextPage <= searchTotal) { // 检查下一页是否在总页数范围内
      setCurrentPage(nextPage);
      setInputPage(nextPage)
    }

  };

  // 分页控制按钮：向前翻页
  const handlePrevPage = () => {
    const prevPage = currentPage - 1;
    if (prevPage >= 1) { // 检查上一页是否在总页数范围内
      setCurrentPage(prevPage);
      setInputPage(prevPage)
    }

  };

  // 跨页快速跳转处理器
  const handleJumpPage = () => {
    const page = parseInt(inputPage, 10);
    if (!isNaN(page) && page >= 1 && page <= searchTotal) {
      setCurrentPage(page);
    } else {
      toast.error('Please enter a valid page number!');
    }
  };

  // 处理搜索过滤行为
  const handleSearch = (event) => {
    event.preventDefault();
    setCurrentPage(1);
    setInputPage(1);
    getListdata(1);
  };

  return (
    <>
      <div className="overflow-auto h-full flex w-full min-h-screen flex-col items-center justify-between">
        {/* 固定顶置导航结构 */}
        <header className="fixed top-0 h-[50px] left-0 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md flex z-50 justify-center items-center">
          <div className="flex justify-between items-center w-full max-w-5xl px-6">
            <h1 className="text-sm font-bold tracking-tight text-zinc-900">ADMIN DASHBOARD</h1>
            <div className="flex items-center gap-3">
              <form onSubmit={handleSearch} className="hidden sm:flex items-center">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="border border-zinc-200 rounded-md py-1 px-3 text-xs focus:border-black focus:ring-0 outline-none w-48 transition-colors bg-zinc-50/50 hover:bg-zinc-50"
                    placeholder="Search by URL or IP..."
                  />
                </div>
              </form>
              <Link href="/">
                <button
                  id="admin-home-btn"
                  title="Home"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:text-black hover:bg-zinc-50 transition-all duration-150 shadow-sm"
                >
                  <FontAwesomeIcon icon={faHome} className="w-4 h-4" />
                </button>
              </Link>
              <button 
                onClick={() => signOut({ callbackUrl: "/" })} 
                id="admin-logout-btn"
                title="Logout"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:text-red-500 hover:bg-zinc-50 transition-all duration-150 shadow-sm"
              >
                <FontAwesomeIcon icon={faSignOutAlt} className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* 主数据列表及组件展示区域 */}
        <main className="my-[60px] w-9/10  sm:w-9/10 md:w-9/10 lg:w-9/10 xl:w-3/5 2xl:w-full">

          <Table data={listData} />

        </main>

        {/* 底层控制面板及分页悬浮处理栏 */}
        <div className="fixed inset-x-0 bottom-0 h-[50px] w-full flex z-50 justify-center items-center bg-white border-t border-zinc-200">
          <div className="flex justify-center items-center gap-4">
            <button 
              className="text-[10px] font-bold text-zinc-400 hover:text-black transition-colors uppercase tracking-widest disabled:opacity-30" 
              onClick={handlePrevPage} 
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-zinc-900 leading-none">
                {currentPage} <span className="text-zinc-300 mx-1">/</span> {searchTotal}
              </span>
            </div>
            <button 
              className="text-[10px] font-bold text-zinc-400 hover:text-black transition-colors uppercase tracking-widest disabled:opacity-30" 
              onClick={handleNextPage}
              disabled={currentPage === searchTotal}
            >
              Next
            </button>
            <div className="h-4 w-px bg-zinc-200 mx-1"></div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={inputPage}
                onChange={(e) => setInputPage(e.target.value)}
                className="border border-zinc-200 rounded py-1 px-2 w-12 text-[10px] font-bold focus:outline-none focus:border-zinc-400 transition-colors"
                placeholder="Pg"
              />
              <button 
                className="text-[10px] font-bold text-zinc-900 hover:underline uppercase tracking-widest" 
                onClick={handleJumpPage}
              >
                Go
              </button>
            </div>
          </div>
        </div>
        <ToastContainer position="bottom-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" />
      </div>
    </>

  )
}