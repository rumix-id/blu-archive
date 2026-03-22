import { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
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
  UpdateVideoLocation
} from '../wailsjs/go/main/App';
const DEFAULT_DESC = "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.";

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
                    
                    console.log("Cover berhasil diperbarui secara instan!");
                }
            } catch (err) {
                console.error("Gagal update cover:", err);
            }
        };
        
        reader.readAsDataURL(file);
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

const handleSelectScreenshot = () => {
  SelectFolder().then((newPath: string) => {
    if (newPath) {
      setEditForm(prev => ({ ...prev, screenshotPath: newPath }));
    }
  });
};

  useEffect(() => { 
    loadVideos();
    const closeAll = (e: MouseEvent) => { 
      setMenuVisible(false); 
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    window.addEventListener('click', closeAll);
    return () => window.removeEventListener('click', closeAll);
  }, []);

const processedVideos = useMemo(() => {
    let filtered = videos.filter(v => (v.title || "").toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortMode === 'newest') { 
      filtered.sort((a, b) => b.id - a.id); 
    } 
    else if (sortMode === 'artistAsc') { 
      filtered.sort((a, b) => {
        const artistA = (a.artist || "").trim();
        const artistB = (b.artist || "").trim();
        if (artistA === "" && artistB !== "") return 1;  
        if (artistA !== "" && artistB === "") return -1; 
        const compareArtist = artistA.localeCompare(artistB, undefined, { sensitivity: 'base' });
        if (compareArtist === 0) {
          return (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: 'base' });
        }
        return compareArtist;
      }); 
    } 
    else if (sortMode === 'titleAsc') { 
      filtered.sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: 'base' })); 
    }
    
    return filtered;
  }, [videos, searchTerm, sortMode]);

  const handleContextMenu = (e: React.MouseEvent, v: any) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedVideo(v);
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuVisible(true);
  };

const handleSaveEdit = async () => {
  if (!selectedVideo) return;

  try {
    if (editMode === 'rename') {
      await RenameVideo(selectedVideo.id, selectedVideo.videoPath, editForm.title);
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
  } catch (err) {
    console.error("Gagal menyimpan:", err);
  }
};

const handleQuickRename = async () => {
  if (!selectedVideo || !editForm.title) return;

  try {
    await RenameVideo(selectedVideo.id, selectedVideo.videoPath, editForm.title);
    const data = await GetVideos();
    setVideos(data);
    const updated = data.find((v: any) => v.id === selectedVideo.id);
    if (updated) setSelectedVideo(updated);
    setEditMode('none');
  } catch (err) {
    console.error("Gagal Rename:", err);
    alert("Gagal mengganti nama. Pastikan file tidak sedang dibuka program lain.");
  }
};

  const handleDelete = () => {
    DeleteVideo(selectedVideo.id, selectedVideo.videoPath, selectedVideo.coverPath).then(() => {
      setShowDeleteConfirm(false);
      setShowDetail(false);
      loadVideos();
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
            <div className="version-text">BY RUMIX TOOL</div>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-import" onClick={() => ImportVideo().then(loadVideos)}>＋ Import Video</button>
          <div className="settings-wrapper" ref={settingsRef}>
            <button className="btn-icon-menu" onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}>⋮</button>
            {showSettings && (
              <div className="settings-dropdown" onClick={(e) => e.stopPropagation()}>
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
                      <button 
                        onClick={() => setSearchTerm("")}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#888',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Hapus pencarian"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                </div>
                <div className="dropdown-divider"></div>
                <div className="dropdown-section">
                  <label>Appearance</label>
                  <div className="toggle-group">
                    <button className={viewMode === 'comfortable' ? 'active' : ''} onClick={() => setViewMode('comfortable')}>List</button>
                    <button className={viewMode === 'compact' ? 'active' : ''} onClick={() => setViewMode('compact')}>Grid</button>
                  </div>
                </div>
                <div className="dropdown-divider"></div>
                <div className="dropdown-section">
                  <label>Sort By</label>
                  <select className="search-input-dropdown" value={sortMode} onChange={(e) => setSortMode(e.target.value as any)}>
                    <option value="newest">Recently Added</option>
                    <option value="artistAsc">Artists (A-Z)</option>
                    <option value="titleAsc">Name (A-Z)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

<main className="content-area">
        {/* --- TAMBAHKAN LOGIKA PENGECEKAN INI --- */}
        {processedVideos.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%',
            minHeight: '50vh',
            width: '100%',
            color: '#888',
            fontSize: '1.2rem',
            fontWeight: '500'
          }}>
           No data found
          </div>
        ) : (
<div className={`video-grid ${viewMode}`}>
  {processedVideos.map((v) => (
    <div key={v.id} className="video-card" onContextMenu={(e) => handleContextMenu(e, v)}>
      <div className="cover-box" onClick={() => OpenVideo(v.videoPath)}>
        <img src={`${encodeURI(v.coverPath)}?t=${Date.now()}`} alt="" />
        <div className="play-overlay"><div className="play-icon">▶</div></div>
      </div>
      
      {/* Container ini akan otomatis di kanan saat mode comfortable karena CSS flex-row */}
      <div className="video-info-container" onClick={() => { setSelectedVideo(v); setShowDetail(true); }}>
        <h3 className="video-title-card">{v.title}</h3>
        <div className="video-meta-card">
          <span className="video-duration-card">{v.duration || "00:00"}</span>
          <span className="video-artist-card">{v.artist || "Unknown Artist"}</span>
        </div>
      </div>
    </div>
  ))}
</div>
        )}
        {/* --- SAMPAI SINI --- */}
      </main>

{/* MENU KLIK KANAN (MENYESUAIKAN DENGAN CSS MODERN BRIGHT) */}
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
            setEditForm({ ...editForm, title: cleanTitle }); 
            setEditMode('rename'); setMenuVisible(false); 
          }}>
            <span className="menu-item-icon">&#128221;</span> {/* Ikon Pensil */}
            <span className="menu-item-text">Rename</span>
          </div>

          {/* Tombol Edit Artis */}
          <div className="context-menu-item" onClick={() => { 
            setEditForm({ ...editForm, artist: selectedVideo.artist || "" }); 
            setEditMode('artist'); setMenuVisible(false); 
          }}>
            <span className="menu-item-icon">&#129528;</span> {/* Ikon Orang */}
            <span className="menu-item-text">Edit Artis</span>
          </div>
