import { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { 
  GetVideos, 
  ImportVideo, 
  ChangeCover, 
  DeleteVideo, 
  OpenVideo, 
  RenameVideo,
  UpdateArtist,
  SelectFolder,
  SaveVideoEdit,
  UpdateCover,
  OpenFolder,
  UpdateVideoLocation,
  GetVideoCount,
  CheckTitleExists,
  AutoScanFolder,
  GetLastPlayedVideos,
  GetFavoriteVideos,  
  ToggleFavorite,   
  MarkAsPlayed,
  ClearPlaybackHistory,
  MoveToEpisodeFolder,
  AutoScanEpisodes
} from '../wailsjs/go/main/App';
const DEFAULT_DESC = "";

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
const [mainViewMode, setMainViewMode] = useState<'all' | 'favorites' | 'lastPlayed'>('all');
const [lastPlayedVideo, setLastPlayedVideo] = useState<any>(null);
  const truncateText = (text: string, limit: number) => {
  if (!text) return "Unknown Artist";
  return text.length > limit ? text.substring(0, limit) + "..." : text;
};
  const scanRef = useRef(false);
  const [toastMessage, setToastMessage] = useState("");
  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = async () => {
            const base64Data = reader.result as string;
            try {
                if (selectedVideo) {
                    await UpdateCover(selectedVideo.id, base64Data, selectedVideo.title);
                    const data = await GetVideos();
                    setVideos(data);
                    if (fileInputRef.current) fileInputRef.current.value = ""; 
                    console.log("Cover berhasil diperbarui secara instan!");
                }
            } catch (err) {
                console.error("Gagal update cover:", err);
            }
        };
        
        reader.readAsDataURL(file);
    }
};
const [isImporting, setIsImporting] = useState(false);
const [activeTab, setActiveTab] = useState<'description' | 'episode'>('description');
const [showEpisodeMenu, setShowEpisodeMenu] = useState(false);
const [updateArtist, setUpdateArtist] = useState("");
const handleOpenCropperWithExistingCover = async () => {
    if (!selectedVideo || !selectedVideo.coverPath) return;

    try {
        const currentCoverUrl = `${encodeURI(selectedVideo.coverPath)}?t=${Date.now()}`;
        const response = await fetch(currentCoverUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            setCropImageSrc(base64data);
            setShowCropper(true);
        };
        reader.readAsDataURL(blob);
    } catch (error) {
        console.error("Gagal memuat cover lama:", error);
    }
};

const [showCropper, setShowCropper] = useState(false);
const [showScreenshotPopup, setShowScreenshotPopup] = useState(false);
const [cropImageSrc, setCropImageSrc] = useState('');
const [crop, setCrop] = useState<Crop>();
const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
const imgRef = useRef<HTMLImageElement>(null);
const aspect = 3 / 4;

function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
  const { width, height } = e.currentTarget;
  setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height), width, height));
}

const handleSaveCrop = async () => {
    if (!completedCrop || !imgRef.current || !selectedVideo) return;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const targetWidth = completedCrop.width * scaleX;
    const targetHeight = completedCrop.height * scaleY;

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    const ctx = canvas.getContext('2d');

    if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
            image,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,  
            targetWidth,               
            targetHeight,              
            0,                        
            0,                        
            targetWidth,              
            targetHeight               
        );
        const croppedBase64 = canvas.toDataURL('image/jpeg', 1.0);
        
        try {
            await UpdateCover(selectedVideo.id, croppedBase64, selectedVideo.title);
            const data = await GetVideos();
            setVideos(data);
            setShowCropper(false); 
        } catch (err) {
            console.error("Gagal simpan crop:", err);
        }
    }
};

