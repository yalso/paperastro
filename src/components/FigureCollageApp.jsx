import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import saveAs from 'file-saver';
import { UploadCloud, Trash2, Download, Settings, History, Save, Languages, X, GripVertical } from 'lucide-react';

// --- 国际化 (i18n) 配置 ---
const locales = {
  zh: {
    title: "科研论文拼图工具",
    subtitle: "智能布局、精准控制，专业排版您的实验图",
    layoutSettings: "1. 布局设置",
    columns: "列数",
    rows: "行数",
    generateGrid: "生成/重置网格",
    styleAndSpacing: "2. 样式与安全",
    pagePadding: "页边距 (px)",
    columnGap: "列间距 (px)",
    rowGap: "行间距 (px)",
    captionGap: "脚注间距 (px)",
    captionFontSize: "脚注字号 (px)",
    backgroundColor: "背景颜色",
    watermark: "水印文字 (留空则无水印)",
    watermarkPlaceholder: "例如: your-website.com",
    editContent: "3. 编辑内容",
    uploadPlaceholder: "点击上传 / 粘贴 / 替换",
    columnCaption: "第 {n} 列脚注",
    exportFile: "4. 导出文件",
    fileName: "文件名",
    download: "下载文件",
    history: "5. 历史记录",
    saveToHistory: "保存当前排版",
    historyInfo: "请先设置行列数并点击“生成网格”",
    restoreConfirm: "确定要恢复这个历史版本吗？当前未保存的更改将会丢失。",
    deleteConfirm: "确定要删除这条历史记录吗？",
    noHistory: "暂无历史记录",
    exporting: "正在导出...",
    exportSuccess: "导出成功！",
    exportError: "导出失败: ",
    imageUploadError: "图片上传失败，请检查文件格式。",
    pasteSuccess: "图片粘贴成功！",
    saveSuccess: "已成功保存到历史记录！",
    deleteRow: "删除此行",
    deleteColumn: "删除此列",
    dragRow: "拖拽此行",
    dragColumn: "拖拽此列",
    loading: "正在加载核心组件...",
  },
  en: {
    title: "Scientific Figure Collage Tool",
    subtitle: "Intelligent layout, precise control, professional typesetting for your experiment figures.",
    layoutSettings: "1. Layout Settings",
    columns: "Columns",
    rows: "Rows",
    generateGrid: "Generate / Reset Grid",
    styleAndSpacing: "2. Style & Spacing",
    pagePadding: "Page Padding (px)",
    columnGap: "Column Gap (px)",
    rowGap: "Row Gap (px)",
    captionGap: "Caption Gap (px)",
    captionFontSize: "Caption Font Size (px)",
    backgroundColor: "Background Color",
    watermark: "Watermark Text (leave empty for none)",
    watermarkPlaceholder: "e.g., your-website.com",
    editContent: "3. Edit Content",
    uploadPlaceholder: "Click to Upload / Paste / Replace",
    columnCaption: "Column {n} Caption",
    exportFile: "4. Export File",
    fileName: "File Name",
    download: "Download File",
    history: "5. History",
    saveToHistory: "Save Current Layout",
    historyInfo: "Please set rows/columns and click 'Generate Grid' first.",
    restoreConfirm: "Are you sure you want to restore this version? Any unsaved changes will be lost.",
    deleteConfirm: "Are you sure you want to delete this history record?",
    noHistory: "No history records yet.",
    exporting: "Exporting...",
    exportSuccess: "Export successful!",
    exportError: "Export failed: ",
    imageUploadError: "Image upload failed. Please check the file format.",
    pasteSuccess: "Image pasted successfully!",
    saveSuccess: "Successfully saved to history!",
    deleteRow: "Delete this row",
    deleteColumn: "Delete this column",
    dragRow: "Drag to reorder row",
    dragColumn: "Drag to reorder column",
    loading: "Loading essential libraries...",
  },
};

// --- IndexedDB 工具函数 ---
const dbName = 'FigureCollageDB';
const storeName = 'images';

const getDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onerror = () => reject("Error opening DB");
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
  });
};

const dbGet = async (key) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("Error getting data from DB");
  });
};

const dbSet = async (key, value) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value, key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("Error setting data in DB");
  });
};