<div className="context-menu-item" onClick={() => { handleUpdateLocation(selectedVideo.id); setMenuVisible(false); }}>
  <span className="menu-item-icon">&#128193;</span> {/* Ikon Folder/File */}
  <span className="menu-item-text">Update Location</span>
</div>
          <div className="context-menu-separator"></div> {/* Garis Pemisah */}

          {/* Tombol Hapus (NAMA CLASS 'delete' SUDAH DICOCOKKAN) */}
          <div className="context-menu-item delete" onClick={() => { setShowDeleteConfirm(true); setMenuVisible(false); }}>
            <span className="menu-item-icon">&#10005;</span> {/* Ikon Silang */}
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
        <div className="detail-overlay" onClick={() => setShowDetail(false)}>
          <div className="detail-container" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close-detail-circle" onClick={() => setShowDetail(false)}>✕</button>
            <div className="detail-content-layout">
              <div className="detail-left-poster">
                <div className="poster-wrapper" onClick={() => OpenVideo(selectedVideo.videoPath)}>
                  {/* Sesuaiakan src-nya menjadi seperti ini */}
<img src={`${encodeURI(selectedVideo.coverPath)}?t=${Date.now()}`} alt="Cover" />
                  <div className="poster-play-overlay">▶</div>
                </div>
              </div>
              <div className="detail-right-info">
                <h1 className="detail-title-large">{selectedVideo.title}</h1>
                <div className="detail-duration-left">{selectedVideo.duration}</div>
                <p className="detail-description-justify">{selectedVideo.description ? selectedVideo.description : DEFAULT_DESC}</p>
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

<button 
    className="btn-screenshot-view"
    disabled={!selectedVideo?.screenshotPath} 
    onClick={() => OpenFolder(selectedVideo.screenshotPath)}
  >
    Screenshot
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
      
      {/* Judul Tetap Ada & Rata Tengah */}
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
      
      {/* Tombol Rata Tengah dengan Jarak yang Pas */}
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
        <div className="modal-overlay edit-z-index" onClick={() => setEditMode('none')}>
          <div className={`modal-content ${editMode === 'full' ? 'edit-large-modal' : 'confirm-modal small-modal'}`} 
               onClick={(e) => e.stopPropagation()}
               style={{ 
                 paddingTop: '20px', 
                 paddingBottom: '20px', 
                 display: 'flex', 
                 flexDirection: 'column', 
                 alignItems: 'center' 
               }}>
            
            {/* JUDUL MODAL - Dipaksa muncul dengan warna hitam dan margin yang pas */}
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

{/* FORM FULL EDIT - SATU BLOK SAJA */}
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
    </div>
  );
}

export default App;