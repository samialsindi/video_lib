
import React, { useState, useRef, useEffect } from 'react';
import { StatusFilter, SortCriteria, SortDirection, StatusFilterMap } from '../types';
import { FolderUpIcon, SearchIcon, XCircleIcon, DiceIcon, FilterOffIcon, RefreshCwIcon, ChevronDownIcon, CheckIcon, SettingsIcon, HeartIcon, UndoIcon, RedoIcon, ArrowDownIcon, ArrowUpIcon, XIcon, MinusIcon, ClipboardCopyIcon, TvIcon, ThumbsUpIcon, TrashIcon, TagIcon as TagFilterIcon, ZoomInIcon, ZoomOutIcon, EyeOffIcon, PencilIcon, PlayIcon as PlaylistIcon, EditIcon, TerminalIcon } from './icons/ActionIcons';
import { SettingsMenu } from './SettingsMenu';
import { HeaderPagination } from './HeaderPagination';

interface HeaderProps {
  onSelectClick: () => void;
  onRandomClick: () => void;
  onResetFilters: () => void;
  isFilterActive: boolean;
  activeStatusFilters: StatusFilterMap;
  onStatusFilterToggle: (filter: StatusFilter) => void;
  onClearStatusFilters: () => void;
  videoCount: number;
  filteredVideoCount: number;
  hasVideos: boolean;
  allTags: string[];
  selectedTags: string[];
  onSetSelectedTags: (tags: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLowMemoryMode: boolean;
  onToggleLowMemoryMode: (enabled: boolean) => void;
  sortCriteria: SortCriteria;
  onSortCriteriaChange: (criteria: SortCriteria) => void;
  sortDirection: SortDirection;
  onSortDirectionToggle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  gridSize: number;
  onGridSizeChange: (size: number) => void;
  isBatchEditMode: boolean;
  onBatchEditModeChange: (enabled: boolean) => void;
  // Playlist props
  playlistCount: number;
  onViewPlayer: () => void;
  onExportPlaylist: () => void;
  onImportPlaylist: () => void;
  onClearPlaylist: () => void;
  // Settings Menu actions
  onRefreshLibrary: () => Promise<void>;
  onExportDB: () => Promise<void>;
  onExportSelected: () => void;
  onScanDurations: () => Promise<void>;
  onFindDuplicates: () => Promise<void>;
  onFindTranscoded: () => Promise<void>;
  onResetDuplicates: () => Promise<void>;
  onUnheartAllVideos: () => Promise<void>;
  onUnhideAllVideos: () => Promise<void>;
  onResetDatabase: () => Promise<void>;
  // Pagination
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Header: React.FC<HeaderProps> = (props) => {
  const { 
    onSelectClick, onRandomClick, onResetFilters, 
    isFilterActive, activeStatusFilters, onStatusFilterToggle, onClearStatusFilters,
    videoCount, filteredVideoCount, hasVideos, allTags, selectedTags, onSetSelectedTags, 
    searchQuery, onSearchChange, isLowMemoryMode, onToggleLowMemoryMode,
    sortCriteria, onSortCriteriaChange, sortDirection, onSortDirectionToggle,
    onUndo, onRedo, canUndo, canRedo,
    gridSize, onGridSizeChange,
    isBatchEditMode, onBatchEditModeChange,
    playlistCount, onViewPlayer,
    currentPage, totalPages, onPageChange,
  } = props;

  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [stagedTags, setStagedTags] = useState<string[]>(selectedTags);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStagedTags(selectedTags);
  }, [selectedTags]);

  const handleStagedTagToggle = (tag: string) => {
    setStagedTags(currentStagedTags =>
        currentStagedTags.includes(tag)
            ? currentStagedTags.filter(t => t !== tag)
            : [...currentStagedTags, tag]
    );
  };

