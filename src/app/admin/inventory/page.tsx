"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  UtensilsCrossed,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Image as ImageIcon,
  X,
  AlertCircle,
  Star,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { MenuItem, KitchenStation, CarouselSlide } from "@/types/database";

const STATIONS: { id: KitchenStation; label: string; catId: string; emoji: string }[] = [
  { id: "robata", label: "Robata Grill & Tapas", catId: "cat-1", emoji: "🔥" },
  { id: "pizza", label: "Wood-Fired Pizza", catId: "cat-2", emoji: "🍕" },
  { id: "mains", label: "Chef's Kitchen Mains", catId: "cat-3", emoji: "🍽️" },
  { id: "bar", label: "Craft Bar & Elixirs", catId: "cat-4", emoji: "🍹" },
  { id: "pastry", label: "Pastry Studio", catId: "cat-5", emoji: "🍮" },
];

export default function InventoryManagement() {
  const [activeTab, setActiveTab] = useState<"menu" | "carousel">("menu");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStation, setSelectedStation] = useState<string>("all");
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "non-veg">("all");
  const [onlyChefSpecials, setOnlyChefSpecials] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Dish modal state
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishPriceRupees, setDishPriceRupees] = useState("");
  const [dishCalories, setDishCalories] = useState("");
  const [dishProteinGrams, setDishProteinGrams] = useState("");
  const [dishCarbsGrams, setDishCarbsGrams] = useState("");
  const [dishFatGrams, setDishFatGrams] = useState("");
  const [dishStation, setDishStation] = useState<KitchenStation>("robata");
  const [dishIsVeg, setDishIsVeg] = useState(true);
  const [dishIsChefSpecial, setDishIsChefSpecial] = useState(false);
  const [dishImageUrl, setDishImageUrl] = useState("");
  const [dishIsAvailable, setDishIsAvailable] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [dishModalError, setDishModalError] = useState<string | null>(null);
  const [isSavingDish, setIsSavingDish] = useState(false);

  // Carousel slide modal state
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<CarouselSlide | null>(null);
  const [slideTitle, setSlideTitle] = useState("");
  const [slideSub, setSlideSub] = useState("");
  const [slideImage, setSlideImage] = useState("");
  const [isUploadingSlidePhoto, setIsUploadingSlidePhoto] = useState(false);
  const [slideModalError, setSlideModalError] = useState<string | null>(null);
  const [isSavingSlide, setIsSavingSlide] = useState(false);

  // File input refs
  const dishFileInputRef = useRef<HTMLInputElement>(null);
  const slideFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch menu items and carousel slides
  const fetchData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const [itemsRes, slidesRes] = await Promise.all([
        fetch("/api/menu-items", { cache: "no-store" }),
        fetch("/api/carousel", { cache: "no-store" }),
      ]);
      const [itemsData, slidesData] = await Promise.all([itemsRes.json(), slidesRes.json()]);
      if (!itemsRes.ok) throw new Error(itemsData.error || "Unable to load menu items.");
      if (!slidesRes.ok) throw new Error(slidesData.error || "Unable to load carousel banners.");
      if (!Array.isArray(itemsData.items) || !Array.isArray(slidesData.slides)) {
        throw new Error("Menu data was not in the expected format.");
      }

      setItems(itemsData.items);
      setSlides(slidesData.slides);
      setDataError(null);
      setLastUpdated(new Date().toISOString());
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load menu data.";
      setDataError(message);
      console.error("Failed to load inventory data:", loadError);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => fetchData());
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchData();
    }, 30_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void fetchData();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fetchData]);

  // Quick 86'd stock toggle
  const handleToggleAvailability = async (item: MenuItem) => {
    const nextVal = !item.is_available;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_available: nextVal } : i))
    );

    try {
      const response = await fetch("/api/menu-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isAvailable: nextVal }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update item availability.");
      setMutationError(null);
    } catch (updateError) {
      setMutationError(updateError instanceof Error ? updateError.message : "Unable to update item availability.");
      console.error("Failed to toggle item availability:", updateError);
      void fetchData();
    }
  };

  // Quick Chef's Special toggle
  const handleToggleChefSpecial = async (item: MenuItem) => {
    const nextVal = !item.is_chef_special;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_chef_special: nextVal } : i))
    );

    try {
      const response = await fetch("/api/menu-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isChefSpecial: nextVal }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update Chef's Special.");
      }
      setMutationError(null);
    } catch (updateError) {
      setMutationError(updateError instanceof Error ? updateError.message : "Unable to update Chef's Special.");
      console.error("Failed to toggle chef special:", updateError);
      void fetchData();
    }
  };

  // Open Add Dish modal
  const handleOpenAddDish = () => {
    setEditingItem(null);
    setDishName("");
    setDishDescription("");
    setDishPriceRupees("");
    setDishCalories("");
    setDishProteinGrams("");
    setDishCarbsGrams("");
    setDishFatGrams("");
    setDishStation("robata");
    setDishIsVeg(true);
    setDishIsChefSpecial(false);
    setDishImageUrl("");
    setDishIsAvailable(true);
    setDishModalError(null);
    setIsDishModalOpen(true);
  };

  // Open Edit Dish modal
  const handleOpenEditDish = (item: MenuItem) => {
    setEditingItem(item);
    setDishName(item.name);
    setDishDescription(item.description || "");
    setDishPriceRupees((item.price_paise / 100).toString());
    setDishCalories(item.calories == null ? "" : String(item.calories));
    setDishProteinGrams(item.protein_grams == null ? "" : String(item.protein_grams));
    setDishCarbsGrams(item.carbs_grams == null ? "" : String(item.carbs_grams));
    setDishFatGrams(item.fat_grams == null ? "" : String(item.fat_grams));
    setDishStation((item.station || "mains") as KitchenStation);
    setDishIsVeg(Boolean(item.is_vegetarian));
    setDishIsChefSpecial(Boolean(item.is_chef_special));
    setDishImageUrl(item.image_url || "");
    setDishIsAvailable(Boolean(item.is_available));
    setDishModalError(null);
    setIsDishModalOpen(true);
  };

  // Handle image upload from disk
  const handleFileUpload = async (file: File, target: "dish" | "slide") => {
    const isDish = target === "dish";
    if (isDish) setIsUploadingPhoto(true);
    else setIsUploadingSlidePhoto(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Upload failed");
      }

      if (isDish) {
        setDishImageUrl(data.url);
      } else {
        setSlideImage(data.url);
      }
    } catch (err: unknown) {
      console.error("File upload failed:", err);
      const message = err instanceof Error ? err.message : "Failed to upload image";
      if (isDish) setDishModalError(message);
      else setSlideModalError(message);
    } finally {
      if (isDish) setIsUploadingPhoto(false);
      else setIsUploadingSlidePhoto(false);
    }
  };

  // Save Dish (Add or Edit)
  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishName.trim()) {
      setDishModalError("Dish name is required.");
      return;
    }
    const priceNum = parseFloat(dishPriceRupees);
    if (isNaN(priceNum) || priceNum <= 0) {
      setDishModalError("Please enter a valid price in ₹.");
      return;
    }
    const nutritionInputs = [
      ["Calories", dishCalories, true],
      ["Protein", dishProteinGrams, false],
      ["Carbohydrates", dishCarbsGrams, false],
      ["Fat", dishFatGrams, false],
    ] as const;
    for (const [label, value, integerOnly] of nutritionInputs) {
      if (!value.trim()) continue;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || (integerOnly && !Number.isInteger(parsed))) {
        setDishModalError(`${label} must be a non-negative ${integerOnly ? "whole number" : "number"}.`);
        return;
      }
    }

    const nutritionPayload = {
      calories: dishCalories.trim() ? Number(dishCalories) : null,
      protein_grams: dishProteinGrams.trim() ? Number(dishProteinGrams) : null,
      carbs_grams: dishCarbsGrams.trim() ? Number(dishCarbsGrams) : null,
      fat_grams: dishFatGrams.trim() ? Number(dishFatGrams) : null,
    };

    const matchedStation = STATIONS.find((s) => s.id === dishStation);
    const categoryId = matchedStation ? matchedStation.catId : "cat-1";

    setIsSavingDish(true);
    setDishModalError(null);

    try {
      if (editingItem) {
        // Update existing dish
        const res = await fetch("/api/menu-items", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingItem.id,
            name: dishName.trim(),
            description: dishDescription.trim() || null,
            price_paise: Math.round(priceNum * 100),
            ...nutritionPayload,
            category_id: categoryId,
            station: dishStation,
            is_vegetarian: dishIsVeg,
            is_chef_special: dishIsChefSpecial,
            image_url: dishImageUrl.trim() || null,
            is_available: dishIsAvailable,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update dish.");
        setIsDishModalOpen(false);
        fetchData();
      } else {
        // Create new dish
        const res = await fetch("/api/menu-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: dishName.trim(),
            description: dishDescription.trim() || null,
            price_paise: Math.round(priceNum * 100),
            ...nutritionPayload,
            category_id: categoryId,
            station: dishStation,
            is_vegetarian: dishIsVeg,
            is_chef_special: dishIsChefSpecial,
            image_url: dishImageUrl.trim() || null,
            is_available: dishIsAvailable,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create dish.");
        setIsDishModalOpen(false);
        fetchData();
      }
    } catch (err: unknown) {
      setDishModalError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSavingDish(false);
    }
  };

  // Delete Dish
  const handleDeleteDish = async (item: MenuItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}" from the menu?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/menu-items?id=${item.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } catch (err) {
      console.error("Failed to delete dish:", err);
      fetchData();
    }
  };

  // Open Add Slide modal
  const handleOpenAddSlide = () => {
    setEditingSlide(null);
    setSlideTitle("");
    setSlideSub("");
    setSlideImage("");
    setSlideModalError(null);
    setIsSlideModalOpen(true);
  };

  // Open Edit Slide modal
  const handleOpenEditSlide = (slide: CarouselSlide) => {
    setEditingSlide(slide);
    setSlideTitle(slide.title);
    setSlideSub(slide.sub);
    setSlideImage(slide.image);
    setSlideModalError(null);
    setIsSlideModalOpen(true);
  };

  // Save Carousel Slide
  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slideTitle.trim() || !slideImage.trim()) {
      setSlideModalError("Title and Image are required for a carousel banner.");
      return;
    }

    setIsSavingSlide(true);
    setSlideModalError(null);

    try {
      if (editingSlide) {
        // Update slide
        const res = await fetch("/api/carousel", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingSlide.id,
            title: slideTitle.trim(),
            sub: slideSub.trim(),
            image: slideImage.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update banner.");
        setIsSlideModalOpen(false);
        fetchData();
      } else {
        // Add slide
        const res = await fetch("/api/carousel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: slideTitle.trim(),
            sub: slideSub.trim(),
            image: slideImage.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create banner.");
        setIsSlideModalOpen(false);
        fetchData();
      }
    } catch (err: unknown) {
      setSlideModalError(err instanceof Error ? err.message : "Failed to save slide.");
    } finally {
      setIsSavingSlide(false);
    }
  };

  // Delete Slide
  const handleDeleteSlide = async (slideId: string) => {
    if (!confirm("Remove this carousel banner?")) return;
    try {
      const res = await fetch(`/api/carousel?id=${slideId}`, { method: "DELETE" });
      if (res.ok) {
        setSlides((prev) => prev.filter((s) => s.id !== slideId));
      }
    } catch (err) {
      console.error("Failed to delete slide:", err);
      fetchData();
    }
  };

  // Filtered dishes
  const filteredItems = items.filter((i) => {
    const matchSearch =
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.description && i.description.toLowerCase().includes(search.toLowerCase()));
    const matchStation = selectedStation === "all" || i.station === selectedStation;
    const matchVeg =
      vegFilter === "all"
        ? true
        : vegFilter === "veg"
        ? i.is_vegetarian
        : !i.is_vegetarian;
    const matchChef = onlyChefSpecials ? Boolean(i.is_chef_special) : true;
    return matchSearch && matchStation && matchVeg && matchChef;
  });

  const soldOutCount = items.filter((i) => !i.is_available).length;
  const chefSpecialsCount = items.filter((i) => i.is_chef_special).length;

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#171513]">
      <AdminNav />

      <div className="mx-auto min-w-0 max-w-6xl space-y-6 px-4 pt-20 pb-28 sm:px-6 md:py-6 lg:px-8">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE3D5]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-[#171513]">
                Menu & Visual Studio
              </h1>
              {soldOutCount > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 font-mono font-bold">
                  {soldOutCount} 86&apos;d
                </span>
              )}
            </div>
            <p className="text-xs text-[#6F6961] mt-0.5">
              Add new dishes, edit prices & descriptions, upload photos, and customize the top customer carousel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {lastUpdated && (
              <span className="text-[11px] text-[#8C827A]">
                Synced {new Date(lastUpdated).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => void fetchData(true)}
              type="button"
              disabled={isRefreshing}
              aria-label="Sync menu and banners"
              className="inline-flex min-h-10 items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D9D2C5] bg-white text-xs font-semibold text-[#171513] hover:bg-[#FAF7F2] transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#987532] ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Syncing…" : "Sync now"}</span>
            </button>

            {activeTab === "menu" ? (
              <button
                onClick={handleOpenAddDish}
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#171513] hover:bg-[#2B2724] text-[#DFC894] text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 text-[#C5A059]" />
                <span>Add New Dish</span>
              </button>
            ) : (
              <button
                onClick={handleOpenAddSlide}
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#171513] hover:bg-[#2B2724] text-[#DFC894] text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 text-[#C5A059]" />
                <span>Add Carousel Banner</span>
              </button>
            )}
          </div>
        </div>

        {(dataError || mutationError) && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>{mutationError || dataError}</span>
            {dataError && (
              <button type="button" onClick={() => void fetchData(true)} className="shrink-0 font-semibold underline">
                Retry
              </button>
            )}
          </div>
        )}

        {/* Tab Selector: Menu Items vs Carousel Banner Studio */}
        <div className="flex border-b border-[#EAE3D5] gap-6">
          <button
            onClick={() => setActiveTab("menu")}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative cursor-pointer ${
              activeTab === "menu" ? "text-[#171513]" : "text-[#8C827A] hover:text-[#171513]"
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 text-[#C5A059]" />
            <span>Dishes & 86 Inventory</span>
            <span className="text-[11px] px-2 py-0.2 rounded-full bg-[#EAE3D5] font-mono font-bold">
              {items.length}
            </span>
            {activeTab === "menu" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C5A059]" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("carousel")}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative cursor-pointer ${
              activeTab === "carousel" ? "text-[#171513]" : "text-[#8C827A] hover:text-[#171513]"
            }`}
          >
            <ImageIcon className="w-4 h-4 text-[#C5A059]" />
            <span>Top Carousel Banners</span>
            <span className="text-[11px] px-2 py-0.2 rounded-full bg-[#EAE3D5] font-mono font-bold">
              {slides.length}
            </span>
            {activeTab === "carousel" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C5A059]" />
            )}
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            TAB 1: MENU ITEMS & 86 INVENTORY
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === "menu" && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
              <div className="relative min-w-0">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A196]" />
                <input
                  type="text"
                  placeholder="Search dishes by name or ingredients..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-[#D9D2C5] bg-white focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              {/* Station Filter Pills */}
              <div className="flex min-w-0 gap-1 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedStation("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedStation === "all"
                      ? "bg-[#171513] text-[#FAF7F2] font-semibold"
                      : "bg-white text-[#6F6961] border border-[#D9D2C5] hover:border-[#C5A059]"
                  }`}
                >
                  All Stations
                </button>
                {STATIONS.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStation(st.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                      selectedStation === st.id
                        ? "bg-[#171513] text-[#FAF7F2] font-semibold"
                        : "bg-white text-[#6F6961] border border-[#D9D2C5] hover:border-[#C5A059]"
                    }`}
                  >
                    <span>{st.emoji}</span>
                    <span>{st.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>

              {/* Veg / Non-Veg Quick Filter */}
              <div className="flex gap-1 bg-white p-1 rounded-xl border border-[#D9D2C5] shrink-0">
                <button
                  type="button"
                  onClick={() => setVegFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    vegFilter === "all" ? "bg-[#171513] text-white" : "text-[#78716C]"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setVegFilter("veg")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    vegFilter === "veg" ? "bg-emerald-700 text-white" : "text-emerald-700"
                  }`}
                >
                  Veg
                </button>
                <button
                  type="button"
                  onClick={() => setVegFilter("non-veg")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    vegFilter === "non-veg" ? "bg-red-700 text-white" : "text-red-700"
                  }`}
                >
                  Non-Veg
                </button>
              </div>

              {/* Chef's Special Filter Pill */}
              <button
                type="button"
                onClick={() => setOnlyChefSpecials(!onlyChefSpecials)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shrink-0 ${
                  onlyChefSpecials
                    ? "bg-[#C5A059] text-[#171513] shadow-xs"
                    : "bg-white border border-[#D9D2C5] text-[#987532] hover:border-[#C5A059]"
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${onlyChefSpecials ? "fill-[#171513]" : "fill-amber-400 text-amber-500"}`} />
                <span>Chef&apos;s Specials ({chefSpecialsCount})</span>
              </button>
            </div>

            {/* Dishes List */}
            <div className="bg-white rounded-3xl border border-[#EAE3D5] overflow-hidden shadow-sm divide-y divide-[#EAE3D5]">
              {isLoading ? (
                <div className="p-12 text-center text-sm text-[#8C827A]">Loading menu items…</div>
              ) : filteredItems.length === 0 ? (
                <div className="p-12 text-center text-[#8C827A]">
                  <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="font-serif font-bold text-base text-[#171513]">No dishes found</p>
                  <p className="text-xs mt-1">Try clearing filters or add a new dish!</p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF7F2]/60 transition-colors"
                  >
                    {/* Left: Image & Info */}
                    <div className="flex items-start gap-3.5">
                      <div className="relative w-16 h-16 rounded-2xl bg-[#FAF7F2] border border-[#EAE3D5] overflow-hidden shrink-0 shadow-xs">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-[#A8A196] font-serif font-bold">
                            MO
                          </div>
                        )}
                        {!item.is_available && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-[9px] font-black uppercase text-red-300">86&apos;d</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-bold text-base text-[#171513]">
                            {item.name}
                          </span>
                          {item.is_vegetarian ? (
                            <span className="w-2.5 h-2.5 rounded-xs border border-emerald-600 flex items-center justify-center" title="Vegetarian">
                              <span className="w-1 h-1 bg-emerald-600 rounded-full" />
                            </span>
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-xs border border-red-600 flex items-center justify-center" title="Non-Vegetarian">
                              <span className="w-1 h-1 bg-red-600 rounded-full" />
                            </span>
                          )}
                          {item.station && (
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#FAF7F2] border border-[#D9D2C5] text-[#987532] font-bold">
                              {item.station}
                            </span>
                          )}
                          {item.is_chef_special && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                              <span>Chef&apos;s Special</span>
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-xs text-[#6F6961] max-w-xl mt-1 line-clamp-2 leading-relaxed font-light">
                            {item.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="font-serif font-bold text-sm text-[#987532]">
                            {formatCurrency(item.price_paise)}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            item.is_available
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-red-50 text-red-800 border border-red-200"
                          }`}>
                            {item.is_available ? "In Stock (Serving)" : "86'd (Sold Out)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-[#EAE3D5]">
                      {/* Chef Special 1-Click Star Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleChefSpecial(item)}
                        title={item.is_chef_special ? "Remove from Chef's Specials" : "Mark as Chef's Special"}
                        className={`p-2 rounded-xl border transition-all cursor-pointer ${
                          item.is_chef_special
                            ? "bg-amber-100 border-amber-300 text-amber-800 shadow-2xs"
                            : "bg-white border-[#D9D2C5] text-[#A8A196] hover:text-[#C5A059] hover:border-[#C5A059]"
                        }`}
                      >
                        <Star className={`w-4 h-4 ${item.is_chef_special ? "fill-amber-500 text-amber-600" : ""}`} />
                      </button>

                      {/* 86 Quick Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(item)}
                        title={item.is_available ? "Mark 86'd (Sold Out)" : "Restore In Stock"}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          item.is_available
                            ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                            : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                        }`}
                      >
                        {item.is_available ? (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            <span>86 Dish</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Restock</span>
                          </>
                        )}
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditDish(item)}
                        className="p-2 rounded-xl border border-[#D9D2C5] bg-white text-[#171513] hover:bg-[#FAF7F2] hover:border-[#C5A059] transition-all cursor-pointer"
                        title="Edit Dish Details"
                      >
                        <Edit2 className="w-4 h-4 text-[#C5A059]" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteDish(item)}
                        className="p-2 rounded-xl border border-[#EAE3D5] bg-white text-[#A8A196] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all cursor-pointer"
                        title="Delete Dish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 2: TOP CAROUSEL BANNER STUDIO
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === "carousel" && (
          <div className="space-y-6">
            <div className="bg-[#171513] rounded-3xl p-6 text-white border border-[#2C2724] relative overflow-hidden">
              <div className="max-w-2xl">
                <span className="text-[10px] tracking-[3px] uppercase text-[#C5A059] font-bold">
                  Guest QR Header Experience
                </span>
                <h2 className="font-serif text-2xl font-bold mt-1 text-[#FDFBF7]">
                  Top Carousel Visual Showcase
                </h2>
                <p className="text-xs text-[#A8A196] mt-1.5 leading-relaxed">
                  These cinematic banners rotate automatically at the top of the guest mobile menu. Upload high-res photography of your live robata, pizza oven, botanical bar, or signature desserts.
                </p>
              </div>
            </div>

            {/* Carousel Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {slides.map((slide, idx) => (
                <div
                  key={slide.id || idx}
                  className="bg-white rounded-3xl border border-[#EAE3D5] overflow-hidden shadow-sm flex flex-col group"
                >
                  <div className="relative h-44 overflow-hidden bg-[#171513]">
                    <img
                      src={slide.image}
                      alt={slide.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <span className="text-[9px] tracking-widest uppercase text-[#C5A059] font-bold block mb-0.5">
                        {slide.sub}
                      </span>
                      <h3 className="font-serif text-lg font-bold text-white leading-tight">
                        {slide.title}
                      </h3>
                    </div>
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-mono">
                      Slide #{idx + 1}
                    </span>
                  </div>

                  <div className="p-4 flex items-center justify-between mt-auto bg-[#FDFBF7]/50 border-t border-[#EAE3D5]">
                    <span className="text-[11px] text-[#78716C] font-mono truncate max-w-[200px]">
                      {slide.image.startsWith("/api/uploads/") ? "Custom Upload" : "Web Asset"}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditSlide(slide)}
                        className="px-3 py-1.5 rounded-xl border border-[#D9D2C5] bg-white text-xs font-semibold text-[#171513] hover:border-[#C5A059] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSlide(slide.id)}
                        className="p-1.5 rounded-xl border border-[#EAE3D5] bg-white text-[#A8A196] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MODAL: ADD / EDIT DISH
      ═══════════════════════════════════════════════════════════ */}
      {isDishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#FAF7F2] rounded-3xl border border-[#E8E2D5] max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-[#EAE3D5] flex items-center justify-between sticky top-0 bg-[#FAF7F2] z-10">
              <div>
                <span className="text-[10px] tracking-widest uppercase text-[#987532] font-bold">
                  {editingItem ? "Update Recipe & Pricing" : "New Culinary Creation"}
                </span>
                <h3 className="font-serif text-xl font-bold text-[#171513]">
                  {editingItem ? `Edit: ${editingItem.name}` : "Add Dish to Menu"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDishModalOpen(false)}
                className="p-2 rounded-xl text-[#78716C] hover:text-[#171513] hover:bg-[#EAE3D5] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveDish} className="p-6 space-y-5">
              {dishModalError && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{dishModalError}</span>
                </div>
              )}

              {/* Dish Name */}
              <div>
                <label className="text-xs font-bold text-[#171513] block mb-1">
                  Dish Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Truffle & Edamame Crystal Dumplings"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D9D2C5] bg-white focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              {/* Price & Station */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#171513] block mb-1">
                    Price in ₹ (INR) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#987532]">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="e.g. 525"
                      value={dishPriceRupees}
                      onChange={(e) => setDishPriceRupees(e.target.value)}
                      required
                      className="w-full pl-8 pr-4 py-2.5 text-sm rounded-xl border border-[#D9D2C5] bg-white focus:outline-none focus:border-[#C5A059] font-serif font-bold text-[#171513]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#171513] block mb-1">
                    Kitchen Station *
                  </label>
                  <select
                    value={dishStation}
                    onChange={(e) => setDishStation(e.target.value as KitchenStation)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D9D2C5] bg-white focus:outline-none focus:border-[#C5A059]"
                  >
                    {STATIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.emoji} {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dietary Type: Veg vs Non-Veg */}
              <div>
                <label className="text-xs font-bold text-[#171513] block mb-1.5">
                  Dietary Classification
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDishIsVeg(true)}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                      dishIsVeg
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs"
                        : "bg-white border-[#D9D2C5] text-[#6F6961]"
                    }`}
                  >
                    <span className="w-3 h-3 rounded-xs border-2 border-emerald-600 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                    </span>
                    <span>Vegetarian (VEG)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDishIsVeg(false)}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                      !dishIsVeg
                        ? "bg-red-50 border-red-500 text-red-800 shadow-xs"
                        : "bg-white border-[#D9D2C5] text-[#6F6961]"
                    }`}
                  >
                    <span className="w-3 h-3 rounded-xs border-2 border-red-600 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                    </span>
                    <span>Non-Vegetarian</span>
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-[#171513] block mb-1">
                  Culinary Description & Ingredients
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Handmade translucent wrapper, black summer truffle emulsion, water chestnut crunch..."
                  value={dishDescription}
                  onChange={(e) => setDishDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#D9D2C5] bg-white focus:outline-none focus:border-[#C5A059] leading-relaxed"
                />
              </div>

              <fieldset className="space-y-2">
                <legend className="text-xs font-bold text-[#171513]">Nutrition per serving (optional)</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Calories (kcal)", value: dishCalories, setValue: setDishCalories, step: "1" },
                    { label: "Protein (g)", value: dishProteinGrams, setValue: setDishProteinGrams, step: "0.1" },
                    { label: "Carbs (g)", value: dishCarbsGrams, setValue: setDishCarbsGrams, step: "0.1" },
                    { label: "Fat (g)", value: dishFatGrams, setValue: setDishFatGrams, step: "0.1" },
                  ].map((field) => (
                    <label key={field.label} className="text-[10px] font-semibold text-[#6F6961]">
                      {field.label}
                      <input
                        type="number"
                        min="0"
                        step={field.step}
                        value={field.value}
                        onChange={(event) => field.setValue(event.target.value)}
                        placeholder="—"
                        className="mt-1 w-full rounded-lg border border-[#D9D2C5] bg-white px-2.5 py-2 text-xs text-[#171513] focus:border-[#C5A059] focus:outline-none"
                      />
                    </label>
                  ))}
                </div>
                <p className="text-[10px] leading-relaxed text-[#8F877B]">
                  Enter verified nutrition information. Blank values won&apos;t appear on the guest menu.
                </p>
              </fieldset>

              {/* Dish Photo Uploader */}
              <div>
                <label className="text-xs font-bold text-[#171513] block mb-1">
                  Dish Photography
                </label>

                {/* Hidden file input */}
                <input
                  type="file"
                  ref={dishFileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "dish");
                  }}
                />

                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => dishFileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-dashed border-[#C5A059] bg-[#FAF7F2] hover:bg-white text-xs font-bold text-[#987532] flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <Upload className="w-4 h-4 text-[#C5A059]" />
                    <span>{isUploadingPhoto ? "Uploading..." : "📁 Upload Photo from Device"}</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="url"
                    placeholder="Or paste external image URL (https://...)"
                    value={dishImageUrl}
                    onChange={(e) => setDishImageUrl(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#D9D2C5] bg-white focus:outline-none focus:border-[#C5A059] font-mono"
                  />
                </div>

                {/* Preview Thumbnail */}
                {dishImageUrl && (
                  <div className="mt-3 relative aspect-video w-full max-w-[240px] rounded-2xl overflow-hidden border border-[#EAE3D5] shadow-xs">
                    <img
                      src={dishImageUrl}
                      alt="Dish Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
                      Preview
                    </div>
                  </div>
                )}
              </div>

              {/* In Stock toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="dishAvailableCheckbox"
                  checked={dishIsAvailable}
                  onChange={(e) => setDishIsAvailable(e.target.checked)}
                  className="w-4 h-4 rounded text-[#C5A059] focus:ring-[#C5A059]"
                />
                <label htmlFor="dishAvailableCheckbox" className="text-xs font-semibold text-[#171513] cursor-pointer">
                  Available for ordering (If unchecked, dish displays as 86&apos;d Sold Out)
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EAE3D5]">
                <button
                  type="button"
                  onClick={() => setIsDishModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#D9D2C5] text-xs font-semibold text-[#78716C] hover:text-[#171513] hover:bg-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDish || isUploadingPhoto}
                  className="px-6 py-2.5 rounded-xl bg-[#171513] text-[#DFC894] hover:bg-[#2B2724] text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSavingDish ? "Saving..." : editingItem ? "Update Dish" : "Create Dish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL: ADD / EDIT CAROUSEL BANNER
      ═══════════════════════════════════════════════════════════ */}
      {isSlideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#FAF7F2] rounded-3xl border border-[#E8E2D5] max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="p-6 pb-4 border-b border-[#EAE3D5] flex items-center justify-between sticky top-0 bg-[#FAF7F2] z-10">
              <div>
                <span className="text-[10px] tracking-widest uppercase text-[#987532] font-bold">
                  Top Mobile Banner
                </span>
                <h3 className="font-serif text-xl font-bold text-[#171513]">
                  {editingSlide ? "Edit Carousel Banner" : "Add Carousel Banner"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSlideModalOpen(false)}
                className="p-2 rounded-xl text-[#78716C] hover:text-[#171513] hover:bg-[#EAE3D5] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlide} className="p-6 space-y-4">
              {slideModalError && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{slideModalError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-[#171513] block mb-1">
                  Banner Headline *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Live Robata Charcoal Grill"
                  value={slideTitle}
                  onChange={(e) => setSlideTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D9D2C5] bg-white focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#171513] block mb-1">
                  Tagline / Subtitle
                </label>
                <input
                  type="text"
                  placeholder="e.g. Charcoal-fired, table-side theatre"
                  value={slideSub}
                  onChange={(e) => setSlideSub(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D9D2C5] bg-white focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              {/* Slide Photo Uploader */}
              <div>
                <label className="text-xs font-bold text-[#171513] block mb-1">
                  Hero Photo *
                </label>

                <input
                  type="file"
                  ref={slideFileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "slide");
                  }}
                />

                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => slideFileInputRef.current?.click()}
                    disabled={isUploadingSlidePhoto}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-dashed border-[#C5A059] bg-[#FAF7F2] hover:bg-white text-xs font-bold text-[#987532] flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <Upload className="w-4 h-4 text-[#C5A059]" />
                    <span>{isUploadingSlidePhoto ? "Uploading Photo..." : "📁 Upload Banner Image"}</span>
                  </button>
                </div>

                <input
                  type="url"
                  placeholder="Or enter image URL (https://...)"
                  value={slideImage}
                  onChange={(e) => setSlideImage(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#D9D2C5] bg-white focus:outline-none focus:border-[#C5A059] font-mono"
                />

                {/* Banner Live Preview */}
                {slideImage && (
                  <div className="mt-3 relative h-36 w-full rounded-2xl overflow-hidden border border-[#EAE3D5] shadow-xs bg-[#171513]">
                    <img
                      src={slideImage}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <span className="text-[9px] tracking-widest uppercase text-[#C5A059] font-bold block">
                        {slideSub || "Tagline"}
                      </span>
                      <h4 className="font-serif text-base font-bold text-white">
                        {slideTitle || "Headline"}
                      </h4>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EAE3D5]">
                <button
                  type="button"
                  onClick={() => setIsSlideModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#D9D2C5] text-xs font-semibold text-[#78716C] hover:text-[#171513] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSlide || isUploadingSlidePhoto}
                  className="px-6 py-2.5 rounded-xl bg-[#171513] text-[#DFC894] hover:bg-[#2B2724] text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSavingSlide ? "Saving..." : editingSlide ? "Update Banner" : "Add Banner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