// --- 状态管理 (Zustand) ---
const useStore = create(
  persist(
    (set, get) => ({
      // --- 核心状态 ---
      lang: 'zh',
      rows: 2,
      cols: 3,
      gridKey: 1, // 用于强制重新渲染网格
      images: {}, // { 'row-col': { id: 'uuid', name: 'file.png' } }
      captions: [],
      styles: {
        pagePadding: 16,
        columnGap: 16,
        rowGap: 16,
        captionGap: 16,
        captionFontSize: 14,
        backgroundColor: '#ffffff',
        watermark: '',
      },
      history: [],
      
      // --- Actions ---
      t: (key, params) => {
        const lang = get().lang;
        let text = locales[lang][key] || key;
        if (params) {
          Object.keys(params).forEach(pKey => {
            text = text.replace(`{${pKey}}`, params[pKey]);
          });
        }
        return text;
      },
      
      setLang: (lang) => set({ lang }),
      
      setStyle: (key, value) => set(window.immer.produce(state => {
        state.styles[key] = value;
      })),
      
      setGridDimensions: (rows, cols) => set({ rows, cols }),
      
      generateGrid: () => set(window.immer.produce(state => {
        state.images = {};
        state.captions = Array(state.cols).fill('');
        state.gridKey = Date.now(); // 强制刷新
      })),
      
      setImage: async (row, col, file) => {
        if (!file) {
          set(window.immer.produce(state => { delete state.images[`${row}-${col}`]; }));
          return;
        }
        const id = crypto.randomUUID();
        await dbSet(id, file);
        set(window.immer.produce(state => {
          state.images[`${row}-${col}`] = { id, name: file.name };
        }));
      },
      
      setCaption: (colIndex, text) => set(window.immer.produce(state => {
        if (colIndex < state.captions.length) {
          state.captions[colIndex] = text;
        }
      })),

      addRow: (rowIndex) => set(window.immer.produce(state => {
        const newRows = state.rows + 1;
        const newImages = {};
        for (let r = 0; r < newRows; r++) {
          for (let c = 0; c < state.cols; c++) {
            let oldRow = r;
            if (r > rowIndex) oldRow = r - 1;
            if (r !== rowIndex && state.images[`${oldRow}-${c}`]) {
              newImages[`${r}-${c}`] = state.images[`${oldRow}-${c}`];
            }
          }
        }
        state.rows = newRows;
        state.images = newImages;
      })),

      deleteRow: (rowIndex) => set(window.immer.produce(state => {
        if (state.rows <= 1) return;
        const newRows = state.rows - 1;
        const newImages = {};
        for (let r = 0; r < newRows; r++) {
          for (let c = 0; c < state.cols; c++) {
            const oldRow = r < rowIndex ? r : r + 1;
            if (state.images[`${oldRow}-${c}`]) {
              newImages[`${r}-${c}`] = state.images[`${oldRow}-${c}`];
            }
          }
        }
        state.rows = newRows;
        state.images = newImages;
      })),

      addColumn: (colIndex) => set(window.immer.produce(state => {
        const newCols = state.cols + 1;
        const newImages = {};
        for (let r = 0; r < state.rows; r++) {
          for (let c = 0; c < newCols; c++) {
             let oldCol = c;
             if (c > colIndex) oldCol = c - 1;
             if (c !== colIndex && state.images[`${r}-${oldCol}`]) {
                newImages[`${r}-${c}`] = state.images[`${r}-${oldCol}`];
             }
          }
        }
        const newCaptions = [...state.captions];
        newCaptions.splice(colIndex, 0, '');
        state.cols = newCols;
        state.images = newImages;
        state.captions = newCaptions;
      })),

      deleteColumn: (colIndex) => set(window.immer.produce(state => {
        if (state.cols <= 1) return;
        const newCols = state.cols - 1;
        const newImages = {};
        for (let r = 0; r < state.rows; r++) {
          for (let c = 0; c < newCols; c++) {
            const oldCol = c < colIndex ? c : c + 1;
            if (state.images[`${r}-${oldCol}`]) {
              newImages[`${r}-${c}`] = state.images[`${r}-${oldCol}`];
            }
          }
        }
        const newCaptions = state.captions.filter((_, i) => i !== colIndex);
        state.cols = newCols;
        state.images = newImages;
        state.captions = newCaptions;
      })),
      
      saveToHistory: () => set(window.immer.produce(state => {
        const currentState = {
          rows: state.rows,
          cols: state.cols,
          images: { ...state.images },
          captions: [...state.captions],
          styles: { ...state.styles },
          timestamp: new Date().toISOString(),
        };
        state.history.unshift(currentState);
        if (state.history.length > 20) { // 最多保存20条
          state.history.pop();
        }
      })),
      
      restoreFromHistory: (timestamp) => set(window.immer.produce(state => {
        const historyEntry = state.history.find(h => h.timestamp === timestamp);
        if (historyEntry) {
          state.rows = historyEntry.rows;
          state.cols = historyEntry.cols;
          state.images = historyEntry.images;
          state.captions = historyEntry.captions;
          state.styles = historyEntry.styles;
          state.gridKey = Date.now();
        }
      })),

      deleteFromHistory: (timestamp) => set(window.immer.produce(state => {
        state.history = state.history.filter(h => h.timestamp !== timestamp);
      })),

    }),
    {
      name: 'figure-collage-storage', // local storage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        lang: state.lang,
        rows: state.rows,
        cols: state.cols,
        images: state.images,
        captions: state.captions,
        styles: state.styles,
        history: state.history,
      }),
    }
  )
);