const handleUpdateLocation = async (id: number) => {
  try {
    const newDuration = await UpdateVideoLocation(id);
    
    if (newDuration) {
      const freshVideos = await GetVideos();
      setVideos(freshVideos);
      if (selectedVideo && selectedVideo.id === id) {
         const updatedCurrentVideo = freshVideos.find((v: any) => v.id === id);
         if (updatedCurrentVideo) {
             setSelectedVideo(updatedCurrentVideo);
         }
      }
    }
  } catch (err) {
    console.error("Gagal update lokasi:", err);
  }
};
  const [videos, setVideos] = useState<any[]>([]);
  const [totalVideos, setTotalVideos] = useState(0);
  const [showTotal, setShowTotal] = useState(false);

  useEffect(() => {
    const fetchCount = () => {
      GetVideoCount().then((count: number) => setTotalVideos(count));
    };

    fetchCount();

    const interval = setInterval(() => {
      setShowTotal((prev) => !prev);
      fetchCount();
    }, 2000);

    return () => clearInterval(interval);
  }, []);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'comfortable' | 'compact'>('comfortable');
  const [sortMode, setSortMode] = useState<'newest' | 'artistAsc' | 'titleAsc'>('newest');
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  
  const [showDetail, setShowDetail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [editMode, setEditMode] = useState<'none' | 'rename' | 'artist' | 'full'>('none');
  const [editForm, setEditForm] = useState({ title: "", artist: "", releaseYear: "", description: "", screenshotPath: "" });

  const loadVideos = () => {
    GetVideos().then((data) => setVideos(data || [])).catch(() => setVideos([]));
  };

const loadContent = () => {
  if (mainViewMode === 'lastPlayed') {
    GetLastPlayedVideos().then((data: any) => setVideos(data || [])); 
  } else if (mainViewMode === 'favorites') {
    GetFavoriteVideos().then((data: any) => setVideos(data || [])); 
  } else { 
    GetVideos().then((data: any) => setVideos(data || [])); 
  }
};
useEffect(() => { 
  if (!scanRef.current) {
    scanRef.current = true;
    setIsImporting(true);

    Promise.all([
      AutoScanFolder(),
      AutoScanEpisodes()
    ]).then(([newCount, _]) => {
      if (newCount > 0) {
        setToastMessage(`Found ${newCount} new videos & updated episodes`);
        loadContent(); 
      } else {
        loadContent(); 
      }
    }).catch((err) => {
      console.error("Auto scan error:", err);
      loadContent(); 
    }).finally(() => {
      setIsImporting(false); 
    });
  } else {
    loadContent();
  }

  const closeAll = (e: MouseEvent) => { 
    setMenuVisible(false); 
    if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
      setShowSettings(false);
    }
  };
  
  window.addEventListener('click', closeAll);
  return () => window.removeEventListener('click', closeAll);
}, [mainViewMode]);

const processedVideos = useMemo(() => {
  let baseFiltered = videos.filter(v => {
    const matchesSearch = (v.title || "").toLowerCase().includes(searchTerm.toLowerCase());
    if (mainViewMode === 'favorites') {
      return matchesSearch && (v.is_favorite || v.isFavorite);
    }
    if (mainViewMode === 'lastPlayed') {
      return matchesSearch && (v.last_played_at && v.last_played_at !== "");
    }
    return matchesSearch;
  });

  const episodesMap: Record<string, any[]> = {};
  const galleryItems: any[] = [];
  baseFiltered.forEach(v => {
    const isGroupHead = v.is_group === 1;
    const isInsideEpisodeFolder = v.videoPath.includes("Episode\\") || v.videoPath.includes("Episode/");
    if (mainViewMode === 'lastPlayed') {
      galleryItems.push(v);
      return;
    }

    if (isGroupHead) {
      galleryItems.push({ ...v, episodes: [] });
    } else if (isInsideEpisodeFolder) {
      const pathParts = v.videoPath.split(/[\\/]/);
      const episodeIdx = pathParts.indexOf("Episode");
      const folderName = pathParts[episodeIdx + 1];

      if (folderName) {
        if (!episodesMap[folderName]) episodesMap[folderName] = [];
        episodesMap[folderName].push(v);
      }
    } else {
      galleryItems.push(v);
    }
  });
  let finalDisplay = galleryItems.map(item => {
    if (item.is_group === 1 && mainViewMode !== 'lastPlayed') {
      const myEpisodes = episodesMap[item.title] || [];
      myEpisodes.sort((a, b) => 
        (a.title || "").localeCompare((b.title || ""), undefined, { numeric: true, sensitivity: 'base' })
      );
      const totalSeconds = myEpisodes.reduce((acc, ep) => {
        const parts = (ep.duration || "00:00:00").split(':').map(Number);
        const s = parts.length === 3 
          ? (parts[0] * 3600) + (parts[1] * 60) + parts[2]
          : (parts[0] * 60) + (parts[1] || 0);
        return acc + s;
      }, 0);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      
      const totalFormatted = [
        h.toString().padStart(2, '0'),
        m.toString().padStart(2, '0'),
        s.toString().padStart(2, '0')
      ].join(':');

      return {
        ...item,
        episodes: myEpisodes,
        duration: totalFormatted,
        coverPath: item.coverPath || (myEpisodes[0]?.coverPath || "")
      };
    }
    return item;
  });
  if (mainViewMode === 'lastPlayed') {
    finalDisplay.sort((a, b) => 
      new Date(b.last_played_at || 0).getTime() - new Date(a.last_played_at || 0).getTime()
    );
  } else if (sortMode === 'newest') {
    finalDisplay.sort((a, b) => b.id - a.id);
  } else if (sortMode === 'artistAsc') {
    finalDisplay.sort((a, b) => (a.artist || "").trim().localeCompare((b.artist || "").trim()));
  } else if (sortMode === 'titleAsc') {
    finalDisplay.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }

  return finalDisplay;
}, [videos, searchTerm, sortMode, mainViewMode]);

  const handleContextMenu = (e: React.MouseEvent, v: any) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedVideo(v);
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuVisible(true);
  };

