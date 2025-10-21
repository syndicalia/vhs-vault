// src/App.js - COMPLETE PRODUCTION VERSION
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Search, Plus, X, Film, User, LogOut, Star, Heart, ShoppingCart, Upload, Check, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';

export default function VHSCollectionTracker() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  
  const [masterReleases, setMasterReleases] = useState([]);
  const [collection, setCollection] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [marketplace, setMarketplace] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaster, setSelectedMaster] = useState(null);
  const [view, setView] = useState('browse');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitType, setSubmitType] = useState('variant');
  
  const [newSubmission, setNewSubmission] = useState({
    masterTitle: '',
    year: '',
    director: '',
    studio: '',
    genre: '',
    variantFormat: 'VHS',
    variantRegion: '',
    variantRelease: '',
    variantPackaging: '',
    variantNotes: '',
    variantBarcode: '',
    imageFiles: []
  });

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load data
  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  const loadAllData = async () => {
    await Promise.all([
      loadMasterReleases(),
      loadUserCollection(),
      loadUserWishlist(),
      loadUserRatings(),
      loadPendingSubmissions(),
      loadMarketplace()
    ]);
  };

  const loadMasterReleases = async () => {
    const { data, error } = await supabase
      .from('master_releases')
      .select('*, variants(*)');
    
    if (!error && data) {
      setMasterReleases(data);
    }
  };

  const loadUserCollection = async () => {
    const { data, error } = await supabase
      .from('user_collections')
      .select('*')
      .eq('user_id', user.id);
    
    if (!error) setCollection(data || []);
  };

  const loadUserWishlist = async () => {
    const { data, error } = await supabase
      .from('user_wishlists')
      .select('*')
      .eq('user_id', user.id);
    
    if (!error) setWishlist(data || []);
  };

  const loadUserRatings = async () => {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', user.id);
    
    if (!error) setRatings(data || []);
  };

  const loadPendingSubmissions = async () => {
    const { data, error } = await supabase
      .from('variants')
      .select('*, master_releases(*)')
      .eq('approved', false);
    
    if (!error) setPendingSubmissions(data || []);
  };

  const loadMarketplace = async () => {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*, master_releases(*), variants(*)')
      .eq('active', true);
    
    if (!error) setMarketplace(data || []);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else alert('Check your email for confirmation link!');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const addToCollection = async (masterId, variantId) => {
    const { error } = await supabase
      .from('user_collections')
      .insert([{ user_id: user.id, master_id: masterId, variant_id: variantId }]);
    
    if (!error) loadUserCollection();
  };

  const removeFromCollection = async (variantId) => {
    await supabase
      .from('user_collections')
      .delete()
      .eq('user_id', user.id)
      .eq('variant_id', variantId);
    
    loadUserCollection();
  };

  const isInCollection = (variantId) => {
    return collection.some(item => item.variant_id === variantId);
  };

  const toggleWishlist = async (masterId, variantId) => {
    const exists = wishlist.some(item => item.variant_id === variantId);
    
    if (exists) {
      await supabase
        .from('user_wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('variant_id', variantId);
    } else {
      await supabase
        .from('user_wishlists')
        .insert([{ user_id: user.id, master_id: masterId, variant_id: variantId }]);
    }
    
    loadUserWishlist();
  };

  const isInWishlist = (variantId) => {
    return wishlist.some(item => item.variant_id === variantId);
  };

  const setRating = async (masterId, rating) => {
    const existing = ratings.find(r => r.master_id === masterId);
    
    if (existing) {
      await supabase
        .from('user_ratings')
        .update({ rating })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('user_ratings')
        .insert([{ user_id: user.id, master_id: masterId, rating }]);
    }
    
    loadUserRatings();
    updateAverageRating(masterId);
  };

  const getUserRating = (masterId) => {
    const rating = ratings.find(r => r.master_id === masterId);
    return rating ? rating.rating : 0;
  };

  const updateAverageRating = async (masterId) => {
    const { data } = await supabase
      .from('user_ratings')
      .select('rating')
      .eq('master_id', masterId);
    
    if (data) {
      const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
      await supabase
        .from('master_releases')
        .update({ avg_rating: avg.toFixed(1), total_ratings: data.length })
        .eq('id', masterId);
      
      loadMasterReleases();
    }
  };

  const handleVote = async (variantId, voteType) => {
    const { data: existing } = await supabase
      .from('submission_votes')
      .select('*')
      .eq('user_id', user.id)
      .eq('variant_id', variantId)
      .single();
    
    if (existing) {
      if (existing.vote_type === voteType) {
        await supabase.from('submission_votes').delete().eq('id', existing.id);
      } else {
        await supabase.from('submission_votes').update({ vote_type: voteType }).eq('id', existing.id);
      }
    } else {
      await supabase.from('submission_votes').insert([{ user_id: user.id, variant_id: variantId, vote_type: voteType }]);
    }
    
    updateVoteCounts(variantId);
  };

  const updateVoteCounts = async (variantId) => {
    const { data: votes } = await supabase
      .from('submission_votes')
      .select('vote_type')
      .eq('variant_id', variantId);
    
    const upVotes = votes?.filter(v => v.vote_type === 'up').length || 0;
    const downVotes = votes?.filter(v => v.vote_type === 'down').length || 0;
    
    await supabase.from('variants').update({ votes_up: upVotes, votes_down: downVotes }).eq('id', variantId);
    loadPendingSubmissions();
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setNewSubmission({ ...newSubmission, imageFiles: [...newSubmission.imageFiles, ...files] });
  };

  const removeImage = (index) => {
    const newFiles = newSubmission.imageFiles.filter((_, i) => i !== index);
    setNewSubmission({ ...newSubmission, imageFiles: newFiles });
  };

  const uploadImages = async (variantId) => {
    const uploadedUrls = [];
    
    for (let i = 0; i < newSubmission.imageFiles.length; i++) {
      const file = newSubmission.imageFiles[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${variantId}-${i}.${fileExt}`;

      const { error } = await supabase.storage
        .from('variant-images')
        .upload(fileName, file);

      if (!error) {
        const { data } = supabase.storage.from('variant-images').getPublicUrl(fileName);
        uploadedUrls.push(data.publicUrl);
        
        await supabase.from('variant_images').insert([{
          variant_id: variantId,
          image_url: data.publicUrl,
          image_order: i
        }]);
      }
    }
    
    return uploadedUrls;
  };

  const handleSubmitEntry = async () => {
    try {
      if (submitType === 'master') {
        const { data: master, error: masterError } = await supabase
          .from('master_releases')
          .insert([{
            title: newSubmission.masterTitle,
            year: parseInt(newSubmission.year),
            director: newSubmission.director,
            studio: newSubmission.studio,
            genre: newSubmission.genre,
            created_by: user.id
          }])
          .select()
          .single();
        
        if (masterError) throw masterError;
        
        const { data: variant, error: variantError } = await supabase
          .from('variants')
          .insert([{
            master_id: master.id,
            format: newSubmission.variantFormat,
            region: newSubmission.variantRegion,
            release_year: newSubmission.variantRelease,
            packaging: newSubmission.variantPackaging,
            notes: newSubmission.variantNotes,
            barcode: newSubmission.variantBarcode,
            submitted_by: user.id,
            approved: false
          }])
          .select()
          .single();
        
        if (variantError) throw variantError;
        
        await uploadImages(variant.id);
      } else {
        const { data: variant, error } = await supabase
          .from('variants')
          .insert([{
            master_id: selectedMaster.id,
            format: newSubmission.variantFormat,
            region: newSubmission.variantRegion,
            release_year: newSubmission.variantRelease,
            packaging: newSubmission.variantPackaging,
            notes: newSubmission.variantNotes,
            barcode: newSubmission.variantBarcode,
            submitted_by: user.id,
            approved: false
          }])
          .select()
          .single();
        
        if (error) throw error;
        
        await uploadImages(variant.id);
      }
      
      alert('Submission sent for review!');
      setShowSubmitModal(false);
      setNewSubmission({
        masterTitle: '', year: '', director: '', studio: '', genre: '',
        variantFormat: 'VHS', variantRegion: '', variantRelease: '',
        variantPackaging: '', variantNotes: '', variantBarcode: '', imageFiles: []
      });
      
      loadAllData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const filteredMasters = masterReleases.filter(master =>
    master.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    master.director.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCollectionItems = () => {
    return collection.map(item => {
      const master = masterReleases.find(m => m.id === item.master_id);
      const variant = master?.variants?.find(v => v.id === item.variant_id);
      return { master, variant };
    }).filter(item => item.master && item.variant);
  };

  const getWishlistItems = () => {
    return wishlist.map(item => {
      const master = masterReleases.find(m => m.id === item.master_id);
      const variant = master?.variants?.find(v => v.id === item.variant_id);
      return { master, variant };
    }).filter(item => item.master && item.variant);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
          <div className="flex items-center justify-center mb-6">
            <Film className="w-12 h-12 text-purple-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-800">VHS Vault</h1>
          </div>
          <p className="text-gray-600 text-center mb-6">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAuth(e)}
              placeholder="Password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleAuth}
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </button>
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full mt-4 text-purple-600 hover:text-purple-700 font-medium"
            >
              {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Film className="w-8 h-8" />
              <h1 className="text-2xl font-bold">VHS Vault</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 bg-purple-700 px-4 py-2 rounded-lg">
                <User className="w-5 h-5" />
                <span className="text-sm">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-purple-700 hover:bg-purple-800 px-4 py-2 rounded-lg transition flex items-center space-x-2"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-2 md:space-x-8 overflow-x-auto">
            {['browse', 'collection', 'wishlist', 'marketplace', 'pending'].map(tab => (
              <button
                key={tab}
                onClick={() => { setView(tab); setSelectedMaster(null); }}
                className={`py-4 px-2 border-b-2 font-medium transition whitespace-nowrap capitalize ${
                  view === tab ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab} {tab === 'collection' && `(${collection.length})`}
                {tab === 'wishlist' && `(${wishlist.length})`}
                {tab === 'pending' && `(${pendingSubmissions.length})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {view === 'browse' && (
          <>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search titles or directors..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={() => { setShowSubmitModal(true); setSubmitType('master'); }}
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition flex items-center justify-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Add New Title</span>
              </button>
            </div>

            {!selectedMaster ? (
              <div className="grid gap-4">
                {filteredMasters.map(master => (
                  <div
                    key={master.id}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition p-6 cursor-pointer"
                    onClick={() => setSelectedMaster(master)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-xl font-bold text-gray-800 mb-1">{master.title}</h2>
                        <p className="text-gray-500 mt-2">Browse the database to add tapes</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {getCollectionItems().map((item, idx) => (
                  <div key={idx} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">{item.master.title}</h3>
                        <p className="text-gray-600 mb-3">{item.master.director} • {item.master.year}</p>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                            {item.variant.format}
                          </span>
                          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                            {item.variant.region}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm">
                          {item.variant.release_year} • {item.variant.packaging}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCollection(item.variant.id)}
                        className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center space-x-2"
                      >
                        <X className="w-4 h-4" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view === 'wishlist' && (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">My Wishlist</h2>
            {wishlist.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">Your wishlist is empty</p>
                <p className="text-gray-500 mt-2">Add tapes you want to find</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {getWishlistItems().map((item, idx) => (
                  <div key={idx} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">{item.master.title}</h3>
                        <p className="text-gray-600 mb-3">{item.master.director} • {item.master.year}</p>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                            {item.variant.format}
                          </span>
                          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                            {item.variant.region}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleWishlist(item.master.id, item.variant.id)}
                        className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center space-x-2"
                      >
                        <X className="w-4 h-4" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view === 'marketplace' && (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Marketplace</h2>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition flex items-center space-x-2">
                <ShoppingCart className="w-4 h-4" />
                <span>List Item</span>
              </button>
            </div>
            {marketplace.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">No items for sale</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {marketplace.map(listing => (
                  <div key={listing.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 mb-1">{listing.master_releases.title}</h3>
                        <p className="text-gray-600 mb-3">{listing.master_releases.director} • {listing.master_releases.year}</p>
                        <div className="flex items-center space-x-2 mb-3">
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                            {listing.variants.format}
                          </span>
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                            {listing.condition}
                          </span>
                        </div>
                        <p className="text-gray-700 mb-2">{listing.description}</p>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="text-3xl font-bold text-green-600 mb-3">${listing.price}</p>
                        <button className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition font-medium">
                          Contact Seller
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view === 'pending' && (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Pending Submissions</h2>
            <p className="text-gray-600 mb-6">Vote on community submissions to help maintain database quality</p>
            {pendingSubmissions.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">No pending submissions</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pendingSubmissions.map(submission => (
                  <div key={submission.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-start justify-between mb-4">
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                        Pending Review
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleVote(submission.id, 'up')}
                          className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-green-100 transition"
                        >
                          <ThumbsUp className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-medium">{submission.votes_up || 0}</span>
                        <button
                          onClick={() => handleVote(submission.id, 'down')}
                          className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-red-100 transition"
                        >
                          <ThumbsDown className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-medium">{submission.votes_down || 0}</span>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      New Variant for: {submission.master_releases.title}
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">Format</p>
                        <p className="text-gray-600">{submission.format}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">Region</p>
                        <p className="text-gray-600">{submission.region}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">Release Year</p>
                        <p className="text-gray-600">{submission.release_year}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">Packaging</p>
                        <p className="text-gray-600">{submission.packaging}</p>
                      </div>
                      {submission.barcode && (
                        <div className="md:col-span-2">
                          <p className="text-sm font-semibold text-gray-700 mb-1">Barcode</p>
                          <p className="text-gray-600">{submission.barcode}</p>
                        </div>
                      )}
                      {submission.notes && (
                        <div className="md:col-span-2">
                          <p className="text-sm font-semibold text-gray-700 mb-1">Notes</p>
                          <p className="text-gray-600 italic">{submission.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  {submitType === 'master' ? 'Submit New Title' : 'Submit New Variant'}
                </h2>
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {submitType === 'master' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                      <input
                        type="text"
                        value={newSubmission.masterTitle}
                        onChange={(e) => setNewSubmission({...newSubmission, masterTitle: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter movie title"
                      />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                        <input
                          type="text"
                          value={newSubmission.year}
                          onChange={(e) => setNewSubmission({...newSubmission, year: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="1999"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Genre</label>
                        <input
                          type="text"
                          value={newSubmission.genre}
                          onChange={(e) => setNewSubmission({...newSubmission, genre: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Action, Drama, etc."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Director</label>
                      <input
                        type="text"
                        value={newSubmission.director}
                        onChange={(e) => setNewSubmission({...newSubmission, director: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Director name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Studio</label>
                      <input
                        type="text"
                        value={newSubmission.studio}
                        onChange={(e) => setNewSubmission({...newSubmission, studio: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Production studio"
                      />
                    </div>
                  </>
                )}

                <div className="border-t pt-4">
                  <h3 className="font-bold text-gray-800 mb-4">
                    {submitType === 'master' ? 'Initial Variant Details' : 'Variant Details'}
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                        <select
                          value={newSubmission.variantFormat}
                          onChange={(e) => setNewSubmission({...newSubmission, variantFormat: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option>VHS</option>
                          <option>Betamax</option>
                          <option>Video CD</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
                        <input
                          type="text"
                          value={newSubmission.variantRegion}
                          onChange={(e) => setNewSubmission({...newSubmission, variantRegion: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="NTSC (USA), PAL (UK), etc."
                        />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Release Year</label>
                        <input
                          type="text"
                          value={newSubmission.variantRelease}
                          onChange={(e) => setNewSubmission({...newSubmission, variantRelease: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="1999"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Packaging</label>
                        <input
                          type="text"
                          value={newSubmission.variantPackaging}
                          onChange={(e) => setNewSubmission({...newSubmission, variantPackaging: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Clamshell, Slipcover, etc."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Barcode/UPC</label>
                      <input
                        type="text"
                        value={newSubmission.variantBarcode}
                        onChange={(e) => setNewSubmission({...newSubmission, variantBarcode: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter barcode number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                      <textarea
                        value={newSubmission.variantNotes}
                        onChange={(e) => setNewSubmission({...newSubmission, variantNotes: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        rows="3"
                        placeholder="Special edition notes, condition, etc."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Upload Images</label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="image-upload"
                        />
                        <label htmlFor="image-upload" className="cursor-pointer">
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-600">Click to upload images</p>
                          <p className="text-sm text-gray-500 mt-1">Front, back, spine, and any special features</p>
                        </label>
                      </div>
                      {newSubmission.imageFiles.length > 0 && (
                        <div className="mt-4 grid grid-cols-4 gap-2">
                          {newSubmission.imageFiles.map((file, idx) => (
                            <div key={idx} className="relative">
                              <div className="w-full h-24 bg-gray-200 rounded border flex items-center justify-center">
                                <p className="text-xs text-gray-600 px-2 text-center">{file.name}</p>
                              </div>
                              <button
                                onClick={() => removeImage(idx)}
                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-800 font-medium">Community Review Required</p>
                      <p className="text-sm text-blue-700 mt-1">
                        Your submission will be reviewed by the community. Once approved by moderators, it will be added to the database.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowSubmitModal(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitEntry}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
                  >
                    Submit for Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}text-gray-600">{master.director} • {master.year} • {master.genre}</p>
                        <p className="text-sm text-gray-500 mt-1">{master.studio}</p>
                        <div className="flex items-center space-x-4 mt-3">
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="font-medium">{master.avg_rating || 0}</span>
                            <span className="text-gray-500 text-sm">({master.total_ratings || 0})</span>
                          </div>
                          <p className="text-sm text-purple-600">{master.variants?.length || 0} variant(s)</p>
                        </div>
                      </div>
                      <div className="text-2xl">🎬</div>
                    </div>
                  </div>
                ))}
                {filteredMasters.length === 0 && (
                  <div className="bg-white rounded-lg shadow p-12 text-center">
                    <Film className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">No titles found</p>
                    <p className="text-gray-500 mt-2">Try a different search or add a new title</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setSelectedMaster(null)}
                  className="mb-4 text-purple-600 hover:text-purple-700 font-medium"
                >
                  ← Back to list
                </button>
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedMaster.title}</h2>
                      <p className="text-gray-600 mb-1">Directed by {selectedMaster.director}</p>
                      <p className="text-gray-600 mb-1">Released: {selectedMaster.year}</p>
                      <p className="text-gray-600 mb-1">Studio: {selectedMaster.studio}</p>
                      <p className="text-gray-600 mb-3">Genre: {selectedMaster.genre}</p>
                      
                      <div className="flex items-center space-x-4 mb-4">
                        <div className="flex items-center space-x-1">
                          <Star className="w-5 h-5 text-yellow-500 fill-current" />
                          <span className="font-bold text-lg">{selectedMaster.avg_rating || 0}</span>
                          <span className="text-gray-500">({selectedMaster.total_ratings || 0} ratings)</span>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Your Rating:</p>
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              onClick={() => setRating(selectedMaster.id, star)}
                              className="focus:outline-none"
                            >
                              <Star
                                className={`w-6 h-6 ${
                                  star <= getUserRating(selectedMaster.id)
                                    ? 'text-yellow-500 fill-current'
                                    : 'text-gray-300'
                                } hover:text-yellow-400 transition`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-4xl">🎬</div>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800">Variants ({selectedMaster.variants?.length || 0})</h3>
                  <button
                    onClick={() => { setShowSubmitModal(true); setSubmitType('variant'); }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Variant</span>
                  </button>
                </div>

                <div className="grid gap-4">
                  {selectedMaster.variants?.filter(v => v.approved).map(variant => {
                    const inColl = isInCollection(variant.id);
                    const inWish = isInWishlist(variant.id);
                    return (
                      <div key={variant.id} className="bg-white rounded-lg shadow p-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                                {variant.format}
                              </span>
                              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                                {variant.region}
                              </span>
                              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm flex items-center space-x-1">
                                <Check className="w-3 h-3" />
                                <span>Verified</span>
                              </span>
                            </div>
                            <p className="text-gray-700 mb-1">
                              <span className="font-semibold">Release:</span> {variant.release_year}
                            </p>
                            <p className="text-gray-700 mb-1">
                              <span className="font-semibold">Packaging:</span> {variant.packaging}
                            </p>
                            <p className="text-gray-700 mb-1">
                              <span className="font-semibold">Barcode:</span> {variant.barcode}
                            </p>
                            {variant.notes && (
                              <p className="text-gray-600 text-sm mt-2 italic">{variant.notes}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              {variant.votes_up || 0} 👍 {variant.votes_down || 0} 👎
                            </p>
                          </div>
                          <div className="ml-4 flex flex-col space-y-2">
                            <button
                              onClick={() => {
                                if (inColl) {
                                  removeFromCollection(variant.id);
                                } else {
                                  addToCollection(selectedMaster.id, variant.id);
                                }
                              }}
                              className={`px-4 py-2 rounded-lg font-medium transition flex items-center space-x-2 ${
                                inColl
                                  ? 'bg-red-500 text-white hover:bg-red-600'
                                  : 'bg-purple-600 text-white hover:bg-purple-700'
                              }`}
                            >
                              {inColl ? <><X className="w-4 h-4" /><span>Remove</span></> : <><Plus className="w-4 h-4" /><span>Add</span></>}
                            </button>
                            <button
                              onClick={() => toggleWishlist(selectedMaster.id, variant.id)}
                              className={`px-4 py-2 rounded-lg font-medium transition flex items-center justify-center ${
                                inWish
                                  ? 'bg-pink-500 text-white hover:bg-pink-600'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${inWish ? 'fill-current' : ''}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {view === 'collection' && (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">My Collection</h2>
            {collection.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Film className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">Your collection is empty</p>
                <p className="