// --- UI 组件 ---

// 1. 单个图片格子
const GridCell = ({ row, col }) => {
  const t = useStore(state => state.t);
  const imageInfo = useStore(state => state.images[`${row}-${col}`]);
  const setImage = useStore(state => state.setImage);
  const imageUploadError = useMemo(() => t('imageUploadError'), [t]);

  const [imageUrl, setImageUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let objectUrl;
    if (imageInfo && imageInfo.id) {
      dbGet(imageInfo.id).then(file => {
        if (file instanceof File) {
          objectUrl = URL.createObjectURL(file);
          setImageUrl(objectUrl);
        }
      }).catch(err => console.error("Failed to get image from DB:", err));
    } else {
      setImageUrl(null);
    }
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageInfo]);

  const handleFileChange = (files) => {
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setImage(row, col, file);
      } else {
        alert(imageUploadError);
      }
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        setImage(row, col, file);
        e.preventDefault();
        break;
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div 
      className={`relative aspect-w-16 aspect-h-9 bg-slate-700/50 border border-dashed border-slate-500 transition-all duration-200 ${isDragging ? 'border-sky-400 bg-sky-900/50' : ''}`}
      onClick={() => fileInputRef.current.click()}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      tabIndex={0} // Make it focusable for paste
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => handleFileChange(e.target.files)}
      />
      {imageUrl ? (
        <img src={imageUrl} className="w-full h-full object-contain" alt={`Cell ${row}-${col}`} />
      ) : (
        <div className="flex flex-col items-center justify-center text-slate-400 text-center p-2">
          <UploadCloud size={24} className="mb-2" />
          <span className="text-xs">{t('uploadPlaceholder')}</span>
        </div>
      )}
    </div>
  );
};

// 2. 主应用组件
const FigureCollageApp = () => {
  const [dependenciesLoaded, setDependenciesLoaded] = useState(false);
  
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (window.immer && window.htmlToImage && window.jspdf) {
        setDependenciesLoaded(true);
        clearInterval(intervalId);
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, []);

  if (!dependenciesLoaded) {
    return (
      <div className="bg-slate-900 text-white min-h-screen flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>{locales.zh.loading}</p>
        </div>
      </div>
    );
  }

  return <AppContent />;
};

