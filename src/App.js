import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Search, Plus, X, Film, User, LogOut, Star, Heart, ShoppingCart, Upload, Check, ThumbsUp, ThumbsDown, AlertCircle, Edit, Trash2, ChevronLeft, ChevronRight, Loader } from 'lucide-react';

const TMDB_API_KEY = 'b28f3e3e29371a179b076c9eda73c776';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

export default function VHSCollectionTracker() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [masterReleases, setMasterReleases] = useState([]);
  const [collection, setCollection] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [marketplace, setMarketplace] = useState([]);
  const [userVotes, setUserVotes] = useState({});

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaster, setSelectedMaster] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [view, setView] = useState('search');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitType, setSubmitType] = useState('variant');
  const [imageGallery, setImageGallery] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editingVariant, setEditingVariant] = useState(null);
  const [editingMaster, setEditingMaster] = useState(null);
  const [tmdbSearchResults, setTmdbSearchResults] = useState([]);
  const [showTmdbDropdown, setShowTmdbDropdown] = useState(false);
  const [tmdbSearchTimeout, setTmdbSearchTimeout] = useState(null);
  const [tmdbSearchTerm, setTmdbSearchTerm] = useState('');
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionToAdd, setCollectionToAdd] = useState({ masterId: null, variantId: null });
  const [collectionDetails, setCollectionDetails] = useState({ condition: '', notes: '' });

  // Toast and loading states
  const [toast, setToast] = useState(null);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [tmdbSearching, setTmdbSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [sortVariantsBy, setSortVariantsBy] = useState('date'); // 'date', 'region', 'format'

  const [newSubmission, setNewSubmission] = useState({
    masterTitle: '',
    year: '',
    director: '',
    studio: '',
    genre: '',
    variantFormat: 'VHS',
    variantRegion: '',
    variantRelease: '',
    variantCaseType: '',
    variantNotes: '',
    variantBarcode: '',
    // Advanced fields
    editionType: '',
    audioLanguage: '',
    subtitles: null,
    originalRating: '',
    aspectRatio: '',
    shellColor: '',
    imageCover: null,
    imageBack: null,
    imageSpine: null,
    imageTapeLabel: null
  });

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

  useEffect(() => {
    if (user) {
      loadAllData();
      loadUserVotes();
      checkAdminStatus();
    }
  }, [user]);

  useEffect(() => {
    // Set default view based on admin status
    if (view === 'browse' && !isAdmin) {
      setView('search');
    } else if (view === 'search' && isAdmin) {
      setView('browse');
    }
  }, [isAdmin]);

  useEffect(() => {
    // Auto-dismiss toast after 3 seconds
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    // Close TMDB dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (showTmdbDropdown && !event.target.closest('.tmdb-search-container')) {
        setShowTmdbDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTmdbDropdown]);

  const checkAdminStatus = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      const role = data.user.user_metadata?.role;
      setIsAdmin(role === 'admin');
    }
  };

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
    // Only load master data with variant count - full variants load on demand
    const { data, error } = await supabase
      .from('master_releases')
      .select(`
        id,
        title,
        director,
        year,
        genre,
        studio,
        poster_url,
        avg_rating,
        total_ratings,
        variants(count)
      `);

    if (!error && data) {
      // Transform count result to simple variant_count property
      const mastersWithCount = data.map(master => ({
        ...master,
        variant_count: master.variants?.[0]?.count || 0,
        variants: [] // Empty array for compatibility
      }));
      setMasterReleases(mastersWithCount);
    }
  };

  const loadVariantsForMaster = async (masterId) => {
    setLoadingVariants(true);
    const { data, error } = await supabase
      .from('variants')
      .select('*, variant_images(*)')
      .eq('master_id', masterId)
      .eq('approved', true)
      .order('release_year', { ascending: false });

    setLoadingVariants(false);
    if (error) {
      console.error('Error loading variants:', error);
      showToast('Error loading variants', 'error');
      return [];
    }
    return data || [];
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
      .select(`
        *,
        master_releases(*),
        variant_images(*)
      `)
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

  const loadUserVotes = async () => {
    const { data, error } = await supabase
      .from('submission_votes')
      .select('variant_id, vote_type')
      .eq('user_id', user.id);

    if (!error && data) {
      const votesMap = {};
      data.forEach(vote => {
        votesMap[vote.variant_id] = vote.vote_type;
      });
      setUserVotes(votesMap);
    }
  };

  const searchTMDB = async (title, year) => {
    try {
      const yearParam = year ? `&year=${year}` : '';
      const response = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}${yearParam}`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const movie = data.results[0];
        if (movie.poster_path) {
          return `${TMDB_IMAGE_BASE}${movie.poster_path}`;
        }
      }
      return null;
    } catch (error) {
      console.error('TMDB search error:', error);
      return null;
    }
  };

  const handleTitleSearch = async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setTmdbSearchResults([]);
      setShowTmdbDropdown(false);
      setTmdbSearching(false);
      return;
    }

    // Clear existing timeout
    if (tmdbSearchTimeout) {
      clearTimeout(tmdbSearchTimeout);
    }

    setTmdbSearching(true);

    // Set new timeout for debouncing
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchQuery)}`
        );
        const data = await response.json();

        if (data.results) {
          setTmdbSearchResults(data.results.slice(0, 10)); // Limit to 10 results
          setShowTmdbDropdown(true);
        }
        setTmdbSearching(false);
      } catch (error) {
        console.error('TMDB search error:', error);
        setTmdbSearching(false);
        showToast('Error searching TMDB', 'error');
      }
    }, 300); // 300ms debounce

    setTmdbSearchTimeout(timeout);
  };

  const selectTmdbMovie = async (movie) => {
    // Fetch full movie details including director, studio, and genres
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`
      );
      const details = await response.json();

      // Extract director from crew
      let director = '';
      if (details.credits && details.credits.crew) {
        const directorObj = details.credits.crew.find(person => person.job === 'Director');
        director = directorObj ? directorObj.name : '';
      }

      // Extract production studio (first production company)
      let studio = '';
      if (details.production_companies && details.production_companies.length > 0) {
        studio = details.production_companies[0].name;
      }

      // Extract genres (comma-separated)
      let genres = '';
      if (details.genres && details.genres.length > 0) {
        genres = details.genres.map(g => g.name).join(', ');
      }

      setNewSubmission({
        ...newSubmission,
        masterTitle: movie.title,
        year: movie.release_date ? movie.release_date.substring(0, 4) : '',
        director: director,
        studio: studio,
        genre: genres
      });
      setShowTmdbDropdown(false);
      setTmdbSearchResults([]);
    } catch (error) {
      console.error('Error fetching TMDB details:', error);
      // Fallback to basic info if detailed fetch fails
      setNewSubmission({
        ...newSubmission,
        masterTitle: movie.title,
        year: movie.release_date ? movie.release_date.substring(0, 4) : '',
      });
      setShowTmdbDropdown(false);
      setTmdbSearchResults([]);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) showToast(error.message, 'error');
      else showToast('Check your email for confirmation link!');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) showToast(error.message, 'error');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const showAddToCollectionModal = (masterId, variantId) => {
    setCollectionToAdd({ masterId, variantId });
    setCollectionDetails({ condition: '', notes: '' });
    setShowCollectionModal(true);
  };

  const addToCollection = async (masterId, variantId, condition = null, notes = null) => {
    const { error } = await supabase
      .from('user_collections')
      .insert([{
        user_id: user.id,
        master_id: masterId,
        variant_id: variantId,
        condition: condition,
        notes: notes
      }]);

    if (!error) {
      loadUserCollection();
      setShowCollectionModal(false);
      setCollectionDetails({ condition: '', notes: '' });
    }
  };

  const handleAddToCollection = () => {
    addToCollection(
      collectionToAdd.masterId,
      collectionToAdd.variantId,
      collectionDetails.condition || null,
      collectionDetails.notes || null
    );
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

    if (data && data.length > 0) {
      const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
      await supabase
        .from('master_releases')
        .update({ avg_rating: avg.toFixed(1), total_ratings: data.length })
        .eq('id', masterId);

      loadMasterReleases();
    }
  };

  const handleVote = async (variantId, voteType) => {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('submission_votes')
        .select('*')
        .eq('user_id', user.id)
        .eq('variant_id', variantId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking vote:', fetchError);
        return;
      }

      if (existing) {
        if (existing.vote_type === voteType) {
          await supabase
            .from('submission_votes')
            .delete()
            .eq('id', existing.id);

          const newVotes = { ...userVotes };
          delete newVotes[variantId];
          setUserVotes(newVotes);
        } else {
          await supabase
            .from('submission_votes')
            .update({ vote_type: voteType })
            .eq('id', existing.id);

          setUserVotes({ ...userVotes, [variantId]: voteType });
        }
      } else {
        await supabase
          .from('submission_votes')
          .insert([{ user_id: user.id, variant_id: variantId, vote_type: voteType }]);

        setUserVotes({ ...userVotes, [variantId]: voteType });
      }

      await updateVoteCounts(variantId);
      await loadPendingSubmissions();
    } catch (error) {
      console.error('Vote error:', error);
      showToast('Error voting: ' + error.message, 'error');
    }
  };

  const updateVoteCounts = async (variantId) => {
    const { data: votes } = await supabase
      .from('submission_votes')
      .select('vote_type')
      .eq('variant_id', variantId);

    const upVotes = votes?.filter(v => v.vote_type === 'up').length || 0;
    const downVotes = votes?.filter(v => v.vote_type === 'down').length || 0;

    await supabase
      .from('variants')
      .update({ votes_up: upVotes, votes_down: downVotes })
      .eq('id', variantId);

    // Auto-approve if 10 or more upvotes
    if (upVotes >= 10) {
      // Check if variant is still pending (not already approved)
      const { data: variant } = await supabase
        .from('variants')
        .select('approved')
        .eq('id', variantId)
        .single();

      if (variant && !variant.approved) {
        await approveSubmission(variantId);
      }
    }
  };

  const approveSubmission = async (variantId) => {
    try {
      console.log('Approving variant:', variantId);

      const { data, error } = await supabase
        .from('variants')
        .update({ approved: true })
        .eq('id', variantId)
        .select();

      if (error) {
        console.error('Approval error:', error);
        throw error;
      }

      console.log('Approval successful:', data);
      showToast('Submission approved!');

      // Reload all data to ensure consistency
      await loadAllData();
    } catch (error) {
      console.error('Error in approveSubmission:', error);
      showToast('Error approving submission: ' + error.message, 'error');
    }
  };

  const rejectSubmission = async (variantId) => {
    if (!window.confirm('Are you sure you want to reject this submission? This will delete it permanently.')) {
      return;
    }

    try {
      const { data: images } = await supabase
        .from('variant_images')
        .select('image_url')
        .eq('variant_id', variantId);

      if (images) {
        for (const img of images) {
          const fileName = img.image_url.split('/').pop();
          await supabase.storage
            .from('variant-images')
            .remove([fileName]);
        }
      }

      const { error } = await supabase
        .from('variants')
        .delete()
        .eq('id', variantId);

      if (error) throw error;

      showToast('Submission rejected and deleted');
      await loadPendingSubmissions();
    } catch (error) {
      showToast('Error rejecting submission: ' + error.message, 'error');
    }
  };

  const deleteVariant = async (variantId) => {
    if (!window.confirm('Are you sure you want to delete this variant? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete variant images from storage
      const { data: images } = await supabase
        .from('variant_images')
        .select('image_url')
        .eq('variant_id', variantId);

      if (images) {
        for (const img of images) {
          const fileName = img.image_url.split('/').pop();
          await supabase.storage
            .from('variant-images')
            .remove([fileName]);
        }
      }

      // Delete the variant
      const { error } = await supabase
        .from('variants')
        .delete()
        .eq('id', variantId);

      if (error) throw error;

      showToast('Variant deleted successfully');
      await loadAllData();
    } catch (error) {
      showToast('Error deleting variant: ' + error.message, 'error');
    }
  };

  const deleteMasterRelease = async (masterId) => {
    if (!window.confirm('Are you sure you want to delete this master release? This will also delete all associated variants and cannot be undone.')) {
      return;
    }

    try {
      // Get all variants for this master
      const { data: variants } = await supabase
        .from('variants')
        .select('id')
        .eq('master_id', masterId);

      // Delete all variant images
      if (variants && variants.length > 0) {
        for (const variant of variants) {
          const { data: images } = await supabase
            .from('variant_images')
            .select('image_url')
            .eq('variant_id', variant.id);

          if (images) {
            for (const img of images) {
              const fileName = img.image_url.split('/').pop();
              await supabase.storage
                .from('variant-images')
                .remove([fileName]);
            }
          }
        }
      }

      // Delete the master release (cascade will delete variants)
      const { error } = await supabase
        .from('master_releases')
        .delete()
        .eq('id', masterId);

      if (error) throw error;

      showToast('Master release and all variants deleted successfully');
      setSelectedMaster(null);
      await loadAllData();
    } catch (error) {
      showToast('Error deleting master release: ' + error.message, 'error');
    }
  };

  const handleImageUpload = (e, imageType) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileWithPreview = {
      file,
      preview: URL.createObjectURL(file)
    };

    setNewSubmission({
      ...newSubmission,
      [imageType]: fileWithPreview
    });
  };

  const removeImage = (imageType) => {
    if (newSubmission[imageType]) {
      URL.revokeObjectURL(newSubmission[imageType].preview);
      setNewSubmission({ ...newSubmission, [imageType]: null });
    }
  };

  const openImageGallery = (images, startIndex = 0) => {
    setImageGallery(images);
    setCurrentImageIndex(startIndex);
  };

  const closeImageGallery = () => {
    setImageGallery([]);
    setCurrentImageIndex(0);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % imageGallery.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + imageGallery.length) % imageGallery.length);
  };

  const uploadImages = async (variantId) => {
    const imageTypes = [
      { key: 'imageCover', order: 0, label: 'Cover' },
      { key: 'imageBack', order: 1, label: 'Back' },
      { key: 'imageSpine', order: 2, label: 'Spine' },
      { key: 'imageTapeLabel', order: 3, label: 'Tape Label' }
    ];

    for (const imageType of imageTypes) {
      const fileObj = newSubmission[imageType.key];
      if (!fileObj) continue; // Skip if no image uploaded for this type
      if (fileObj.existing) continue; // Skip if this is an existing image (not replaced)

      const file = fileObj.file;
      const fileExt = file.name.split('.').pop();
      const fileName = `${variantId}-${imageType.label.toLowerCase().replace(' ', '-')}-${Date.now()}.${fileExt}`;

      // If editing, delete old image with this order
      if (editingVariant) {
        const { data: oldImage } = await supabase
          .from('variant_images')
          .select('*')
          .eq('variant_id', variantId)
          .eq('image_order', imageType.order)
          .maybeSingle();

        if (oldImage) {
          // Delete old image from storage
          const oldFileName = oldImage.image_url.split('/').pop();
          await supabase.storage
            .from('variant-images')
            .remove([oldFileName]);

          // Delete old image record
          await supabase
            .from('variant_images')
            .delete()
            .eq('id', oldImage.id);
        }
      }

      // Upload new image
      const { error } = await supabase.storage
        .from('variant-images')
        .upload(fileName, file);

      if (!error) {
        const { data } = supabase.storage.from('variant-images').getPublicUrl(fileName);

        await supabase.from('variant_images').insert([{
          variant_id: variantId,
          image_url: data.publicUrl,
          image_order: imageType.order
        }]);
      }
    }
  };

  const handleSubmitEntry = async () => {
    try {
      // Validate required fields for variants
      if (!editingMaster) {
        if (!newSubmission.variantRegion) {
          showToast('Region is required! Please select a region before submitting.', 'error');
          return;
        }
        if (!newSubmission.variantCaseType) {
          showToast('Case Type is required! Please select a case type before submitting.', 'error');
          return;
        }
      }

      // Validate required images for new submissions (not edits)
      if (!editingMaster && !editingVariant) {
        if (!newSubmission.imageCover) {
          showToast('Cover image is required! Please upload a cover image.', 'error');
          return;
        }
        if (!newSubmission.imageBack) {
          showToast('Back image is required! Please upload a back image.', 'error');
          return;
        }
        // Spine and Tape Label are optional
      }

      if (submitType === 'master') {
        if (editingMaster) {
          // Edit existing master
          const posterUrl = await searchTMDB(newSubmission.masterTitle, newSubmission.year);

          const { error: masterError } = await supabase
            .from('master_releases')
            .update({
              title: newSubmission.masterTitle,
              year: parseInt(newSubmission.year),
              director: newSubmission.director,
              studio: newSubmission.studio,
              genre: newSubmission.genre,
              poster_url: posterUrl || editingMaster.poster_url
            })
            .eq('id', editingMaster.id);

          if (masterError) throw masterError;

          showToast('Master release updated successfully!');
          setEditingMaster(null);
        } else {
          // Create new master
          const posterUrl = await searchTMDB(newSubmission.masterTitle, newSubmission.year);
          console.log('TMDB poster URL fetched:', posterUrl);

          const { data: master, error: masterError } = await supabase
            .from('master_releases')
            .insert([{
              title: newSubmission.masterTitle,
              year: parseInt(newSubmission.year),
              director: newSubmission.director,
              studio: newSubmission.studio,
              genre: newSubmission.genre,
              poster_url: posterUrl,
              created_by: user.id
            }])
            .select()
            .single();

          if (masterError) {
            console.error('Error creating master:', masterError);
            throw masterError;
          }
          console.log('Master created:', master);

          const { data: variant, error: variantError } = await supabase
            .from('variants')
            .insert([{
              master_id: master.id,
              format: newSubmission.variantFormat,
              region: newSubmission.variantRegion,
              release_year: newSubmission.variantRelease,
              case_type: newSubmission.variantCaseType,
              notes: newSubmission.variantNotes,
              barcode: newSubmission.variantBarcode,
              edition_type: newSubmission.editionType || null,
              audio_language: newSubmission.audioLanguage || null,
              subtitles: newSubmission.subtitles,
              original_rating: newSubmission.originalRating || null,
              aspect_ratio: newSubmission.aspectRatio || null,
              shell_color: newSubmission.shellColor || null,
              submitted_by: user.id,
              approved: false
            }])
            .select()
            .single();

          if (variantError) throw variantError;

          await uploadImages(variant.id);
          showToast('Submission sent for review!');
        }
      } else {
        // Variant only
        if (editingVariant) {
          // Edit existing variant
          const { error } = await supabase
            .from('variants')
            .update({
              format: newSubmission.variantFormat,
              region: newSubmission.variantRegion,
              release_year: newSubmission.variantRelease,
              case_type: newSubmission.variantCaseType,
              notes: newSubmission.variantNotes,
              barcode: newSubmission.variantBarcode,
              edition_type: newSubmission.editionType || null,
              audio_language: newSubmission.audioLanguage || null,
              subtitles: newSubmission.subtitles,
              original_rating: newSubmission.originalRating || null,
              aspect_ratio: newSubmission.aspectRatio || null,
              shell_color: newSubmission.shellColor || null
            })
            .eq('id', editingVariant.id);

          if (error) throw error;

          // Upload any new images
          const hasNewImages = newSubmission.imageCover || newSubmission.imageBack ||
                               newSubmission.imageSpine || newSubmission.imageTapeLabel;
          if (hasNewImages) {
            await uploadImages(editingVariant.id);
          }

          showToast('Variant updated successfully!');
          setEditingVariant(null);
        } else {
          // Create new variant
          if (!selectedMaster) {
            showToast('Error: No master release selected. Please select a title first.', 'error');
            return;
          }

          const { data: variant, error } = await supabase
            .from('variants')
            .insert([{
              master_id: selectedMaster.id,
              format: newSubmission.variantFormat,
              region: newSubmission.variantRegion,
              release_year: newSubmission.variantRelease,
              case_type: newSubmission.variantCaseType,
              notes: newSubmission.variantNotes,
              barcode: newSubmission.variantBarcode,
              submitted_by: user.id,
              approved: false
            }])
            .select()
            .single();

          if (error) throw error;

          await uploadImages(variant.id);
          showToast('Submission sent for review!');
        }
      }

      setShowSubmitModal(false);
      setNewSubmission({
        masterTitle: '', year: '', director: '', studio: '', genre: '',
        variantFormat: 'VHS', variantRegion: '', variantRelease: '',
        variantCaseType: '', variantNotes: '', variantBarcode: '',
        imageCover: null, imageBack: null, imageSpine: null, imageTapeLabel: null
      });

      loadAllData();
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    }
  };

  const filteredMasters = masterReleases.filter(master =>
    master.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    master.director.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortVariants = (variants) => {
    if (!variants) return [];
    const sorted = [...variants];
    switch (sortVariantsBy) {
      case 'date':
        return sorted.sort((a, b) => parseInt(a.release_year) - parseInt(b.release_year));
      case 'region':
        return sorted.sort((a, b) => a.region.localeCompare(b.region));
      case 'format':
        return sorted.sort((a, b) => a.format.localeCompare(b.format));
      default:
        return sorted;
    }
  };

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
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border-4 border-orange-500">
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="relative mb-4">
              <Film className="w-16 h-16 text-orange-400 drop-shadow-2xl" />
              <div className="absolute -inset-2 bg-orange-400 rounded-full opacity-20 blur-lg"></div>
            </div>
            <h1 className="text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-500 mb-2">
              VHS VAULT
            </h1>
            <p className="text-sm text-gray-600 font-mono tracking-wider">REWIND • PLAY • COLLECT</p>
          </div>
          <p className="text-gray-700 text-center mb-6 font-semibold">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-24 right-6 z-50 px-6 py-4 rounded-lg shadow-2xl transform transition-all duration-300 animate-bounce-in flex items-center space-x-3 ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } text-white font-semibold`}>
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <Check className="w-5 h-5" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="sticky top-0 z-40 bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 text-white shadow-2xl border-b-4 border-orange-500">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Film className="w-10 h-10 text-orange-400 drop-shadow-lg" />
                <div className="absolute -inset-1 bg-orange-400 rounded-full opacity-20 blur"></div>
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-orange-300 via-yellow-200 to-orange-300">
                  VHS VAULT
                </h1>
                <p className="text-xs text-purple-200 font-mono tracking-wider">REWIND • PLAY • COLLECT</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 bg-purple-800/50 backdrop-blur-sm px-5 py-2.5 rounded-lg border border-purple-500/30">
                <User className="w-5 h-5 text-orange-300" />
                <span className="text-sm font-medium">{user.email}</span>
                {isAdmin && (
                  <span className="ml-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-purple-900 px-3 py-1 rounded-full text-xs font-black shadow-lg">
                    ADMIN
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 px-5 py-2.5 rounded-lg transition-all duration-300 flex items-center space-x-2 font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-[89px] z-30 bg-white shadow-lg border-b-2 border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-2 md:space-x-8 overflow-x-auto">
            {(isAdmin
              ? ['search', 'browse', 'collection', 'wishlist', 'marketplace', 'pending']
              : ['search', 'collection', 'wishlist', 'pending']
            ).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setView(tab);
                  setSelectedMaster(null);
                  setSelectedVariant(null);
                }}
                className={`py-5 px-4 border-b-4 font-bold transition-all duration-300 whitespace-nowrap capitalize text-sm tracking-wide ${
                  view === tab
                    ? 'border-orange-500 text-purple-700 bg-purple-50'
                    : 'border-transparent text-gray-500 hover:text-purple-600 hover:border-gray-300 hover:bg-gray-50'
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

      <div className="max-w-7xl mx-auto px-6 py-12">
        {view === 'search' && (
          <>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Local Database Search */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Search Your Collection
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search titles or directors..."
                    className="w-full pl-10 pr-4 py-3 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Search existing titles in the database</p>
              </div>

              {/* TMDB Search */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Find New Titles (TMDB)
                </label>
                <div className="relative tmdb-search-container">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-orange-400" />
                  <input
                    type="text"
                    value={tmdbSearchTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTmdbSearchTerm(value);
                      handleTitleSearch(value);
                    }}
                    onFocus={() => {
                      if (tmdbSearchResults.length > 0) {
                        setShowTmdbDropdown(true);
                      }
                    }}
                    placeholder="Search TMDB to add new titles..."
                    className="w-full pl-10 pr-4 py-3 border-2 border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    autoComplete="off"
                  />
                  {tmdbSearching && (
                    <div className="absolute z-50 w-full mt-1 bg-white border-2 border-orange-300 rounded-lg shadow-lg p-4 text-center">
                      <Loader className="w-6 h-6 animate-spin text-orange-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Searching TMDB...</p>
                    </div>
                  )}
                  {showTmdbDropdown && tmdbSearchResults.length > 0 && !tmdbSearching && (
                    <div className="absolute z-50 w-full mt-1 bg-white border-2 border-orange-300 rounded-lg shadow-2xl max-h-96 overflow-y-auto">
                      {tmdbSearchResults.map((movie) => (
                        <div
                          key={movie.id}
                          onClick={async (e) => {
                            e.stopPropagation();

                            try {
                              const response = await fetch(
                                `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`
                              );
                              const details = await response.json();

                              let director = '';
                              if (details.credits && details.credits.crew) {
                                const directorObj = details.credits.crew.find(person => person.job === 'Director');
                                director = directorObj ? directorObj.name : '';
                              }

                              let studio = '';
                              if (details.production_companies && details.production_companies.length > 0) {
                                studio = details.production_companies[0].name;
                              }

                              let genres = '';
                              if (details.genres && details.genres.length > 0) {
                                genres = details.genres.map(g => g.name).join(', ');
                              }

                              setNewSubmission({
                                masterTitle: movie.title,
                                year: movie.release_date ? movie.release_date.substring(0, 4) : '',
                                director: director,
                                studio: studio,
                                genre: genres,
                                variantFormat: 'VHS',
                                variantRegion: '',
                                variantRelease: '',
                                variantCaseType: '',
                                variantNotes: '',
                                variantBarcode: '',
                                imageCover: null,
                                imageBack: null,
                                imageSpine: null,
                                imageTapeLabel: null
                              });

                              setShowTmdbDropdown(false);
                              setTmdbSearchResults([]);
                              setTmdbSearchTerm('');
                              setSubmitType('master');
                              setShowSubmitModal(true);
                            } catch (error) {
                              console.error('Error fetching TMDB details:', error);
                              showToast('Error loading movie details. Please try again.', 'error');
                            }
                          }}
                          className="flex items-center p-3 hover:bg-orange-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition"
                        >
                          {movie.poster_path ? (
                            <img loading="lazy"
                              src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                              alt={movie.title}
                              className="w-12 h-18 object-cover rounded mr-3 flex-shrink-0 shadow"
                            />
                          ) : (
                            <div className="w-12 h-18 bg-gray-200 rounded mr-3 flex-shrink-0 flex items-center justify-center">
                              <Film className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-gray-900">{movie.title}</div>
                            <div className="text-sm text-gray-600">
                              {movie.release_date ? movie.release_date.substring(0, 4) : 'Unknown'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Search online movie database to add new titles</p>
              </div>
            </div>

            {selectedVariant ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => setSelectedVariant(null)}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    ← Back to variants
                  </button>
                </div>

                {/* Variant Detail Card */}
                <div className="bg-white rounded-xl shadow-2xl p-8 mb-8 border border-gray-100">
                  <div className="flex gap-6">
                    {/* Variant Images Gallery */}
                    {selectedVariant.variant_images && selectedVariant.variant_images.length > 0 ? (
                      <div className="flex-shrink-0">
                        <img loading="lazy"
                          src={selectedVariant.variant_images[0].image_url}
                          alt="Variant cover"
                          className="w-48 h-72 object-cover rounded-lg shadow-xl cursor-pointer hover:shadow-2xl hover:-translate-y-2 hover:rotate-2 transition-all duration-300 border-4 border-gray-800"
                          onClick={() => openImageGallery(selectedVariant.variant_images.map(img => img.image_url), 0)}
                        />
                        {selectedVariant.variant_images.length > 1 && (
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            {selectedVariant.variant_images.slice(1, 4).map((img, idx) => (
                              <img loading="lazy"
                                key={idx}
                                src={img.image_url}
                                alt={`Image ${idx + 2}`}
                                className="w-full h-20 object-cover rounded border-2 border-gray-300 cursor-pointer hover:border-purple-500 transition"
                                onClick={() => openImageGallery(selectedVariant.variant_images.map(img => img.image_url), idx + 1)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-48 h-72 bg-gradient-to-br from-purple-100 to-purple-200 rounded shadow-lg flex items-center justify-center flex-shrink-0">
                        <Film className="w-24 h-24 text-purple-400" />
                      </div>
                    )}

                    {/* Variant Details */}
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        {selectedMaster?.title || 'Unknown Title'}
                      </h2>
                      <p className="text-gray-600 mb-4">
                        {selectedMaster?.director} • {selectedMaster?.year} • {selectedMaster?.genre}
                      </p>

                      <div className="border-t pt-4 mb-4">
                        <h3 className="text-lg font-bold text-gray-700 mb-3">Variant Details</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Format</p>
                            <p className="text-gray-600">{selectedVariant.format}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Region</p>
                            <p className="text-gray-600">{selectedVariant.region}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Release Year</p>
                            <p className="text-gray-600">{selectedVariant.release_year}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Case Type</p>
                            <p className="text-gray-600">{selectedVariant.case_type}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Barcode</p>
                            <p className="text-gray-600">{selectedVariant.barcode || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Status</p>
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm inline-flex items-center space-x-1">
                              <Check className="w-3 h-3" />
                              <span>Verified</span>
                            </span>
                          </div>
                          {selectedVariant.notes && (
                            <div className="md:col-span-2">
                              <p className="text-sm font-semibold text-gray-700">Variant Notes</p>
                              <p className="text-gray-600 italic">{selectedVariant.notes}</p>
                            </div>
                          )}
                        </div>

                        {/* Advanced Fields - Only shown if filled out */}
                        {(selectedVariant.edition_type || selectedVariant.audio_language || selectedVariant.subtitles !== null || selectedVariant.original_rating || selectedVariant.aspect_ratio || selectedVariant.shell_color) && (
                          <div className="mt-4 pt-4 border-t">
                            <h4 className="text-md font-bold text-gray-700 mb-3">Advanced Attributes</h4>
                            <div className="grid md:grid-cols-2 gap-4">
                              {selectedVariant.edition_type && (
                                <div>
                                  <p className="text-sm font-semibold text-gray-700">Edition Type</p>
                                  <p className="text-gray-600">{selectedVariant.edition_type}</p>
                                </div>
                              )}
                              {selectedVariant.audio_language && (
                                <div>
                                  <p className="text-sm font-semibold text-gray-700">Audio Language</p>
                                  <p className="text-gray-600">{selectedVariant.audio_language}</p>
                                </div>
                              )}
                              {selectedVariant.subtitles !== null && (
                                <div>
                                  <p className="text-sm font-semibold text-gray-700">Subtitles</p>
                                  <p className="text-gray-600">{selectedVariant.subtitles ? 'Yes' : 'No'}</p>
                                </div>
                              )}
                              {selectedVariant.original_rating && (
                                <div>
                                  <p className="text-sm font-semibold text-gray-700">Original Rating</p>
                                  <p className="text-gray-600">{selectedVariant.original_rating}</p>
                                </div>
                              )}
                              {selectedVariant.aspect_ratio && (
                                <div>
                                  <p className="text-sm font-semibold text-gray-700">Aspect Ratio</p>
                                  <p className="text-gray-600">{selectedVariant.aspect_ratio}</p>
                                </div>
                              )}
                              {selectedVariant.shell_color && (
                                <div>
                                  <p className="text-sm font-semibold text-gray-700">Shell Color</p>
                                  <p className="text-gray-600">{selectedVariant.shell_color}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 border-t pt-4">
                        <button
                          onClick={() => {
                            if (isInCollection(selectedVariant.id)) {
                              removeFromCollection(selectedVariant.id);
                            } else {
                              showAddToCollectionModal(selectedMaster?.id, selectedVariant.id);
                            }
                          }}
                          className={`px-6 py-3 rounded-lg font-medium transition flex items-center space-x-2 ${
                            isInCollection(selectedVariant.id)
                              ? 'bg-red-500 text-white hover:bg-red-600'
                              : 'bg-purple-600 text-white hover:bg-purple-700'
                          }`}
                        >
                          {isInCollection(selectedVariant.id) ? (
                            <><X className="w-5 h-5" /><span>Remove from Collection</span></>
                          ) : (
                            <><Plus className="w-5 h-5" /><span>Add to Collection</span></>
                          )}
                        </button>
                        <button
                          onClick={() => toggleWishlist(selectedMaster?.id, selectedVariant.id)}
                          className={`px-6 py-3 rounded-lg font-medium transition flex items-center space-x-2 ${
                            isInWishlist(selectedVariant.id)
                              ? 'bg-pink-500 text-white hover:bg-pink-600'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          <Heart className={`w-5 h-5 ${isInWishlist(selectedVariant.id) ? 'fill-current' : ''}`} />
                          <span>{isInWishlist(selectedVariant.id) ? 'In Wishlist' : 'Add to Wishlist'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : !selectedMaster ? (
              <div>
                {searchTerm && (
                  <>
                    <h2 className="text-4xl font-bold text-gray-900 mb-8">Search Results</h2>
                    <div className="grid gap-6">
                      {filteredMasters.map(master => (
                        <div
                          key={master.id}
                          className="bg-white rounded-lg shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 p-6 cursor-pointer border border-gray-100"
                          onClick={async () => {
                            const variants = await loadVariantsForMaster(master.id);
                            setSelectedMaster({ ...master, variants });
                          }}
                        >
                          <div className="flex gap-4 items-start">
                            {master.poster_url ? (
                              <img loading="lazy"
                                src={master.poster_url}
                                alt={`${master.title} poster`}
                                className="w-24 h-36 object-cover rounded shadow-md flex-shrink-0"
                              />
                            ) : (
                              <div className="w-24 h-36 bg-gradient-to-br from-purple-100 to-purple-200 rounded shadow-md flex items-center justify-center flex-shrink-0">
                                <Film className="w-12 h-12 text-purple-400" />
                              </div>
                            )}
                            <div className="flex-1">
                              <h2 className="text-xl font-bold text-gray-800 mb-1">{master.title}</h2>
                              <p className="text-gray-600">{master.director} • {master.year} • {master.genre}</p>
                              <p className="text-sm text-gray-500 mt-1">{master.studio}</p>
                              <div className="flex items-center space-x-4 mt-3">
                                <div className="flex items-center space-x-1">
                                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                  <span className="font-medium">{master.avg_rating || 0}</span>
                                  <span className="text-gray-500 text-sm">({master.total_ratings || 0})</span>
                                </div>
                                <p className="text-sm text-purple-600">{master.variant_count || 0} variant(s)</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {filteredMasters.length === 0 && (
                        <div className="bg-gradient-to-br from-gray-50 to-purple-50 rounded-2xl shadow-xl p-16 text-center border-4 border-dashed border-gray-300">
                          <div className="relative inline-block mb-6">
                            <Film className="w-24 h-24 text-gray-400 mx-auto" />
                            <div className="absolute inset-0 bg-gray-400 rounded-full opacity-20 blur-xl"></div>
                          </div>
                          <h3 className="text-3xl font-bold text-gray-800 mb-3">No Matches Found</h3>
                          <p className="text-gray-600 text-lg mb-6">Try adjusting your search or use TMDB to add new titles</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {!searchTerm && (
                  <div className="bg-gradient-to-br from-purple-50 to-orange-50 rounded-2xl shadow-xl p-16 text-center border-4 border-dashed border-purple-300">
                    <div className="relative inline-block mb-6">
                      <Search className="w-24 h-24 text-purple-400 mx-auto" />
                      <div className="absolute inset-0 bg-purple-400 rounded-full opacity-20 blur-xl"></div>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800 mb-3">Start Your Search</h3>
                    <p className="text-gray-600 text-lg">Use the search bars above to find existing titles or discover new ones on TMDB</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => setSelectedMaster(null)}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    ← Back to list
                  </button>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingMaster(selectedMaster);
                          setNewSubmission({
                            ...newSubmission,
                            masterTitle: selectedMaster.title,
                            year: selectedMaster.year.toString(),
                            director: selectedMaster.director,
                            studio: selectedMaster.studio,
                            genre: selectedMaster.genre
                          });
                          setShowSubmitModal(true);
                          setSubmitType('master');
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center space-x-2"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit Master</span>
                      </button>
                      <button
                        onClick={() => deleteMasterRelease(selectedMaster.id)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center space-x-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Master</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                  <div className="flex gap-6 mb-4">
                    {selectedMaster.poster_url ? (
                      <img loading="lazy"
                        src={selectedMaster.poster_url}
                        alt={`${selectedMaster.title} poster`}
                        className="w-48 h-72 object-cover rounded shadow-lg flex-shrink-0 cursor-pointer hover:shadow-xl transition"
                        onClick={() => openImageGallery([selectedMaster.poster_url], 0)}
                      />
                    ) : (
                      <div className="w-48 h-72 bg-gradient-to-br from-purple-100 to-purple-200 rounded shadow-lg flex items-center justify-center flex-shrink-0">
                        <Film className="w-24 h-24 text-purple-400" />
                      </div>
                    )}
                    <div className="flex-1">
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
                  </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-bold text-gray-900">Variants ({selectedMaster.variants?.filter(v => v.approved).length || 0})</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Sort by:</span>
                      <select
                        value={sortVariantsBy}
                        onChange={(e) => setSortVariantsBy(e.target.value)}
                        className="text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="date">Release Date</option>
                        <option value="region">Region</option>
                        <option value="format">Format</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowSubmitModal(true); setSubmitType('variant'); }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Variant</span>
                  </button>
                </div>

                <div className="grid gap-4">
                  {loadingVariants ? (
                    // Loading skeleton
                    <>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 animate-pulse">
                          <div className="flex gap-4 items-start">
                            <div className="w-32 h-48 bg-gray-200 rounded flex-shrink-0"></div>
                            <div className="flex-1 space-y-3">
                              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                            </div>
                            <div className="flex flex-col space-y-2">
                              <div className="w-24 h-10 bg-gray-200 rounded"></div>
                              <div className="w-24 h-10 bg-gray-200 rounded"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    sortVariants(selectedMaster.variants?.filter(v => v.approved)).map(variant => {
                    const inColl = isInCollection(variant.id);
                    const inWish = isInWishlist(variant.id);
                    return (
                      <div key={variant.id} className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 p-6 border border-gray-100">
                        <div className="flex gap-4 items-start">
                          {/* Variant Images - Left Side */}
                          {variant.variant_images && variant.variant_images.length > 0 ? (
                            <div className="flex-shrink-0">
                              <img loading="lazy"
                                src={variant.variant_images[0].image_url}
                                alt="Variant cover"
                                className="w-32 h-48 object-cover rounded shadow-md cursor-pointer hover:shadow-lg transition"
                                onClick={() => openImageGallery(variant.variant_images.map(img => img.image_url), 0)}
                              />
                              {variant.variant_images.length > 1 && (
                                <div className="flex mt-2 space-x-1">
                                  {variant.variant_images.slice(1, 4).map((img, idx) => (
                                    <img loading="lazy"
                                      key={idx}
                                      src={img.image_url}
                                      alt={`Variant ${idx + 2}`}
                                      className="w-10 h-10 object-cover rounded border border-gray-300 cursor-pointer hover:border-purple-500 transition"
                                      onClick={() => openImageGallery(variant.variant_images.map(img => img.image_url), idx + 1)}
                                    />
                                  ))}
                                  {variant.variant_images.length > 4 && (
                                    <div className="w-10 h-10 bg-gray-200 rounded border border-gray-300 flex items-center justify-center text-gray-600 text-xs font-medium">
                                      +{variant.variant_images.length - 4}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="w-32 h-48 bg-gradient-to-br from-purple-100 to-purple-200 rounded shadow-md flex items-center justify-center flex-shrink-0">
                              <Film className="w-16 h-16 text-purple-400" />
                            </div>
                          )}

                          {/* Variant Info - Center */}
                          <div
                            className="flex-1 cursor-pointer hover:bg-gray-50 rounded p-2 -m-2 transition"
                            onClick={() => setSelectedVariant(variant)}
                          >
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
                              <span className="font-semibold">Case Type:</span> {variant.case_type}
                            </p>
                            <p className="text-gray-700 mb-1">
                              <span className="font-semibold">Barcode:</span> {variant.barcode}
                            </p>
                            {variant.notes && (
                              <p className="text-gray-600 text-sm mt-2">
                                <span className="font-semibold">Variant Notes:</span> <span className="italic">{variant.notes}</span>
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              {variant.votes_up || 0} 👍 {variant.votes_down || 0} 👎
                            </p>
                          </div>

                          {/* Action Buttons - Right Side */}
                          <div className="flex flex-col space-y-2 flex-shrink-0">
                            <button
                              onClick={() => {
                                if (inColl) {
                                  removeFromCollection(variant.id);
                                } else {
                                  showAddToCollectionModal(selectedMaster.id, variant.id);
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
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingVariant(variant);

                                    // Pre-populate existing images based on image_order
                                    const images = variant.variant_images || [];
                                    const coverImg = images.find(img => img.image_order === 0);
                                    const backImg = images.find(img => img.image_order === 1);
                                    const spineImg = images.find(img => img.image_order === 2);
                                    const tapeImg = images.find(img => img.image_order === 3);

                                    setNewSubmission({
                                      ...newSubmission,
                                      variantFormat: variant.format,
                                      variantRegion: variant.region,
                                      variantRelease: variant.release_year,
                                      variantCaseType: variant.case_type,
                                      variantNotes: variant.notes || '',
                                      variantBarcode: variant.barcode || '',
                                      editionType: variant.edition_type || '',
                                      audioLanguage: variant.audio_language || '',
                                      subtitles: variant.subtitles,
                                      originalRating: variant.original_rating || '',
                                      aspectRatio: variant.aspect_ratio || '',
                                      shellColor: variant.shell_color || '',
                                      imageCover: coverImg ? { preview: coverImg.image_url, existing: true } : null,
                                      imageBack: backImg ? { preview: backImg.image_url, existing: true } : null,
                                      imageSpine: spineImg ? { preview: spineImg.image_url, existing: true } : null,
                                      imageTapeLabel: tapeImg ? { preview: tapeImg.image_url, existing: true } : null
                                    });
                                    setShowSubmitModal(true);
                                    setSubmitType('variant');
                                  }}
                                  className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                                  title="Edit variant"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteVariant(variant.id)}
                                  className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                                  title="Delete variant"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                  )}
                </div>
              </div>
            )}
          </>
        )}

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

            {selectedVariant ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => setSelectedVariant(null)}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    ← Back to variants
                  </button>
                </div>

                {/* Variant Detail Card */}
                <div className="bg-white rounded-xl shadow-2xl p-8 mb-8 border border-gray-100">
                  <div className="flex gap-6">
                    {/* Variant Images Gallery */}
                    {selectedVariant.variant_images && selectedVariant.variant_images.length > 0 ? (
                      <div className="flex-shrink-0">
                        <img loading="lazy"
                          src={selectedVariant.variant_images[0].image_url}
                          alt="Variant cover"
                          className="w-48 h-72 object-cover rounded-lg shadow-xl cursor-pointer hover:shadow-2xl hover:-translate-y-2 hover:rotate-2 transition-all duration-300 border-4 border-gray-800"
                          onClick={() => openImageGallery(selectedVariant.variant_images.map(img => img.image_url), 0)}
                        />
                        {selectedVariant.variant_images.length > 1 && (
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            {selectedVariant.variant_images.slice(1, 4).map((img, idx) => (
                              <img loading="lazy"
                                key={idx}
                                src={img.image_url}
                                alt={`Image ${idx + 2}`}
                                className="w-full h-20 object-cover rounded border-2 border-gray-300 cursor-pointer hover:border-purple-500 transition"
                                onClick={() => openImageGallery(selectedVariant.variant_images.map(img => img.image_url), idx + 1)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-48 h-72 bg-gradient-to-br from-purple-100 to-purple-200 rounded shadow-lg flex items-center justify-center flex-shrink-0">
                        <Film className="w-24 h-24 text-purple-400" />
                      </div>
                    )}

                    {/* Variant Details */}
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        {selectedMaster?.title || 'Unknown Title'}
                      </h2>
                      <p className="text-gray-600 mb-4">
                        {selectedMaster?.director} • {selectedMaster?.year} • {selectedMaster?.genre}
                      </p>

                      <div className="border-t pt-4 mb-4">
                        <h3 className="text-lg font-bold text-gray-700 mb-3">Variant Details</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Format</p>
                            <p className="text-gray-600">{selectedVariant.format}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Region</p>
                            <p className="text-gray-600">{selectedVariant.region}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Release Year</p>
                            <p className="text-gray-600">{selectedVariant.release_year}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Case Type</p>
                            <p className="text-gray-600">{selectedVariant.case_type}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Barcode</p>
                            <p className="text-gray-600">{selectedVariant.barcode || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Status</p>
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm inline-flex items-center space-x-1">
                              <Check className="w-3 h-3" />
                              <span>Verified</span>
                            </span>
                          </div>
                          {selectedVariant.notes && (
                            <div className="md:col-span-2">
                              <p className="text-sm font-semibold text-gray-700">Variant Notes</p>
                              <p className="text-gray-600 italic">{selectedVariant.notes}</p>
                            </div>
                          )}
                        </div>

                        {/* Advanced Fields - Only shown if filled out */}
                        {(selectedVariant.edition_type || selectedVariant.audio_language || selectedVariant.subtitles !== null || selectedVariant.original_rating || selectedVariant.aspect_ratio || selectedVariant.shell_color) && (
                          <div className="mt-4 pt-4 border-t">
                            <h4 className="text-md font-bold text-gray-700 mb-3">Advanced Attributes</h4>
                            <div className="grid md:grid-cols-2 gap-4">
                              {selectedVariant.edition_type && (
                                <div>
                                  <p className="text-sm font-semibold text-gray-700">Edition Type</p>
                                  <p className="text-gray-600">{selectedVariant.edition_type}</p>
                                </div>
                              )}
                              {selectedVariant.audio_language && (
                                <div>
                                  <p className="text-sm font-semibold text-gray-700">Audio Language</p>
                                  <p className="text-gray-600">{selectedVariant.audio_language}</p>
                                </div>
                              )}
                              {selectedVariant.subtitles !== null && (
                                <div>
                                  <p className="text-sm font-semibold text-gray-700">Subtitles</p>
                                  <p className="text-gray-600">{selectedVariant.subtitles ? 'Yes' : 'No'}</p>
                                </div>
                              )}
                              {selectedVariant.original_rating && (
                                <div>
                                  <p className="text-sm font-semibold text-gray-700">Original Rating</p>
                                  <p className="text-gray-600">{selectedVariant.original_rating}</p>
                                </div>
                              )}
                              {selectedVariant.aspect_ratio && (
                                <div>
                                  <p className="text-sm font-semibold text-gray-700">Aspect Ratio</p>
                                  <p className="text-gray-600">{selectedVariant.aspect_ratio}</p>
                                </div>
                              )}
                              {selectedVariant.shell_color && (
                                <div>
                                  <p className="text-sm font-semibold text-gray-700">Shell Color</p>
                                  <p className="text-gray-600">{selectedVariant.shell_color}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 border-t pt-4">
                        <button
                          onClick={() => {
                            if (isInCollection(selectedVariant.id)) {
                              removeFromCollection(selectedVariant.id);
                            } else {
                              showAddToCollectionModal(selectedMaster?.id, selectedVariant.id);
                            }
                          }}
                          className={`px-6 py-3 rounded-lg font-medium transition flex items-center space-x-2 ${
                            isInCollection(selectedVariant.id)
                              ? 'bg-red-500 text-white hover:bg-red-600'
                              : 'bg-purple-600 text-white hover:bg-purple-700'
                          }`}
                        >
                          {isInCollection(selectedVariant.id) ? (
                            <><X className="w-5 h-5" /><span>Remove from Collection</span></>
                          ) : (
                            <><Plus className="w-5 h-5" /><span>Add to Collection</span></>
                          )}
                        </button>
                        <button
                          onClick={() => toggleWishlist(selectedMaster?.id, selectedVariant.id)}
                          className={`px-6 py-3 rounded-lg font-medium transition flex items-center space-x-2 ${
                            isInWishlist(selectedVariant.id)
                              ? 'bg-pink-500 text-white hover:bg-pink-600'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          <Heart className={`w-5 h-5 ${isInWishlist(selectedVariant.id) ? 'fill-current' : ''}`} />
                          <span>{isInWishlist(selectedVariant.id) ? 'In Wishlist' : 'Add to Wishlist'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : !selectedMaster ? (
              <div className="grid gap-4">
                {filteredMasters.map(master => (
                  <div
                    key={master.id}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition p-6 cursor-pointer"
                    onClick={async () => {
                      const variants = await loadVariantsForMaster(master.id);
                      setSelectedMaster({ ...master, variants });
                    }}
                  >
                    <div className="flex gap-4 items-start">
                      {master.poster_url ? (
                        <img loading="lazy"
                          src={master.poster_url}
                          alt={`${master.title} poster`}
                          className="w-24 h-36 object-cover rounded shadow-md flex-shrink-0"
                        />
                      ) : (
                        <div className="w-24 h-36 bg-gradient-to-br from-purple-100 to-purple-200 rounded shadow-md flex items-center justify-center flex-shrink-0">
                          <Film className="w-12 h-12 text-purple-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-800 mb-1">{master.title}</h2>
                        <p className="text-gray-600">{master.director} • {master.year} • {master.genre}</p>
                        <p className="text-sm text-gray-500 mt-1">{master.studio}</p>
                        <div className="flex items-center space-x-4 mt-3">
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="font-medium">{master.avg_rating || 0}</span>
                            <span className="text-gray-500 text-sm">({master.total_ratings || 0})</span>
                          </div>
                          <p className="text-sm text-purple-600">{master.variant_count || 0} variant(s)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredMasters.length === 0 && (
                  <div className="bg-gradient-to-br from-gray-50 to-purple-50 rounded-2xl shadow-xl p-16 text-center border-4 border-dashed border-gray-300">
                    <div className="relative inline-block mb-6">
                      <Film className="w-24 h-24 text-gray-400 mx-auto" />
                      <div className="absolute inset-0 bg-gray-400 rounded-full opacity-20 blur-xl"></div>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800 mb-3">No Titles Found</h3>
                    <p className="text-gray-600 text-lg mb-6">Try a different search or add a new title</p>
                    <button
                      onClick={() => { setShowSubmitModal(true); setSubmitType('master'); }}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-lg font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                    >
                      Add New Title
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => setSelectedMaster(null)}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    ← Back to list
                  </button>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingMaster(selectedMaster);
                          setNewSubmission({
                            masterTitle: selectedMaster.title,
                            year: selectedMaster.year,
                            director: selectedMaster.director,
                            studio: selectedMaster.studio,
                            genre: selectedMaster.genre,
                            variantFormat: 'VHS',
                            variantRegion: '',
                            variantRelease: '',
                            variantCaseType: '',
                            variantNotes: '',
                            variantBarcode: '',
                            imageCover: null,
                            imageBack: null,
                            imageSpine: null,
                            imageTapeLabel: null
                          });
                          setShowSubmitModal(true);
                          setSubmitType('master');
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => deleteMasterRelease(selectedMaster.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center space-x-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                  <div className="flex gap-6 mb-4">
                    {selectedMaster.poster_url ? (
                      <img loading="lazy"
                        src={selectedMaster.poster_url}
                        alt={`${selectedMaster.title} poster`}
                        className="w-48 h-72 object-cover rounded shadow-lg flex-shrink-0 cursor-pointer hover:shadow-xl transition"
                        onClick={() => openImageGallery([selectedMaster.poster_url], 0)}
                      />
                    ) : (
                      <div className="w-48 h-72 bg-gradient-to-br from-purple-100 to-purple-200 rounded shadow-lg flex items-center justify-center flex-shrink-0">
                        <Film className="w-24 h-24 text-purple-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h1 className="text-3xl font-bold text-gray-800 mb-2">{selectedMaster.title}</h1>
                      <p className="text-gray-600 mb-4">{selectedMaster.director} • {selectedMaster.year} • {selectedMaster.genre}</p>
                      <p className="text-gray-700 mb-2"><span className="font-semibold">Studio:</span> {selectedMaster.studio}</p>
                      <div className="flex items-center space-x-1 mb-4">
                        <Star className="w-5 h-5 text-yellow-500 fill-current" />
                        <span className="font-medium text-lg">{selectedMaster.avg_rating || 0}</span>
                        <span className="text-gray-500">({selectedMaster.total_ratings || 0} ratings)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-2xl font-bold text-gray-800">Variants</h2>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Sort by:</span>
                        <select
                          value={sortVariantsBy}
                          onChange={(e) => setSortVariantsBy(e.target.value)}
                          className="text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="date">Release Date</option>
                          <option value="region">Region</option>
                          <option value="format">Format</option>
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => { setShowSubmitModal(true); setSubmitType('variant'); }}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Variant</span>
                    </button>
                  </div>

                  <div className="grid gap-4">
                    {sortVariants(selectedMaster.variants?.filter(v => v.approved)).map(variant => {
                      const inColl = isInCollection(variant.id);
                      const inWish = isInWishlist(variant.id);
                      return (
                        <div key={variant.id} className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 p-6 border border-gray-100">
                          <div className="flex gap-4 items-start">
                            {/* Variant Images - Left Side */}
                            {variant.variant_images && variant.variant_images.length > 0 ? (
                              <div className="flex-shrink-0">
                                <img loading="lazy"
                                  src={variant.variant_images[0].image_url}
                                  alt="Variant cover"
                                  className="w-32 h-48 object-cover rounded shadow-md cursor-pointer hover:shadow-lg transition"
                                  onClick={() => openImageGallery(variant.variant_images.map(img => img.image_url), 0)}
                                />
                                {variant.variant_images.length > 1 && (
                                  <div className="flex mt-2 space-x-1">
                                    {variant.variant_images.slice(1, 4).map((img, idx) => (
                                      <img loading="lazy"
                                        key={idx}
                                        src={img.image_url}
                                        alt={`Variant ${idx + 2}`}
                                        className="w-10 h-10 object-cover rounded border border-gray-300 cursor-pointer hover:border-purple-500 transition"
                                        onClick={() => openImageGallery(variant.variant_images.map(img => img.image_url), idx + 1)}
                                      />
                                    ))}
                                    {variant.variant_images.length > 4 && (
                                      <div className="w-10 h-10 bg-gray-200 rounded border border-gray-300 flex items-center justify-center text-gray-600 text-xs font-medium">
                                        +{variant.variant_images.length - 4}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="w-32 h-48 bg-gradient-to-br from-purple-100 to-purple-200 rounded shadow-md flex items-center justify-center flex-shrink-0">
                                <Film className="w-16 h-16 text-purple-400" />
                              </div>
                            )}

                            {/* Variant Info - Center */}
                            <div
                              className="flex-1 cursor-pointer hover:bg-gray-50 rounded p-2 -m-2 transition"
                              onClick={() => setSelectedVariant(variant)}
                            >
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
                                <span className="font-semibold">Case Type:</span> {variant.case_type}
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

                            {/* Action Buttons - Right Side */}
                            <div className="flex flex-col space-y-2 flex-shrink-0">
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
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingVariant(variant);

                                      // Pre-populate existing images based on image_order
                                      const images = variant.variant_images || [];
                                      const coverImg = images.find(img => img.image_order === 0);
                                      const backImg = images.find(img => img.image_order === 1);
                                      const spineImg = images.find(img => img.image_order === 2);
                                      const tapeImg = images.find(img => img.image_order === 3);

                                      setNewSubmission({
                                        ...newSubmission,
                                        variantFormat: variant.format,
                                        variantRegion: variant.region,
                                        variantRelease: variant.release_year,
                                        variantCaseType: variant.case_type,
                                        variantNotes: variant.notes || '',
                                        variantBarcode: variant.barcode || '',
                                        imageCover: coverImg ? { preview: coverImg.image_url, existing: true } : null,
                                        imageBack: backImg ? { preview: backImg.image_url, existing: true } : null,
                                        imageSpine: spineImg ? { preview: spineImg.image_url, existing: true } : null,
                                        imageTapeLabel: tapeImg ? { preview: tapeImg.image_url, existing: true } : null
                                      });
                                      setShowSubmitModal(true);
                                      setSubmitType('variant');
                                    }}
                                    className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                                    title="Edit variant"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteVariant(variant.id)}
                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                                    title="Delete variant"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {view === 'collection' && (
          <>
            <h2 className="text-4xl font-bold text-gray-900 mb-8">My Collection</h2>
            {collection.length === 0 ? (
              <div className="bg-gradient-to-br from-purple-50 to-orange-50 rounded-2xl shadow-xl p-16 text-center border-4 border-dashed border-purple-300">
                <div className="relative inline-block mb-6">
                  <Film className="w-24 h-24 text-purple-400 mx-auto" />
                  <div className="absolute inset-0 bg-purple-400 rounded-full opacity-20 blur-xl"></div>
                </div>
                <h3 className="text-3xl font-bold text-gray-800 mb-3">Your Vault is Empty!</h3>
                <p className="text-gray-600 text-lg mb-6">Time to start building your VHS empire</p>
                <button
                  onClick={() => setView('search')}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 py-4 rounded-lg font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                >
                  Browse Tapes
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {getCollectionItems().map((item, idx) => (
                  <div key={idx} className="bg-white rounded-lg shadow p-6">
                    <div className="flex gap-4 items-start">
                      {/* Variant Images - Left Side */}
                      {item.variant.variant_images && item.variant.variant_images.length > 0 ? (
                        <div className="flex-shrink-0">
                          <img loading="lazy"
                            src={item.variant.variant_images[0].image_url}
                            alt="Variant cover"
                            className="w-32 h-48 object-cover rounded shadow-md cursor-pointer hover:shadow-lg transition"
                            onClick={() => openImageGallery(item.variant.variant_images.map(img => img.image_url), 0)}
                          />
                          {item.variant.variant_images.length > 1 && (
                            <div className="flex mt-2 space-x-1">
                              {item.variant.variant_images.slice(1, 4).map((img, imgIdx) => (
                                <img loading="lazy"
                                  key={imgIdx}
                                  src={img.image_url}
                                  alt={`Variant ${imgIdx + 2}`}
                                  className="w-10 h-10 object-cover rounded border border-gray-300 cursor-pointer hover:border-purple-500 transition"
                                  onClick={() => openImageGallery(item.variant.variant_images.map(img => img.image_url), imgIdx + 1)}
                                />
                              ))}
                              {item.variant.variant_images.length > 4 && (
                                <div className="w-10 h-10 bg-gray-200 rounded border border-gray-300 flex items-center justify-center text-gray-600 text-xs font-medium">
                                  +{item.variant.variant_images.length - 4}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-32 h-48 bg-gradient-to-br from-purple-100 to-purple-200 rounded shadow-md flex items-center justify-center flex-shrink-0">
                          <Film className="w-16 h-16 text-purple-400" />
                        </div>
                      )}

                      {/* Variant Info - Center */}
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
                        <p className="text-gray-700 text-sm mb-3">
                          {item.variant.release_year} • {item.variant.case_type}
                        </p>

                        {/* Personal Collection Details */}
                        {(collection.find(c => c.variant_id === item.variant.id)?.condition || collection.find(c => c.variant_id === item.variant.id)?.notes) && (
                          <div className="border-t pt-3 mt-3">
                            {collection.find(c => c.variant_id === item.variant.id)?.condition && (
                              <div className="mb-2">
                                <span className="text-sm font-semibold text-gray-700">Condition: </span>
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm">
                                  {collection.find(c => c.variant_id === item.variant.id).condition}
                                </span>
                              </div>
                            )}
                            {collection.find(c => c.variant_id === item.variant.id)?.notes && (
                              <div>
                                <p className="text-sm font-semibold text-gray-700">My Notes:</p>
                                <p className="text-sm text-gray-600 italic mt-1">
                                  {collection.find(c => c.variant_id === item.variant.id).notes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Remove Button - Right Side */}
                      <button
                        onClick={() => removeFromCollection(item.variant.id)}
                        className="flex-shrink-0 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center space-x-2"
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
            <h2 className="text-4xl font-bold text-gray-900 mb-8">My Wishlist</h2>
            {wishlist.length === 0 ? (
              <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl shadow-xl p-16 text-center border-4 border-dashed border-pink-300">
                <div className="relative inline-block mb-6">
                  <Heart className="w-24 h-24 text-pink-400 mx-auto" />
                  <div className="absolute inset-0 bg-pink-400 rounded-full opacity-20 blur-xl"></div>
                </div>
                <h3 className="text-3xl font-bold text-gray-800 mb-3">No Wishlist Items Yet</h3>
                <p className="text-gray-600 text-lg mb-6">Start building your dream collection</p>
                <button
                  onClick={() => setView('search')}
                  className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white px-8 py-4 rounded-lg font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                >
                  Find Tapes
                </button>
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
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-bold text-gray-800">Pending Submissions</h2>
              {isAdmin && (
                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                  Admin Mode
                </span>
              )}
            </div>
            <p className="text-gray-600 mb-6">
              {isAdmin
                ? 'Review and approve/reject community submissions'
                : 'Vote on community submissions to help maintain database quality'
              }
            </p>
            {pendingSubmissions.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">No pending submissions</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pendingSubmissions.map(submission => {
                  const userVote = userVotes[submission.id];
                  return (
                    <div key={submission.id} className="bg-white rounded-lg shadow p-6">
                      <div className="flex items-start justify-between mb-4">
                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                          Pending Review
                        </span>
                        {isAdmin ? (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => approveSubmission(submission.id)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center space-x-2"
                            >
                              <Check className="w-4 h-4" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => rejectSubmission(submission.id)}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center space-x-2"
                            >
                              <X className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleVote(submission.id, 'up')}
                              className={`p-2 rounded-lg transition ${
                                userVote === 'up'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-green-100'
                              }`}
                            >
                              <ThumbsUp className="w-5 h-5" />
                            </button>
                            <span className="text-sm font-medium">{submission.votes_up || 0}</span>
                            <button
                              onClick={() => handleVote(submission.id, 'down')}
                              className={`p-2 rounded-lg transition ${
                                userVote === 'down'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-red-100'
                              }`}
                            >
                              <ThumbsDown className="w-5 h-5" />
                            </button>
                            <span className="text-sm font-medium">{submission.votes_down || 0}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-4 items-start">
                        {/* Variant Images - Left Side */}
                        {submission.variant_images && submission.variant_images.length > 0 ? (
                          <div className="flex-shrink-0">
                            <img loading="lazy"
                              src={submission.variant_images[0].image_url}
                              alt="Variant cover"
                              className="w-32 h-48 object-cover rounded shadow-md cursor-pointer hover:shadow-lg transition"
                              onClick={() => openImageGallery(submission.variant_images.map(img => img.image_url), 0)}
                            />
                            {submission.variant_images.length > 1 && (
                              <div className="flex mt-2 space-x-1">
                                {submission.variant_images.slice(1, 4).map((img, idx) => (
                                  <img loading="lazy"
                                    key={idx}
                                    src={img.image_url}
                                    alt={`Variant ${idx + 2}`}
                                    className="w-10 h-10 object-cover rounded border border-gray-300 cursor-pointer hover:border-purple-500 transition"
                                    onClick={() => openImageGallery(submission.variant_images.map(img => img.image_url), idx + 1)}
                                  />
                                ))}
                                {submission.variant_images.length > 4 && (
                                  <div className="w-10 h-10 bg-gray-200 rounded border border-gray-300 flex items-center justify-center text-gray-600 text-xs font-medium">
                                    +{submission.variant_images.length - 4}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-32 h-48 bg-gradient-to-br from-purple-100 to-purple-200 rounded shadow-md flex items-center justify-center flex-shrink-0">
                            <Film className="w-16 h-16 text-purple-400" />
                          </div>
                        )}

                        {/* Variant Info - Center/Right */}
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-800 mb-3">
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
                              <p className="text-sm font-semibold text-gray-700 mb-1">Case Type</p>
                              <p className="text-gray-600">{submission.case_type}</p>
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

                          {!isAdmin && (
                            <div className="pt-4 border-t">
                              <p className="text-xs text-gray-500">
                                Community votes: {submission.votes_up || 0} 👍 {submission.votes_down || 0} 👎
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                  {editingMaster
                    ? 'Edit Master Release'
                    : editingVariant
                      ? 'Edit Variant'
                      : submitType === 'master'
                        ? 'Submit New Title'
                        : 'Submit New Variant'}
                </h2>
                <button
                  onClick={() => {
                    setShowSubmitModal(false);
                    setEditingMaster(null);
                    setEditingVariant(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {submitType === 'master' && (
                  <>
                    <div className="relative tmdb-search-container">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                      <input
                        type="text"
                        value={newSubmission.masterTitle}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewSubmission({...newSubmission, masterTitle: value});
                          handleTitleSearch(value);
                        }}
                        onFocus={() => {
                          if (tmdbSearchResults.length > 0) {
                            setShowTmdbDropdown(true);
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Search for movie on TMDB..."
                        autoComplete="off"
                      />
                      {showTmdbDropdown && tmdbSearchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                          {tmdbSearchResults.map((movie) => (
                            <div
                              key={movie.id}
                              onClick={() => selectTmdbMovie(movie)}
                              className="flex items-center p-3 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              {movie.poster_path ? (
                                <img loading="lazy"
                                  src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                                  alt={movie.title}
                                  className="w-12 h-18 object-cover rounded mr-3"
                                />
                              ) : (
                                <div className="w-12 h-18 bg-gray-200 rounded mr-3 flex items-center justify-center">
                                  <Film className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{movie.title}</p>
                                <p className="text-sm text-gray-500">
                                  {movie.release_date ? movie.release_date.substring(0, 4) : 'N/A'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                        <input
                          type="text"
                          value={newSubmission.year}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Only allow numbers and limit to 4 digits
                            if (value === '' || (/^\d{0,4}$/.test(value))) {
                              setNewSubmission({...newSubmission, year: value});
                            }
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="1999"
                          maxLength="4"
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

                {!editingMaster && (
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
                        <select
                          value={newSubmission.variantRegion}
                          onChange={(e) => setNewSubmission({...newSubmission, variantRegion: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">Select Region</option>
                          <option value="NTSC (USA)">NTSC (USA)</option>
                          <option value="NTSC (Japan)">NTSC (Japan)</option>
                          <option value="NTSC (Canada)">NTSC (Canada)</option>
                          <option value="PAL (UK)">PAL (UK)</option>
                          <option value="PAL (Europe)">PAL (Europe)</option>
                          <option value="PAL (Australia)">PAL (Australia)</option>
                          <option value="SECAM (France)">SECAM (France)</option>
                          <option value="SECAM (Russia)">SECAM (Russia)</option>
                          <option value="Multi-Region">Multi-Region</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Release Year</label>
                        <input
                          type="text"
                          value={newSubmission.variantRelease}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Only allow numbers and limit to 4 digits
                            if (value === '' || (/^\d{0,4}$/.test(value))) {
                              setNewSubmission({...newSubmission, variantRelease: value});
                            }
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="1999"
                          maxLength="4"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Case Type</label>
                        <select
                          value={newSubmission.variantCaseType}
                          onChange={(e) => setNewSubmission({...newSubmission, variantCaseType: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">Select Case Type</option>
                          <option value="Slipcase">Slipcase</option>
                          <option value="Clamshell">Clamshell</option>
                          <option value="Big Box">Big Box</option>
                          <option value="Other">Other</option>
                        </select>
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">Variant Notes (Optional)</label>
                      <textarea
                        value={newSubmission.variantNotes}
                        onChange={(e) => setNewSubmission({...newSubmission, variantNotes: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        rows="3"
                        placeholder="Release-specific notes (e.g., special edition features, rental version, etc.)"
                      />
                    </div>

                    {/* Advanced Fields Section */}
                    <div className="border-t pt-4">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                        className="flex items-center justify-between w-full text-left text-sm font-semibold text-gray-700 hover:text-purple-600 transition"
                      >
                        <span>Advanced Fields (Optional)</span>
                        <ChevronRight className={`w-5 h-5 transition-transform ${showAdvancedFields ? 'rotate-90' : ''}`} />
                      </button>

                      {showAdvancedFields && (
                        <div className="mt-4 space-y-4 pl-4 border-l-2 border-purple-200">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Edition Type</label>
                              <select
                                value={newSubmission.editionType}
                                onChange={(e) => setNewSubmission({...newSubmission, editionType: e.target.value})}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select Edition Type</option>
                                <option value="Retail">Retail</option>
                                <option value="Promotional">Promotional</option>
                                <option value="Screener">Screener</option>
                                <option value="Bootleg">Bootleg</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Audio Language</label>
                              <select
                                value={newSubmission.audioLanguage}
                                onChange={(e) => setNewSubmission({...newSubmission, audioLanguage: e.target.value})}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select Language</option>
                                <option value="English">English</option>
                                <option value="Spanish">Spanish</option>
                                <option value="French">French</option>
                                <option value="Japanese">Japanese</option>
                                <option value="Chinese">Chinese</option>
                                <option value="German">German</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Subtitles</label>
                              <select
                                value={newSubmission.subtitles === null ? '' : newSubmission.subtitles.toString()}
                                onChange={(e) => setNewSubmission({...newSubmission, subtitles: e.target.value === '' ? null : e.target.value === 'true'})}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Unknown</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Original Rating</label>
                              <select
                                value={newSubmission.originalRating}
                                onChange={(e) => setNewSubmission({...newSubmission, originalRating: e.target.value})}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select Rating</option>
                                <option value="G">G</option>
                                <option value="PG">PG</option>
                                <option value="PG-13">PG-13</option>
                                <option value="R">R</option>
                                <option value="NC-17">NC-17</option>
                                <option value="18+">18+</option>
                                <option value="Not Rated">Not Rated</option>
                                <option value="Unrated">Unrated</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Aspect Ratio</label>
                              <select
                                value={newSubmission.aspectRatio}
                                onChange={(e) => setNewSubmission({...newSubmission, aspectRatio: e.target.value})}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select Aspect Ratio</option>
                                <option value="4:3 (Fullscreen)">4:3 (Fullscreen)</option>
                                <option value="1.85:1 (Widescreen)">1.85:1 (Widescreen)</option>
                                <option value="2.35:1 (Widescreen)">2.35:1 (Widescreen)</option>
                                <option value="Letterboxed">Letterboxed</option>
                                <option value="Open Matte">Open Matte</option>
                                <option value="Pan & Scan">Pan & Scan</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Shell Color</label>
                              <select
                                value={newSubmission.shellColor}
                                onChange={(e) => setNewSubmission({...newSubmission, shellColor: e.target.value})}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select Shell Color</option>
                                <option value="Black">Black</option>
                                <option value="Clear">Clear</option>
                                <option value="White">White</option>
                                <option value="Gray">Gray</option>
                                <option value="Blue">Blue</option>
                                <option value="Red">Red</option>
                                <option value="Green">Green</option>
                                <option value="Yellow">Yellow</option>
                                <option value="Orange">Orange</option>
                                <option value="Purple">Purple</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Upload Images
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Cover Image */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Cover</label>
                          {newSubmission.imageCover ? (
                            <div className="relative group">
                              <img loading="lazy"
                                src={newSubmission.imageCover.preview}
                                alt="Cover preview"
                                className="w-full h-32 object-cover rounded border-2 border-gray-300"
                              />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'imageCover')}
                                className="hidden"
                                id="image-cover-replace"
                              />
                              <label
                                htmlFor="image-cover-replace"
                                className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                              >
                                <span className="text-white font-medium text-sm">
                                  {editingVariant && newSubmission.imageCover.existing ? 'Replace' : 'Change'}
                                </span>
                              </label>
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-400 transition">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'imageCover')}
                                className="hidden"
                                id="image-cover"
                              />
                              <label htmlFor="image-cover" className="cursor-pointer">
                                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                                <p className="text-xs text-gray-500">Click to upload</p>
                              </label>
                            </div>
                          )}
                        </div>

                        {/* Back Image */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Back</label>
                          {newSubmission.imageBack ? (
                            <div className="relative group">
                              <img loading="lazy"
                                src={newSubmission.imageBack.preview}
                                alt="Back preview"
                                className="w-full h-32 object-cover rounded border-2 border-gray-300"
                              />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'imageBack')}
                                className="hidden"
                                id="image-back-replace"
                              />
                              <label
                                htmlFor="image-back-replace"
                                className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                              >
                                <span className="text-white font-medium text-sm">
                                  {editingVariant && newSubmission.imageBack.existing ? 'Replace' : 'Change'}
                                </span>
                              </label>
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-400 transition">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'imageBack')}
                                className="hidden"
                                id="image-back"
                              />
                              <label htmlFor="image-back" className="cursor-pointer">
                                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                                <p className="text-xs text-gray-500">Click to upload</p>
                              </label>
                            </div>
                          )}
                        </div>

                        {/* Spine Image */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Spine (Optional)</label>
                          {newSubmission.imageSpine ? (
                            <div className="relative group">
                              <img loading="lazy"
                                src={newSubmission.imageSpine.preview}
                                alt="Spine preview"
                                className="w-full h-32 object-cover rounded border-2 border-gray-300"
                              />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'imageSpine')}
                                className="hidden"
                                id="image-spine-replace"
                              />
                              <label
                                htmlFor="image-spine-replace"
                                className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                              >
                                <span className="text-white font-medium text-sm">
                                  {editingVariant && newSubmission.imageSpine.existing ? 'Replace' : 'Change'}
                                </span>
                              </label>
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-400 transition">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'imageSpine')}
                                className="hidden"
                                id="image-spine"
                              />
                              <label htmlFor="image-spine" className="cursor-pointer">
                                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                                <p className="text-xs text-gray-500">Click to upload</p>
                              </label>
                            </div>
                          )}
                        </div>

                        {/* Tape Label Image */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tape Label (Optional)</label>
                          {newSubmission.imageTapeLabel ? (
                            <div className="relative group">
                              <img loading="lazy"
                                src={newSubmission.imageTapeLabel.preview}
                                alt="Tape Label preview"
                                className="w-full h-32 object-cover rounded border-2 border-gray-300"
                              />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'imageTapeLabel')}
                                className="hidden"
                                id="image-tape-label-replace"
                              />
                              <label
                                htmlFor="image-tape-label-replace"
                                className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                              >
                                <span className="text-white font-medium text-sm">
                                  {editingVariant && newSubmission.imageTapeLabel.existing ? 'Replace' : 'Change'}
                                </span>
                              </label>
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-400 transition">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'imageTapeLabel')}
                                className="hidden"
                                id="image-tape-label"
                              />
                              <label htmlFor="image-tape-label" className="cursor-pointer">
                                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                                <p className="text-xs text-gray-500">Click to upload</p>
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                )}

                {!editingMaster && !editingVariant && (
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
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowSubmitModal(false);
                      setEditingMaster(null);
                      setEditingVariant(null);
                    }}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitEntry}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
                  >
                    {editingMaster || editingVariant ? 'Update' : 'Submit for Review'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCollectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Add to Collection</h2>
            <p className="text-gray-600 mb-6">Add personal details about this item in your collection.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
                <select
                  value={collectionDetails.condition}
                  onChange={(e) => setCollectionDetails({...collectionDetails, condition: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select condition...</option>
                  <option value="Mint">Mint</option>
                  <option value="Near Mint">Near Mint</option>
                  <option value="Very Good">Very Good</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Personal Notes (Optional)</label>
                <textarea
                  value={collectionDetails.notes}
                  onChange={(e) => setCollectionDetails({...collectionDetails, notes: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows="3"
                  placeholder="Where you got it, personal memories, restoration notes, etc."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCollectionModal(false);
                  setCollectionDetails({ condition: '', notes: '' });
                }}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToCollection}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
              >
                Add to Collection
              </button>
            </div>
          </div>
        </div>
      )}

      {imageGallery.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 flex flex-col items-center justify-center p-4 z-50"
          onClick={closeImageGallery}
        >
          <div className="relative w-full max-w-6xl flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={closeImageGallery}
              className="absolute -top-12 right-0 bg-white text-gray-800 rounded-full p-2 hover:bg-gray-100 transition shadow-lg z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Main Image */}
            <div className="relative flex items-center justify-center w-full">
              {/* Previous Button */}
              {imageGallery.length > 1 && (
                <button
                  onClick={prevImage}
                  className="absolute left-4 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 rounded-full p-3 transition shadow-lg z-10"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
              )}

              {/* Image */}
              <img loading="lazy"
                src={imageGallery[currentImageIndex]}
                alt={`Image ${currentImageIndex + 1}`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
              />

              {/* Next Button */}
              {imageGallery.length > 1 && (
                <button
                  onClick={nextImage}
                  className="absolute right-4 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 rounded-full p-3 transition shadow-lg z-10"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              )}
            </div>

            {/* Thumbnail Strip */}
            {imageGallery.length > 1 && (
              <div className="mt-6 flex gap-2 overflow-x-auto max-w-full pb-2">
                {imageGallery.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`flex-shrink-0 rounded-lg overflow-hidden transition ${
                      idx === currentImageIndex
                        ? 'ring-4 ring-purple-500'
                        : 'ring-2 ring-gray-500 hover:ring-white'
                    }`}
                  >
                    <img loading="lazy"
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-20 h-20 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Image Counter */}
            <div className="mt-2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full text-sm">
              {currentImageIndex + 1} / {imageGallery.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}