const [showFailed, setShowFailed] = useState(false);
const handleSaveEdit = async () => {
  if (!selectedVideo) return;

  try {
    const isDuplicate = await CheckTitleExists(editForm.title, selectedVideo.id);
    if (isDuplicate) {
      setShowFailed(true);
      return; 
    }

    if (editMode === 'rename') {
      await RenameVideo(
        selectedVideo.id, 
        selectedVideo.videoPath, 
        editForm.title, 
        editForm.artist
      );
    } else {
      await SaveVideoEdit(
        selectedVideo.id,
        editForm.title,
        editForm.artist,
        editForm.releaseYear,
        editForm.description,
        editForm.screenshotPath
      );
    }
    const updatedVideos = await GetVideos();
    setVideos(updatedVideos);
    const newlyUpdated = updatedVideos.find((v: any) => v.id === selectedVideo.id);
    if (newlyUpdated) {
      setSelectedVideo(newlyUpdated);
    }
    setEditMode('none');
    setToastMessage("Berhasil diperbarui!"); 
    setTimeout(() => {
      setToastMessage("");
    }, 3000);

  } catch (err) {
    console.error("Gagal menyimpan:", err);
  }
};

const handleQuickRename = async () => {
  if (!selectedVideo || !editForm.title) return;

  const newTitle = editForm.title;

  try {
    const isDuplicate = await CheckTitleExists(newTitle, selectedVideo.id);
    if (isDuplicate) {
      alert(`Gagal! Nama "${newTitle}" sudah ada di koleksi.`);
      return;
    }
    setVideos((prevVideos: any[]) =>
      prevVideos.map((v) => 
        v.id === selectedVideo.id ? { ...v, title: newTitle } : v
      )
    );
    setSelectedVideo((prev: any) => (prev ? { ...prev, title: newTitle } : null));
    setEditMode('none');
    await RenameVideo(
      selectedVideo.id, 
      selectedVideo.videoPath, 
      newTitle, 
      selectedVideo.artist
    );

    loadContent();

  } catch (err) {
    console.error("Gagal Rename:", err);
    loadContent();
    alert("Gagal mengganti nama. Pastikan file tidak sedang dibuka program lain.");
  }
};
const handleDelete = () => {
  if (!selectedVideo) return;
  DeleteVideo(selectedVideo.id, selectedVideo.videoPath, selectedVideo.coverPath)
    .then(() => {
      setShowDeleteConfirm(false);
      setShowDetail(false);
      loadContent(); 
      setToastMessage("Folder dan file berhasil dihapus selamanya");
      setTimeout(() => setToastMessage(""), 3000);
    })
    .catch((err) => {
      console.error("Gagal menghapus:", err);
    });
};


  return (
<div className="app-container" onContextMenu={(e) => e.preventDefault()}>
  <header className="main-header">
    <div className="header-left">
      <div className="header-titles">
        <h1 className="title">
          <span className="blue-part">BLU.</span> ARCHIVE
        </h1>
        <div className="version-text-container">
          <div className={`version-text ${showTotal ? 'fade-out' : 'fade-in'}`}>
            {!showTotal ? (
              "BY RUMIX TOOLS"
            ) : (
              <>
                TOTAL DATA: <span className="blue-text-highlight">{totalVideos} VIDEOS</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
<div className="header-right">
  {/* SPLIT BUTTON DENGAN + DI KIRI */}
  <div className="btn-split-import">
    
{/* BAGIAN KIRI: TOMBOL + DAN DROPDOWN */}
    <div className="plus-dropdown-wrapper">
      <button 
        className="btn-plus-action" 
        onClick={(e) => {
          e.stopPropagation();
          setShowEpisodeMenu(!showEpisodeMenu);
        }}
      >
        ＋
      </button>

      {showEpisodeMenu && (
        <div className="dropdown-episode-menu">
          <button 
            className="dropdown-item" 
            onClick={() => {
              setShowEpisodeMenu(false); 
              setIsImporting(true);

              MoveToEpisodeFolder()
                .then(() => {
                  setToastMessage("Folder berhasil dipindahkan ke Episode!");
                  loadContent();
                  setTimeout(() => setToastMessage(""), 3000);
                })
                .catch(err => {
                  console.error(err);
                })
                .finally(() => {
                  setIsImporting(false);
                });
            }}
          >
            📁 Import Movie Season
          </button>
        </div>
      )}
    </div>

    <div className="split-divider"></div>

    {/* BAGIAN KANAN: IMPORT VIDEO BIASA */}
<button 
      className="btn-main-action" 
      onClick={() => {
        setIsImporting(true);
        ImportVideo()
          .then(loadContent)
          .finally(() => {
            setIsImporting(false);
          });
      }}
    >
      Import Video
    </button>
  </div>
      
      <div className="settings-wrapper" ref={settingsRef}>
        <button className="btn-icon-menu" onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}>⋮</button>
        
        {showSettings && (
          <div className="settings-dropdown" onClick={(e) => e.stopPropagation()}>
            
            {/* SECTION 1: SEARCH */}
            <div className="dropdown-section">
              <label>Search Videos</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <input 
                  type="text" 
                  className="search-input-dropdown" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  placeholder="Type title or artist..." 
                  style={{ paddingRight: '30px', width: '100%', boxSizing: 'border-box' }}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#888' }}>✕</button>
                )}
              </div>
            </div>

            <div className="dropdown-divider"></div>
            
            {/* SECTION 2: APPEARANCE (GABUNGAN 4 TOMBOL) */}
            <div className="dropdown-section">
              <label>Appearance</label>
              <div className="toggle-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button 
                  className={mainViewMode === 'all' && viewMode === 'comfortable' ? 'active' : ''} 
                  onClick={() => { setMainViewMode('all'); setViewMode('comfortable'); }}
                >
                  Default
                </button>
                <button 
                  className={mainViewMode === 'all' && viewMode === 'compact' ? 'active' : ''} 
                  onClick={() => { setMainViewMode('all'); setViewMode('compact'); }}
                >
                  Long Box
                </button>
                <button 
                  className={mainViewMode === 'lastPlayed' ? 'active' : ''} 
                  onClick={() => setMainViewMode('lastPlayed')}
                >
                  Last Played
                </button>
                <button 
                  className={mainViewMode === 'favorites' ? 'active' : ''} 
                  onClick={() => {
                    setMainViewMode('favorites');
                    setViewMode('comfortable');
                  }}
                >
                  Favorites
                </button>
              </div>
            </div>

            <div className="dropdown-divider"></div>

            {/* SECTION 3: SORT BY */}
            <div className="dropdown-section">
              <label>Sort By</label>
              <select className="search-input-dropdown" value={sortMode} onChange={(e) => setSortMode(e.target.value as any)}>
                <option value="newest">Recently Added</option>
                <option value="artistAsc">Artists (A-Z)</option>
                <option value="titleAsc">Title Name (A-Z)</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  </header>


<main className="content-area">
  {processedVideos.length === 0 ? (
<div className="empty-state-center">
  <div style={{ fontSize: '3rem', marginBottom: '15px' }}>
    {mainViewMode === 'favorites' ? '⭐' : '🎬'}
  </div>
  {mainViewMode === 'favorites' ? 'No favorite videos found.' : 
   mainViewMode === 'lastPlayed' ? 'No viewing history.' : 
   'No data found'}
</div>
  ) : (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* --- MODE LAST PLAYED --- */}
      {mainViewMode === 'lastPlayed' ? (
        <>
          <div className="history-table-container">
            <table className="history-table">
              <tbody>
                {processedVideos.map((v) => (
                  <tr key={v.id} onClick={() => { OpenVideo(v.videoPath); MarkAsPlayed(v.id); }}>
                    <td className="cover-column-table">
                      <img src={`${encodeURI(v.coverPath)}?t=${Date.now()}`} alt="" className="lp-table-thumb" />
                    </td>
                    <td className="title-column-table" style={{ fontWeight: '600' }}>{v.title}</td>
                    <td className="artist-column">{v.artist || "-"}</td>
                    <td className="duration-column-table">{v.duration || "00:00"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button 
            className="fab-clear-history" 
            title="Hapus Seluruh Riwayat Tontonan"
            onClick={() => setShowConfirmClear(true)} 
          >
            🗑️
          </button>
        </>
      ) : (
        /* --- MODE ALL / FAVORITES --- */
        <div className={`video-grid ${viewMode}`}>
          {processedVideos.map((v) => (
            <div key={v.id} className="video-card" onContextMenu={(e) => handleContextMenu(e, v)}>
              <div className="cover-box" onClick={() => { OpenVideo(v.videoPath); MarkAsPlayed(v.id); }}>
                <img src={`${encodeURI(v.coverPath)}?t=${Date.now()}`} alt="" />
                <div className="play-overlay"><div className="play-icon">▶</div></div>
              </div>
              <div className="video-info-container" onClick={() => { setSelectedVideo(v); setShowDetail(true); }}>
                <h3 className="video-title-card">{v.title}</h3>
                <div className="video-meta-card">
                  <span className="video-duration-card">{v.duration || "00:00"}</span>
                  <span className="artist-text">{v.artist || "Unknown Artist"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )}
  {/* 1. MODAL KONFIRMASI HAPUS RIWAYAT */}
{showConfirmClear && (
  <div className="modal-overlay">
    <div className="custom-modal-card">
      <h2 className="modal-title">Clear History?</h2>
      <p className="modal-description">
        Are you sure you want to clear all playback history? 
        This action cannot be undone.
      </p>
      <div className="modal-actions">
        <button 
          className="btn-modal-confirm" 
          onClick={async () => {
            setShowConfirmClear(false);
            setVideos([]); 
            try {
              await ClearPlaybackHistory();
              loadContent();
              setToastMessage("Riwayat berhasil dibersihkan.");
              setTimeout(() => setToastMessage(""), 3000);
            } catch (err) {
              console.error(err);
              loadContent();
            }
          }}
        >
          Clear
        </button>
        <button className="btn-modal-cancel" onClick={() => setShowConfirmClear(false)}>
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

  {/* 2. TOAST NOTIFICATION */}
  {toastMessage && (
    <div className="simple-toast">
      <span className="toast-icon">✓</span>
      {toastMessage}
    </div>
  )}
</main>

{/* MENU KLIK KANAN */}
{menuVisible && selectedVideo && (
  <div
    className="custom-context-menu"  
    style={{
      top: `${menuPos.y}px`,
      left: `${menuPos.x}px`,
    }}
    onClick={(e) => e.stopPropagation()}
  >

    {/* Tombol Ganti Cover */}
    <div className="context-menu-item" onClick={() => { 
        fileInputRef.current?.click(); 
        setMenuVisible(false); 
    }}>
      <span className="menu-item-icon">&#128247;</span>
      <span className="menu-item-text">Change Cover</span>
    </div>

    {/* Tombol Rename */}
    <div className="context-menu-item" onClick={() => { 
      const cleanTitle = selectedVideo.title.replace(/\.[^/.]+$/, "");
      setEditForm({
        title: cleanTitle,
        artist: selectedVideo.artist || "",
        releaseYear: selectedVideo.release_year || "",
        description: selectedVideo.description || "",
        screenshotPath: selectedVideo.screenshot_path || ""
      }); 
      setEditMode('rename'); 
      setMenuVisible(false); 
    }}>
      <span className="menu-item-icon">&#128221;</span>
      <span className="menu-item-text">Rename</span>
    </div>

    {/* Tombol Edit Artis */}
    <div className="context-menu-item" onClick={() => { 
      setEditForm({
        title: selectedVideo.title,
        artist: selectedVideo.artist || "",
        releaseYear: selectedVideo.release_year || "",
        description: selectedVideo.description || "",
        screenshotPath: selectedVideo.screenshot_path || ""
      }); 
      setEditMode('artist'); 
      setMenuVisible(false); 
    }}>
      <span className="menu-item-icon">&#129528;</span>
      <span className="menu-item-text">Edit Artis</span>
    </div>

    <div className="context-menu-item" onClick={() => { handleUpdateLocation(selectedVideo.id); setMenuVisible(false); }}>
      <span className="menu-item-icon">&#128193;</span>
      <span className="menu-item-text">Update Location</span>
    </div>
    
    <div className="context-menu-separator"></div>

    {/* Tombol Hapus */}
    <div className="context-menu-item delete" onClick={() => { setShowDeleteConfirm(true); setMenuVisible(false); }}>
      <span className="menu-item-icon">&#10005;</span>
      <span className="menu-item-text">Delete</span>
    </div>
  </div>
)}
{/* 1. Input File Tersembunyi */}
<input 
  type="file" 
  ref={fileInputRef} 
  style={{ display: 'none' }} 
  accept="image/*" 
  onChange={onSelectFile} 
/>

{/* POP-UP DETAIL VIEW */}
{showDetail && selectedVideo && editMode === 'none' && (
  <div className="detail-overlay" onClick={() => { setShowDetail(false); setActiveTab('description'); }}>
    <div className="detail-container" onClick={(e) => e.stopPropagation()}>
      <button className="btn-close-detail-circle" onClick={() => { setShowDetail(false); setActiveTab('description'); }}>✕</button>
      
      <div className="detail-content-layout">
        <div className="detail-left-poster">
          <div 
            className="poster-wrapper" 
            onClick={() => {
              OpenVideo(selectedVideo.videoPath);
              MarkAsPlayed(selectedVideo.id).then(loadContent);
            }}
          >
            <img src={`${encodeURI(selectedVideo.coverPath)}?t=${Date.now()}`} alt="Cover" />
            <div className="poster-play-overlay">▶</div>
          </div>
        </div>

        <div className="detail-right-info">
          {/* Judul: Jika grup, pakai nama folder/title grup */}
          <h1 className="detail-title-large">{selectedVideo.title}</h1>
          <div className="detail-duration-left">{selectedVideo.duration}</div>

          {/* =========================================================
              SISTEM TAB (Description & Episode)
              ========================================================= */}
          <div className="detail-tabs-container">
            <button 
              className={`tab-item ${activeTab === 'description' ? 'active' : ''}`}
              onClick={() => setActiveTab('description')}
            >
              Synopsis
            </button>
            
            {/* Tombol Episode hanya muncul jika video ini adalah sebuah grup/folder Episode */}
            {(selectedVideo.isGroup || selectedVideo.episodes?.length > 0) && (
              <button 
                className={`tab-item ${activeTab === 'episode' ? 'active' : ''}`}
                onClick={() => setActiveTab('episode')}
              >
                Episodes ({selectedVideo.episodes?.length || 0})
              </button>
            )}
          </div>

          <div className="tab-content-area">
            {activeTab === 'description' ? (
              /* TAB DESCRIPTION */
              <p className="detail-description-justify">
                {selectedVideo.description ? selectedVideo.description : DEFAULT_DESC}
              </p>
            ) : (
              /* TAB EPISODE */
              <div className="episode-list-wrapper">
                {selectedVideo.episodes?.map((ep: any, idx: number) => (
                  <div key={ep.id} className="episode-row" onClick={() => {
                    OpenVideo(ep.videoPath);
                    MarkAsPlayed(ep.id).then(loadContent);
                  }}>
                    <span className="ep-index">{idx + 1}</span>
                    <span className="ep-name">{ep.title}</span>
                    <span className="ep-time">{ep.duration}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="info-item-artist">Artist : {selectedVideo.artist || "-"}</div>
          <div className="info-item-year">Release year : {selectedVideo.releaseYear || "-"}</div>
          
          <div className="detail-action-buttons">
            <button className="btn-edit-large" onClick={() => {
              setEditForm({
                title: selectedVideo.title,
                artist: selectedVideo.artist || "",
                releaseYear: selectedVideo.releaseYear || "",
                description: selectedVideo.description || "",
                screenshotPath: selectedVideo.screenshotPath || "",
              });
              setEditMode('full');
            }}>
              Edit Data
            </button>

            <button className="btn-resize-view" onClick={handleOpenCropperWithExistingCover}>
              Resize Cover
            </button>

            <button 
              className="btn-screenshot-view"
              disabled={!selectedVideo?.screenshotPath || selectedVideo.screenshotPath.trim() === ""} 
              style={{ 
                  opacity: (!selectedVideo?.screenshotPath || selectedVideo.screenshotPath.trim() === "") ? 0.5 : 1, 
                  cursor: (!selectedVideo?.screenshotPath || selectedVideo.screenshotPath.trim() === "") ? 'not-allowed' : 'pointer' 
              }}
              onClick={() => setShowScreenshotPopup(true)}
            >
              Screenshot
            </button>

            <button 
              className={`btn-favorite-toggle ${(selectedVideo?.is_favorite || selectedVideo?.isFavorite) ? 'fav-active' : ''}`}
              onClick={async () => {
                  if (selectedVideo) {
                      try {
                          await ToggleFavorite(selectedVideo.id);
                          setSelectedVideo((prev: any) => {
                              if (!prev) return null;
                              const currentFav = prev.is_favorite || prev.isFavorite || false;
                              return { ...prev, is_favorite: !currentFav, isFavorite: !currentFav };
                          });
                          loadContent(); 
                          setToastMessage(!selectedVideo.is_favorite ? "Added to Favorites" : "Removed from Favorites");
                          setTimeout(() => setToastMessage(""), 3000);
                      } catch (err) {
                          console.error("Gagal toggle favorite:", err);
                      }
                  }
              }}
            >
              {(selectedVideo?.is_favorite || selectedVideo?.isFavorite) ? '⭐ Favorited' : '☆ Add Favorite'}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
{/* MODAL KONFIRMASI HAPUS */}
{showDeleteConfirm && (
  <div className="modal-overlay edit-z-index" onClick={() => setShowDeleteConfirm(false)}>
    <div className="modal-content confirm-modal small-modal" 
         onClick={(e) => e.stopPropagation()}
         style={{ padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Judul */}
      <h2 style={{ 
        textAlign: 'center', 
        marginBottom: '15px', 
        border: 'none', 
        display: 'block',
        color: '#1a1a1a' 
      }}>
        Delete Video?
      </h2>

      {/* Teks Peringatan */}
      <p style={{ textAlign: 'center', marginBottom: '25px', color: '#444' }}>
        Are you sure you want to delete this? Deleted files cannot be recovered. <strong>{selectedVideo?.title}</strong>?
      </p>
      
      {/* Tombol Rata Tengah  */}
      <div className="modal-actions" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '15px', 
        width: '100%',
        marginTop: '5px' 
      }}>
        <button 
          className="btn-save" 
          style={{ backgroundColor: '#dc3545', minWidth: '100px' }} 
          onClick={handleDelete}
        >
          Delete
        </button>
        <button 
          className="btn-cancel" 
          style={{ minWidth: '100px' }} 
          onClick={() => setShowDeleteConfirm(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

{/* MODAL MULTI-FUNGSI */}
{editMode !== 'none' && (
  <div className="modal-overlay edit-z-index">
    <div className={`modal-content ${editMode === 'full' ? 'edit-large-modal' : 'confirm-modal small-modal'}`} 
         onClick={(e) => e.stopPropagation()}
         style={{ 
           paddingTop: '20px', 
           paddingBottom: '20px', 
           display: 'flex', 
           flexDirection: 'column', 
           alignItems: 'center' 
         }}>        
            {/* JUDUL MODAL */}
            <h2 style={{ 
              display: 'block',
              width: '100%',
              color: '#1a1a1a', 
              fontSize: '1.25rem',
              fontWeight: 'bold',
              textAlign: 'center',
              margin: '0 0 20px 0',
              padding: '0',
              border: 'none'
            }}>
              {editMode === 'rename' ? 'Rename Video' : editMode === 'artist' ? 'Edit Artist' : 'Edit Video Information'}
            </h2>


{/* FORM RENAME */}
{editMode === 'rename' && (
  <div style={{ width: '100%', marginBottom: '15px' }}>
    <label style={{ 
      display: 'block', 
      textAlign: 'left', 
      marginBottom: '8px', 
      fontSize: '0.9rem', 
      color: '#666' 
    }}>
      New Title
    </label>
    <input 
      autoFocus
      placeholder="Enter new title..."
      style={{ 
        textAlign: 'left', 
        width: '100%', 
        padding: '12px',
        fontSize: '1rem',
        borderRadius: '8px',
        border: '1px solid #ddd',
        background: '#fff',
        color: '#000',
        boxSizing: 'border-box'
      }} 
      value={editForm.title} 
      onChange={e => setEditForm({...editForm, title: e.target.value})} 
      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
    />
  </div>
)}

            {/* FORM ARTIS */}
            {editMode === 'artist' && (
              <div style={{ width: '90%', marginBottom: '10px' }}>
                <input 
                  autoFocus
                  placeholder="Enter artist name..."
                  style={{ 
                    textAlign: 'center', 
                    width: '100%', 
                    padding: '12px',
                    fontSize: '1rem',
                    borderRadius: '8px',
                    border: '1px solid #ccc',
                    background: '#fff',
                    color: '#000'
                  }} 
                  value={editForm.artist} 
                  onChange={e => setEditForm({...editForm, artist: e.target.value})} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                />
              </div>
            )}

{/* FORM FULL EDIT */}
{editMode === 'full' && (
  <div className="edit-form-grid" style={{ width: '100%' }}>
    {/* Baris Judul & Tahun */}
    <div className="input-group">
      <label>Title</label>
      <input 
        value={editForm.title} 
        onChange={e => setEditForm({...editForm, title: e.target.value})} 
      />
    </div>
    <div className="input-group">
      <label>Release Year</label>
      <input 
        value={editForm.releaseYear} 
        onChange={e => setEditForm({...editForm, releaseYear: e.target.value})} 
      />
    </div>

    {/* Baris Artis */}
    <div className="input-group full-width">
      <label>Artist</label>
      <input 
        value={editForm.artist} 
        onChange={e => setEditForm({...editForm, artist: e.target.value})} 
      />
    </div>

    {/* Baris Deskripsi (Hanya Muncul Sekali) */}
    <div className="input-group full-width">
      <label>Description</label>
      <textarea 
        rows={5} 
        value={editForm.description} 
        onChange={e => setEditForm({...editForm, description: e.target.value})} 
      />
    </div>
    
{/* BAGIAN SCREENSHOT (Hanya muncul di editMode === 'full') */}
<div className="input-group full-width" style={{ width: '100%', marginBottom: '15px' }}>
  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Screenshot</label>
  
  <div style={{ 
    display: 'flex', 
    gap: '10px', 
    alignItems: 'center',
    width: '100%' 
  }}>
    <input 
      readOnly 
      placeholder="No images yet..."
      value={editForm.screenshotPath ? editForm.screenshotPath.split(/[\\/]/).pop() : ""} 
      style={{ 
        flex: 1,           
        minWidth: '0',     
        backgroundColor: '#f9f9f9', 
        padding: '12px',   
        border: '1px solid #ddd', 
        borderRadius: '8px',
        color: '#333',
        fontSize: '0.9rem'
      }}
    />
    <button 
      type="button"
      className="btn-browse-file"
      style={{ 
        padding: '12px 20px', 
        cursor: 'pointer',
        backgroundColor: '#f0f2f5',
        border: '1px solid #dddfe2',
        borderRadius: '8px',
        fontWeight: '600',
        whiteSpace: 'nowrap',
        transition: 'background 0.2s'
      }}
      onClick={() => {
        SelectFolder().then((path: string) => {
          if (path) {
            setEditForm(prev => ({ ...prev, screenshotPath: path }));
          }
        });
      }}
    >
     Search Images
    </button>
      </div>
    </div>
  </div>
)}

            {/* TOMBOL AKSI */}
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              marginTop: '20px', 
              justifyContent: 'center',
              width: '100%' 
            }}>
              <button className="btn-save" onClick={handleSaveEdit}>Save Changes</button>
              <button className="btn-cancel" onClick={() => setEditMode('none')}>Cancel</button>
            </div>
          </div>
        </div>
      )}

{/* =========================================================
         KODE MODAL CROPPER
          ========================================================= */}
      {showCropper && cropImageSrc && (
        <div className="modal-overlay edit-z-index" onClick={() => setShowCropper(false)}>
          <div className="modal-content edit-large-modal" 
               onClick={(e) => e.stopPropagation()}
               style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            <h2 style={{ display: 'block', width: '100%', color: '#1a1a1a', textAlign: 'center', margin: '0 0 15px 0', border: 'none', fontSize: '1.25rem' }}>
              Resize & Crop Cover (3:4)
            </h2>

            <div className="cropper-wrapper" style={{ width: '100%', maxHeight: '60vh', overflow: 'auto', background: '#f0f0f0', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', justifyContent: 'center' }}>
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspect}
              >
                <img 
                  ref={imgRef}
                  src={cropImageSrc} 
                  alt="Source" 
                  onLoad={onImageLoad}
                  style={{ maxWidth: '100%', maxHeight: '60vh' }} 
                />
              </ReactCrop>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'center', gap: '15px', width: '100%', marginTop: '20px' }}>
              <button className="btn-save" onClick={handleSaveCrop}>Simpan Cover</button>
              <button className="btn-cancel" onClick={() => setShowCropper(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================= */}

{/* =========================================================
          MODAL VIEWER SCREENSHOT
          ========================================================= */}
      {showScreenshotPopup && selectedVideo?.screenshotPath && (
        <div className="modal-overlay edit-z-index" onClick={() => setShowScreenshotPopup(false)}>
          <div 
            style={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            onClick={(e) => e.stopPropagation()} 
          >
            {/* Tombol Silang Merah di Pojok Gambar */}
            <button 
              className="btn-close-detail-circle"
              style={{ position: 'absolute', top: '-15px', right: '-15px', zIndex: 10 }}
              onClick={() => setShowScreenshotPopup(false)}
            >
              ✕
            </button>
            
            {/* Gambar Screenshot */}
            <img 
              src={`${encodeURI(selectedVideo.screenshotPath)}?t=${Date.now()}`} 
              alt="Screenshot" 
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                borderRadius: '8px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
                objectFit: 'contain',
                backgroundColor: '#1a1a1a'
              }} 
            />
          </div>
        </div>
      )}
      {showFailed && (
  <div className="failed-overlay-center">
    <div className="failed-card">
      <div className="failed-header">Failed to Change Name</div>
      <div className="failed-body">
        <span className="error-icon">✕</span>
        <p>Title "{editForm.title}" already exists in your collection.</p>
      </div>
      <button className="btn-failed-close" onClick={() => setShowFailed(false)}>
        OK
      </button>
    </div>
  </div>
)}

{/* ---  KODE SPINNER --- */}
      {isImporting && (
        <div className="loading-overlay">
          <div className="spinner-container">
            <div className="spinner"></div>
            <p>New video found...</p>
            <span>Please wait, do not close the application</span>
          </div>
        </div>
      )}
      {/* --------------------------------------- */}
    </div>
  );
}

export default App;