const AppContent = () => {
  const store = useStore();
  const { t, lang, setLang, rows, cols, styles, gridKey, captions, setStyle, setGridDimensions, generateGrid, setCaption, addRow, deleteRow, addColumn, deleteColumn } = store;

  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('png');
  const [fileName, setFileName] = useState('my-research-collage');
  const collageRef = useRef(null);

  useEffect(() => {
    const savedLang = localStorage.getItem('figure-collage-lang');
    if (savedLang) {
      setLang(savedLang);
    } else {
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'zh') {
        setLang('zh');
      } else {
        setLang('en');
      }
    }
  }, [setLang]);

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'zh' : 'en';
    setLang(newLang);
    localStorage.setItem('figure-collage-lang', newLang);
  };

  const handleExport = async () => {
    if (!collageRef.current || isExporting) return;

    setIsExporting(true);
    
    const interactiveElements = collageRef.current.querySelectorAll('.interactive-control');
    interactiveElements.forEach(el => el.style.display = 'none');

    try {
      const { toPng, toJpeg } = window.htmlToImage;
      const { jsPDF } = window.jspdf;

      const options = {
        quality: 1.0,
        pixelRatio: 3,
        backgroundColor: styles.backgroundColor,
      };

      if (exportFormat === 'png') {
        const dataUrl = await toPng(collageRef.current, options);
        saveAs(dataUrl, `${fileName}.png`);
      } else if (exportFormat === 'jpg') {
        const dataUrl = await toJpeg(collageRef.current, options);
        saveAs(dataUrl, `${fileName}.jpg`);
      } else if (exportFormat === 'pdf') {
        const dataUrl = await toPng(collageRef.current, options);
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
          const pdf = new jsPDF({
            orientation: img.width > img.height ? 'l' : 'p',
            unit: 'px',
            format: [img.width, img.height],
          });
          pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
          pdf.save(`${fileName}.pdf`);
        };
      }
      console.log(t('exportSuccess'));
    } catch (error) {
      console.error(t('exportError'), error);
      alert(t('exportError') + error.message);
    } finally {
      setIsExporting(false);
      interactiveElements.forEach(el => el.style.display = '');
    }
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, auto)`,
    gap: `${styles.rowGap}px ${styles.columnGap}px`,
  };

  const canvasStyle = {
    padding: `${styles.pagePadding}px`,
    backgroundColor: styles.backgroundColor,
    position: 'relative',
  };
  
  const captionContainerStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: `0 ${styles.columnGap}px`,
    marginTop: `${styles.captionGap}px`,
  };
  
  const captionStyle = {
    fontSize: `${styles.captionFontSize}px`,
  };

  const watermarkStyle = {
    position: 'absolute',
    bottom: '5px',
    right: '10px',
    color: '#888888',
    opacity: 0.5,
    fontSize: '12px',
    pointerEvents: 'none',
  };

  return (
    <div className="bg-slate-900 text-white min-h-screen font-sans p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm text-slate-400">{t('subtitle')}</p>
          </div>
          <button onClick={toggleLang} className="flex items-center space-x-2 px-3 py-2 bg-slate-800 rounded-md hover:bg-slate-700 transition-colors">
            <Languages size={18} />
            <span>{lang === 'en' ? '中文' : 'English'}</span>
          </button>
        </header>

        <main className="space-y-8">
          {/* 1. 布局设置 */}
          <section className="bg-slate-800 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">{t('layoutSettings')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('columns')}</label>
                <input type="number" min="1" max="20" value={cols} onChange={e => setGridDimensions(rows, parseInt(e.target.value))} className="w-full bg-slate-700 border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('rows')}</label>
                <input type="number" min="1" max="20" value={rows} onChange={e => setGridDimensions(parseInt(e.target.value), cols)} className="w-full bg-slate-700 border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"/>
              </div>
              <div className="md:self-end">
                <button onClick={generateGrid} className="w-full bg-sky-600 hover:bg-sky-700 rounded-md px-4 py-2 font-semibold transition-colors">{t('generateGrid')}</button>
              </div>
            </div>
          </section>

          {/* 2. 样式与安全 */}
          <section className="bg-slate-800 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">{t('styleAndSpacing')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
              {Object.keys(styles).filter(k => k !== 'backgroundColor' && k !== 'watermark').map(key => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{t(key)}</label>
                  <input type="range" min="0" max="100" value={styles[key]} onChange={e => setStyle(key, parseInt(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"/>
                  <span className="text-xs text-slate-400">{styles[key]}px</span>
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('backgroundColor')}</label>
                <input type="color" value={styles.backgroundColor} onChange={e => setStyle('backgroundColor', e.target.value)} className="w-full h-10 p-1 bg-slate-700 border-slate-600 rounded-md cursor-pointer"/>
              </div>
              <div className="col-span-2 md:col-span-1 lg:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('watermark')}</label>
                <input type="text" value={styles.watermark} onChange={e => setStyle('watermark', e.target.value)} placeholder={t('watermarkPlaceholder')} className="w-full bg-slate-700 border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"/>
              </div>
            </div>
          </section>

          {/* 3. 编辑内容 */}
          <section className="bg-slate-800 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">{t('editContent')}</h2>
            <div ref={collageRef} style={canvasStyle} className="overflow-auto">
               <div className="relative">
                {/* Row Controls */}
                <div className="absolute -left-12 top-0 bottom-0 flex flex-col justify-around" style={{gap: `${styles.rowGap}px`}}>
                  {[...Array(rows)].map((_, r) => (
                    <div key={`row-ctrl-${r}`} className="flex flex-col items-center justify-center h-full group interactive-control">
                       <button onClick={() => deleteRow(r)} title={t('deleteRow')} className="text-slate-500 hover:text-red-500 opacity-50 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>

                {/* Column Controls */}
                <div className="absolute -top-12 left-0 right-0 flex justify-around" style={{gap: `${styles.columnGap}px`}}>
                   {[...Array(cols)].map((_, c) => (
                    <div key={`col-ctrl-${c}`} className="flex items-center justify-center w-full group interactive-control">
                      <button onClick={() => deleteColumn(c)} title={t('deleteColumn')} className="text-slate-500 hover:text-red-500 opacity-50 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
                
                {/* Main Grid */}
                <div key={gridKey} style={gridStyle}>
                  {[...Array(rows)].map((_, r) =>
                    [...Array(cols)].map((_, c) => (
                      <GridCell key={`${r}-${c}`} row={r} col={c} />
                    ))
                  )}
                </div>

                {/* Add Row Button */}
                <div className="absolute -bottom-6 left-0 right-0 flex justify-center interactive-control">
                    <button onClick={() => addRow(rows)} className="text-slate-500 hover:text-sky-400">+</button>
                </div>
                 {/* Add Column Button */}
                <div className="absolute -right-6 top-0 bottom-0 flex items-center interactive-control">
                    <button onClick={() => addColumn(cols)} className="text-slate-500 hover:text-sky-400">+</button>
                </div>

              </div>

              {/* Captions */}
              <div style={captionContainerStyle}>
                {[...Array(cols)].map((_, c) => (
                  <input
                    key={`caption-${c}`}
                    type="text"
                    placeholder={t('columnCaption', {n: c + 1})}
                    value={captions[c] || ''}
                    onChange={e => setCaption(c, e.target.value)}
                    style={captionStyle}
                    className="bg-transparent text-center text-slate-300 placeholder-slate-500 focus:outline-none focus:bg-slate-700 rounded-sm"
                  />
                ))}
              </div>
              {styles.watermark && <div style={watermarkStyle}>{styles.watermark}</div>}
            </div>
          </section>

          {/* 4. 导出文件 */}
          <section className="bg-slate-800 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">{t('exportFile')}</h2>
            <div className="flex flex-wrap gap-4">
              <input 
                type="text" 
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                placeholder={t('fileName')}
                className="flex-grow bg-slate-700 border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500 min-w-[200px]"
              />
              <div className="flex items-center bg-slate-700 rounded-md">
                <span className="pl-3 text-slate-400">.</span>
                <select value={exportFormat} onChange={e => setExportFormat(e.target.value)} className="bg-transparent p-2 pr-3 appearance-none focus:outline-none">
                  <option value="png">png</option>
                  <option value="jpg">jpg</option>
                  <option value="pdf">pdf</option>
                </select>
              </div>
              <button onClick={handleExport} disabled={isExporting} className="flex-grow md:flex-grow-0 bg-green-600 hover:bg-green-700 rounded-md px-6 py-2 font-semibold transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center">
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {t('exporting')}
                  </>
                ) : (
                  <>
                    <Download size={18} className="mr-2"/> {t('download')}
                  </>
                )}
              </button>
            </div>
          </section>

          {/* 5. 历史记录 */}
          <HistorySection />

        </main>
      </div>
    </div>
  );
}


const HistorySection = () => {
  const { t, history, saveToHistory, restoreFromHistory, deleteFromHistory } = useStore();

  const handleSave = () => {
    saveToHistory();
    alert(t('saveSuccess'));
  }

  const handleRestore = (timestamp) => {
    if (window.confirm(t('restoreConfirm'))) {
      restoreFromHistory(timestamp);
    }
  }

  const handleDelete = (timestamp) => {
    if (window.confirm(t('deleteConfirm'))) {
      deleteFromHistory(timestamp);
    }
  }

  return (
    <section className="bg-slate-800 p-6 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">{t('history')}</h2>
        <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 rounded-md px-4 py-2 font-semibold transition-colors flex items-center space-x-2">
          <Save size={18}/>
          <span>{t('saveToHistory')}</span>
        </button>
      </div>
      <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
        {history.length === 0 ? (
          <p className="text-slate-400 text-center py-4">{t('noHistory')}</p>
        ) : (
          history.map(h => (
            <div key={h.timestamp} className="bg-slate-700/50 p-3 rounded-md flex justify-between items-center group">
              <div>
                <p className="font-medium">{new Date(h.timestamp).toLocaleString()}</p>
                <p className="text-xs text-slate-400">{`${h.cols}x${h.rows} Grid`}</p>
              </div>
              <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleRestore(h.timestamp)} className="text-sky-400 hover:text-sky-300">{t('restoreConfirm').split('?')[0]}</button>
                <button onClick={() => handleDelete(h.timestamp)} className="text-red-500 hover:text-red-400"><Trash2 size={16}/></button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default FigureCollageApp;
