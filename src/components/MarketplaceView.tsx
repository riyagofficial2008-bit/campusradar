import {
  CheckCircle2,
  Flag,
  ImagePlus,
  MessageSquare,
  Plus,
  Search,
  ShoppingBag,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  createMarketplaceListing,
  markListingStatus,
  reportMarketplaceListing,
} from '../services/campusLifeService';
import type {
  MarketplaceCategory,
  MarketplaceCondition,
  MarketplaceListing,
} from '../types/campus';
import { compressImageToDataUrl } from '../utils/imageUtils';
import { formatRelativeTime } from '../utils/statusLogic';

interface MarketplaceViewProps {
  currentUid: string | null;
  myDisplayName?: string;
  listings: MarketplaceListing[];
  onContactSeller: (sellerUid: string, sellerName: string, listingTitle: string) => void;
  onAuthRequired: () => void;
  onNotify: (msg: string) => void;
}

const MARKET_CATEGORIES: { id: MarketplaceCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Items' },
  { id: 'textbooks', label: 'Textbooks' },
  { id: 'notes', label: 'Notes & Study Material' },
  { id: 'calculators', label: 'Calculators' },
  { id: 'stationery', label: 'Stationery' },
  { id: 'lab_equipment', label: 'Lab Equipment' },
  { id: 'other', label: 'Other' },
];

export function MarketplaceView({
  currentUid,
  myDisplayName,
  listings,
  onContactSeller,
  onAuthRequired,
  onNotify,
}: MarketplaceViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<MarketplaceCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSold, setShowSold] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory>('textbooks');
  const [priceInr, setPriceInr] = useState('250');
  const [condition, setCondition] = useState<MarketplaceCondition>('good');
  const [pickupSpot, setPickupSpot] = useState('');
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return listings.filter((item) => {
      if (!showSold && item.status === 'sold') return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (q) {
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.sellerName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [listings, categoryFilter, searchQuery, showSold]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file);
      setPhotoDataUrl(compressed);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to process image.');
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await createMarketplaceListing({
      title,
      category,
      priceInr: Number(priceInr),
      condition,
      description,
      pickupSpot,
      photoDataUrl,
      sellerName: myDisplayName,
    });
    setSubmitting(false);
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    setTitle('');
    setDescription('');
    setPickupSpot('');
    setPhotoDataUrl(undefined);
    setShowCreate(false);
    onNotify('Listing published to Campus Marketplace.');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#070B14] pb-20 md:pb-8">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              Student Marketplace
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Buy or sell used textbooks, notes, calculators, stationery, and lab gear directly on campus (in-person handoff, no online payments).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Sell an Item</span>
          </button>
        </div>

        {/* Search & Category Controls */}
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-3 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search textbooks, Drafter, Casio fx-991..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white placeholder:text-slate-400"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={showSold}
                onChange={(e) => setShowSold(e.target.checked)}
              />
              <span>Include sold items</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {MARKET_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  categoryFilter === c.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#0F172A] border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Create Listing Form */}
        {showCreate && (
          <form
            onSubmit={handlePublish}
            className="bg-[#0B1120] border border-slate-700 rounded-xl p-5 space-y-3"
          >
            <h2 className="font-display font-semibold text-sm text-white">
              List a Student Item
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Item title (e.g. Engineering Graphics Kit)"
                required
                className="sm:col-span-2 h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MarketplaceCategory)}
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              >
                {MARKET_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={100000}
                value={priceInr}
                onChange={(e) => setPriceInr(e.target.value)}
                placeholder="Price (₹)"
                required
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as MarketplaceCondition)}
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              >
                <option value="new">New / Unused</option>
                <option value="like_new">Like New</option>
                <option value="good">Good Condition</option>
                <option value="used">Used / Fair</option>
              </select>
              <input
                type="text"
                value={pickupSpot}
                onChange={(e) => setPickupSpot(e.target.value)}
                placeholder="Campus meetup spot (e.g. Near NBC / KAB)"
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
              <label className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-slate-300 flex items-center gap-2 cursor-pointer hover:border-blue-500">
                <ImagePlus className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate">
                  {photoDataUrl ? 'Photo attached (click to change)' : 'Upload product photo'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="sr-only"
                />
              </label>
            </div>

            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Edition, subject, wear details..."
              required
              className="w-full p-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="h-9 px-3.5 rounded-lg border border-slate-700 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
              >
                {submitting ? 'Publishing...' : 'Publish Listing'}
              </button>
            </div>
          </form>
        )}

        {/* Listings Grid */}
        {filtered.length === 0 ? (
          <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
            No student listings match your search. List textbooks, calculators, or notes to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => {
              const isSeller = currentUid === item.sellerUid;
              const isSold = item.status === 'sold';
              return (
                <article
                  key={item.id}
                  className="bg-[#0B1120] border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {item.photoDataUrl ? (
                      <div className="aspect-[4/3] bg-[#0F172A] overflow-hidden border-b border-slate-800">
                        <img
                          src={item.photoDataUrl}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-gradient-to-br from-[#0F172A] to-[#131D33] border-b border-slate-800 flex flex-col items-center justify-center p-4 text-center">
                        <ShoppingBag className="w-7 h-7 text-slate-600 mb-1.5" />
                        <span className="text-xs text-slate-400">
                          {item.category.replace('_', ' ')}
                        </span>
                      </div>
                    )}

                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-semibold text-sm text-white leading-snug">
                          {item.title}
                        </h3>
                        <span className="font-mono font-bold text-sm text-emerald-400 tabular-nums shrink-0">
                          {item.priceInr === 0 ? 'Free' : `₹${item.priceInr}`}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400">
                        {item.condition.replace('_', ' ')} · Seller: {item.sellerName} ·{' '}
                        {formatRelativeTime(item.createdAt)}
                        {isSold ? ' · SOLD' : ''}
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2">
                        {item.description}
                      </p>

                      {item.pickupSpot && (
                        <div className="text-[11px] text-blue-300">
                          Meetup: {item.pickupSpot}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    {isSeller ? (
                      <button
                        type="button"
                        disabled={isSold}
                        onClick={async () => {
                          const res = await markListingStatus(item.id, 'sold');
                          onNotify(res.error ?? 'Marked as sold.');
                        }}
                        className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-white flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{isSold ? 'Sold' : 'Mark as Sold'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isSold}
                        onClick={() =>
                          onContactSeller(item.sellerUid, item.sellerName, item.title)
                        }
                        className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{isSold ? 'Sold' : 'Contact Seller'}</span>
                      </button>
                    )}

                    {!isSeller && (
                      <button
                        type="button"
                        title="Report suspicious listing"
                        onClick={async () => {
                          const res = await reportMarketplaceListing(item);
                          onNotify(res.error ?? 'Listing reported for review.');
                        }}
                        className="h-9 px-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-slate-400 hover:text-amber-300"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