  const handleClearStagedTags = () => {
    setStagedTags([]);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        if(isTagDropdownOpen) {
          onSetSelectedTags(stagedTags);
          setIsTagDropdownOpen(false);
        }
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTagDropdownOpen, stagedTags, onSetSelectedTags]);

  const FilterCheckbox: React.FC<{ status: StatusFilter; label: string; icon?: React.ReactNode }> = ({ status, label, icon }) => {
    const filterState = activeStatusFilters.get(status);
    const isIconOnly = ['hearted', 'hidden', 'incompatible', 'duplicates', 'deleted', 'watched', 'rated', 'tagged', 'renamed', 'not-found'].includes(status);
    
    const baseClasses = `py-1.5 rounded-md text-xs font-medium transition-all flex items-center group`;
    const iconOnlyClasses = 'p-2';
    const textClasses = 'px-3 gap-2';
    
    let stateClasses = '';
    if (filterState === 'include') {
      stateClasses = 'bg-brand-primary text-white ring-1 ring-brand-primary';
    } else if (filterState === 'exclude') {
      stateClasses = 'bg-red-800 text-white ring-1 ring-red-700';
    } else {
      stateClasses = 'bg-gray-900 hover:bg-gray-700 text-brand-text-secondary';
    }
    
    return (
      <button
        onClick={() => onStatusFilterToggle(status)}
        title={`${label}${filterState ? ` (${filterState})` : ''}`}
        className={`${baseClasses} ${isIconOnly ? iconOnlyClasses : textClasses} ${stateClasses}`}
      >
        {!isIconOnly && (
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
            filterState === 'include' ? 'bg-blue-500 border-blue-400' :
            filterState === 'exclude' ? 'bg-red-600 border-red-500' :
            'border-gray-500 group-hover:border-gray-400'
          }`}>
            {filterState === 'include' && <CheckIcon className="w-3 h-3 text-white" />}
            {filterState === 'exclude' && <MinusIcon className="w-3 h-3 text-white" />}
          </div>
        )}
        {icon}
        {!isIconOnly && label}
      </button>
    );
  };

  const sortOptions: { value: SortCriteria; label: string }[] = [
    { value: 'filename', label: 'Name' },
    { value: 'path', label: 'Path' },
    { value: 'dateAdded', label: 'Date Imported' },
    { value: 'creationTime', label: 'Date Created' },
    { value: 'lastModified', label: 'Date Modified' },
    { value: 'rating', label: 'Rating' },
    { value: 'timesOpened', label: 'Most Played' },
    { value: 'duration', label: 'Duration' },
    { value: 'fileSize', label: 'File Size' },
    { value: 'random', label: 'Random' },
  ];

  const handleGridSizeChange = (direction: 'in' | 'out') => {
    if (direction === 'in') {
      onGridSizeChange(Math.min(4, gridSize + 1));
    } else {
      onGridSizeChange(Math.max(1, gridSize - 1));
    }
  };

  return (
    <header className="bg-brand-surface shadow-md sticky top-0 z-20">
      <div className="container mx-auto flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-wider">
              Video Library <span className="text-brand-text-secondary font-normal text-lg">({filteredVideoCount} / {videoCount})</span>
            </h1>
            <p className="text-xs text-gray-500 -mt-1">Storage: Browser IndexedDB</p>
          </div>
          
          <div className="flex items-center flex-wrap gap-2 md:gap-3">
             <button onClick={onSelectClick} className="flex items-center gap-2 px-3 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover transition-colors font-semibold text-sm">
              <FolderUpIcon />
              Select Folder
            </button>
            <button onClick={onViewPlayer} disabled={playlistCount === 0} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-semibold disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 text-sm">
              <PlaylistIcon />
              Playlist ({playlistCount})
            </button>
            <button onClick={onRandomClick} disabled={!hasVideos || filteredVideoCount === 0} className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-semibold disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 text-sm">
              <DiceIcon />
              Random
            </button>
            <button onClick={onResetFilters} disabled={!isFilterActive} className="flex items-center gap-2 px-3 py-2 bg-red-800 text-white rounded-md hover:bg-red-700 transition-colors font-semibold disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 text-sm">
              <FilterOffIcon />
              Reset Filters
            </button>
            <div className="flex items-center gap-1.5" title="Undo last metadata change">
                <button onClick={onUndo} disabled={!canUndo} className="p-2 rounded-md bg-gray-600 text-white hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50">
                    <UndoIcon />
                </button>
                <button onClick={onRedo} disabled={!canRedo} className="p-2 rounded-md bg-gray-600 text-white hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50">
                    <RedoIcon />
                </button>
            </div>
            {hasVideos && (
              <HeaderPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
              />
            )}
             <div className="flex items-center gap-1.5">
              <button onClick={() => handleGridSizeChange('out')} disabled={gridSize <= 1} className="p-2 rounded-md bg-gray-600 text-white hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50">
                <ZoomOutIcon />
              </button>
              <button onClick={() => handleGridSizeChange('in')} disabled={gridSize >= 4} className="p-2 rounded-md bg-gray-600 text-white hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50">
                <ZoomInIcon />
              </button>
            </div>
            <div className="relative" ref={settingsMenuRef}>
              <button onClick={() => setIsSettingsMenuOpen(p => !p)} disabled={!hasVideos} title="Settings" className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors font-semibold disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 text-sm">
                <SettingsIcon />
              </button>
              {isSettingsMenuOpen && (
                <SettingsMenu
                  onClose={() => setIsSettingsMenuOpen(false)}
                  onRefresh={props.onRefreshLibrary}
                  onExportDB={props.onExportDB}
                  onExportSelected={props.onExportSelected}
                  onScanDurations={props.onScanDurations}
                  onFindDuplicates={props.onFindDuplicates}
                  onFindTranscoded={props.onFindTranscoded}
                  onResetDuplicates={props.onResetDuplicates}
                  onUnheartAllVideos={props.onUnheartAllVideos}
                  onUnhideAllVideos={props.onUnhideAllVideos}
                  onResetDatabase={props.onResetDatabase}
                  displayedVideoCount={props.filteredVideoCount}
                  onExportPlaylist={props.onExportPlaylist}
                  onImportPlaylist={props.onImportPlaylist}
                  onClearPlaylist={props.onClearPlaylist}
                  playlistCount={playlistCount}
                />
              )}
            </div>
          </div>
        </div>

        {hasVideos && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-700/50 pt-3">
            <div className="flex items-center gap-x-6 gap-y-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-brand-text-secondary shrink-0">Status:</span>
                <div className="flex items-center gap-2 bg-gray-800 p-1 rounded-lg flex-wrap">
                  <button
                    onClick={onClearStatusFilters}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeStatusFilters.size === 0
                      ? 'bg-brand-primary text-white' 
                      : 'bg-gray-900 hover:bg-gray-700 text-brand-text-secondary'
                    }`}
                  >
                    All
                  </button>
                  <FilterCheckbox status="hearted" label="Hearted" icon={<HeartIcon className="w-4 h-4 text-red-400" />} />
                  <FilterCheckbox status="watched" label="Watched" icon={<TvIcon className="w-4 h-4 text-cyan-400" />} />
                  <FilterCheckbox status="rated" label="Rated" icon={<ThumbsUpIcon className="w-4 h-4 text-green-400" />} />
                  <FilterCheckbox status="tagged" label="Tagged" icon={<TagFilterIcon className="w-4 h-4 text-purple-400" />} />
                  <FilterCheckbox status="renamed" label="Renamed" icon={<PencilIcon className="w-4 h-4 text-blue-400" />} />
                  <FilterCheckbox status="duplicates" label="Duplicates" icon={<ClipboardCopyIcon className="w-4 h-4 text-yellow-400" />} />
                  <FilterCheckbox status="hidden" label="Hidden" icon={<EyeOffIcon className="w-4 h-4 text-gray-400" />} />
                  <FilterCheckbox status="deleted" label="Deleted" icon={<TrashIcon className="w-4 h-4 text-red-400" />} />
                  <FilterCheckbox status="not-found" label="Not Found" icon={<XIcon className="w-4 h-4 text-orange-400" />} />
                  <FilterCheckbox status="incompatible" label="Incompatible" icon={<TerminalIcon className="w-4 h-4 text-yellow-400" />} />
                </div>
              </div>

              {allTags.length > 0 && (
                <div className="relative" ref={tagDropdownRef}>
                  <button 
                      onClick={() => setIsTagDropdownOpen(prev => !prev)}
                      className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
                  >
                      <span className="font-medium text-sm text-brand-text-secondary">Tags ({selectedTags.length > 0 ? `${selectedTags.length} selected` : 'All'})</span>
                      <ChevronDownIcon className={`w-4 h-4 text-brand-text-secondary transition-transform ${isTagDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isTagDropdownOpen && (
                      <div className="absolute top-full left-0 mt-2 w-72 bg-brand-surface border border-gray-700 rounded-lg shadow-xl z-30">
                          <div className="p-2 flex justify-between items-center border-b border-gray-700">
                              <span className="font-bold text-white px-2">Filter by Tag</span>
                              {stagedTags.length > 0 && (
                                  <button onClick={handleClearStagedTags} className="text-xs text-red-400 hover:text-red-300 font-semibold">
                                      Clear ({stagedTags.length})
                                  </button>
                              )}
                          </div>
                          <div className="max-h-64 overflow-y-auto p-2">
                              <div className="flex flex-col gap-1">
                                  {allTags.map(tag => (
                                      <button
                                          key={tag}
                                          onClick={() => handleStagedTagToggle(tag)}
                                          className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer group ${
                                              stagedTags.includes(tag)
                                              ? 'bg-brand-primary/20 text-white'
                                              : 'hover:bg-gray-700 text-brand-text'
                                          }`}
                                      >
                                          <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                              stagedTags.includes(tag)
                                              ? 'bg-brand-primary border-brand-primary-hover'
                                              : 'border-gray-500 group-hover:border-gray-400'
                                          }`}>
                                              {stagedTags.includes(tag) && <CheckIcon className="w-3 h-3 text-white" />}
                                          </div>
                                          <span className="flex-grow">{tag}</span>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-stretch justify-end gap-4">
              <div className="relative flex items-center flex-grow max-w-sm">
                  <SearchIcon className="absolute left-3 w-5 h-5 text-brand-text-secondary pointer-events-none" />
                  <input 
                      type="text"
                      placeholder="Search filename, title, or tags..."
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="w-full h-full bg-gray-800 text-brand-text placeholder-brand-text-secondary pl-10 pr-10 py-2 rounded-lg border border-transparent focus:border-brand-primary focus:ring-0 transition"
                  />
                  {searchQuery && (
                      <button onClick={() => onSearchChange('')} className="absolute right-3 text-brand-text-secondary hover:text-white">
                          <XCircleIcon className="w-5 h-5" />
                      </button>
                  )}
              </div>
              <div className="flex items-center gap-2">
                 <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-800" title="Disable background loading of timeline scrub previews to save memory.">
                    <input
                        type="checkbox"
                        id="low-memory-mode"
                        checked={isLowMemoryMode}
                        onChange={(e) => onToggleLowMemoryMode(e.target.checked)}
                        className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-brand-primary focus:ring-brand-primary focus:ring-2 cursor-pointer"
                    />
                    <label htmlFor="low-memory-mode" className="text-sm text-brand-text-secondary cursor-pointer select-none">
                        Low Memory
                    </label>
                </div>
                 <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-800" title="Apply changes (tags, rating, etc.) to all filtered videos.">
                    <input
                        type="checkbox"
                        id="batch-edit-mode"
                        checked={isBatchEditMode}
                        onChange={(e) => onBatchEditModeChange(e.target.checked)}
                        className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-brand-primary focus:ring-brand-primary focus:ring-2 cursor-pointer"
                    />
                    <label htmlFor="batch-edit-mode" className="text-sm text-brand-text-secondary cursor-pointer select-none">
                        Apply to all ({filteredVideoCount})
                    </label>
                </div>
                <select 
                  id="sort-select"
                  value={sortCriteria} 
                  onChange={e => onSortCriteriaChange(e.target.value as SortCriteria)} 
                  className="bg-gray-800 h-full text-brand-text rounded-l-md px-2 py-2.5 text-sm border border-gray-700 focus:ring-brand-primary focus:border-brand-primary transition"
                  aria-label="Sort by"
                >
                  {sortOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={onSortDirectionToggle}
                  disabled={sortCriteria === 'random'}
                  className="h-full px-3 py-2 rounded-r-md bg-gray-800 hover:bg-gray-700 transition-colors text-brand-text-secondary border border-l-0 border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Sort Direction: ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
                >
                  {sortDirection === 'asc' ? <ArrowUpIcon className="w-5 h-5" /> : <ArrowDownIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
