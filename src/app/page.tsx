'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, addDays, startOfWeek, isToday, isSameDay } from 'date-fns'
import { ThemeToggle } from '@/components/ThemeToggle'
import Image from 'next/image'
import { hr } from 'date-fns/locale'
import { 
  Calendar,
  Search,
  Heart,
  Moon,
  Sun,
  Filter,
  X,
  FilterX,
  Download,
  Trash2,
  Eye,
  BarChart3,
  Settings,
  UtensilsCrossed,
  Loader2
} from 'lucide-react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'

// UI Components
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

ChartJS.register(ArcElement, Tooltip, Legend)

// Types
interface MenuItem {
  id: number
  title: string
  price: string
  allergens: string
  weight?: string
}

interface MenuProducts {
  menu?: MenuItem[]
  vege_menu?: MenuItem[]
  izbor?: MenuItem[]
  prilozi?: MenuItem[]
}

interface MealTypes {
  rucak?: MenuProducts
  vecera?: MenuProducts
}

interface Restaurant {
  id: number
  title: { rendered: string }
  meta: {
    menu_date: string
    menu_products: MealTypes
  }
}

interface FavoriteItem extends MenuItem {
  restaurant: string
  dateAdded: string
}

// Constants
const allergenInfo = {
  'A': { name: 'Gluten', icon: '🌾', color: 'bg-red-100 text-red-800' },
  'C': { name: 'Jaja', icon: '🥚', color: 'bg-blue-100 text-blue-800' },
  'F': { name: 'Soja', icon: '🫘', color: 'bg-green-100 text-green-800' },
  'G': { name: 'Mlijeko', icon: '🥛', color: 'bg-yellow-100 text-yellow-800' },
  'I': { name: 'Celer', icon: '🥬', color: 'bg-purple-100 text-purple-800' },
  'J': { name: 'Senf', icon: '🌭', color: 'bg-pink-100 text-pink-800' },
  'K': { name: 'Sezam', icon: '🫘', color: 'bg-indigo-100 text-indigo-800' },
  'L': { name: 'Sulfiti', icon: '🍷', color: 'bg-orange-100 text-orange-800' }
} as const

const sectionNames = {
  'menu': 'Glavno jelo',
  'vege_menu': 'Vegetarijanski jelovnik',
  'izbor': 'Dodatne opcije',
  'prilozi': 'Prilozi',
  'rucak': 'Ručak',
  'vecera': 'Večera'
} as const



export default function UniversityMenuApp() {
  // State management
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedRestaurant, setSelectedRestaurant] = useState('8015')
  const [menuData, setMenuData] = useState<Restaurant[]>([])
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [selectedAllergens, setSelectedAllergens] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [showWeekView, setShowWeekView] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  
  // Settings state
  const [settings, setSettings] = useState({
    showPrices: true,
    showAllergens: true,
    showWeights: true,
    compactView: false,
    dailyNotifications: false,
    favoriteNotifications: false
  })

  // Load favorites from localStorage on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem('favorites')
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites))
    }
    (async () => {
      try {
        const res = await fetch('/api/restaurants', { cache: 'no-store' });
        console.log(res);

        if (!res.ok) throw new Error('Failed fetching restaurants');
        const data = await res.json();
        console.log(data.restaurants);

        // your API returns { restaurants, total }, so:
        setRestaurants(data.restaurants ?? []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [])

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites))
  }, [favorites])

  // Load menu on date/restaurant change
  useEffect(() => {
    loadMenu()
  }, [selectedDate, selectedRestaurant])

  // Helper functions
  const formatAllergens = (allergenString: string) => {
    if (!allergenString || allergenString === '-' || allergenString.trim() === '') {
      return <Badge variant="outline" className="text-green-600">Nema alergena</Badge>
    }
    
    const allergens = allergenString.split(',').map(a => a.trim())
    return allergens.map((allergen, index) => {
      const isTrace = allergen.includes('*')
      const cleanAllergen = allergen.replace('*', '')
      const info = allergenInfo[cleanAllergen as keyof typeof allergenInfo]
      
      if (!info) return null
      
      return (
        <Badge 
          key={index}
          variant="secondary" 
          className={`${info.color} ${isTrace ? 'opacity-60' : ''} text-xs`}
          title={`${info.name}${isTrace ? ' (mogući tragovi)' : ''}`}
        >
          {info.icon}
        </Badge>
      )
    })
  }

  const formatPrice = (price: string) => {
    const priceNum = parseFloat(price)
    let className = 'text-orange-600'
    
    if (priceNum <= 1) className = 'text-green-600'
    else if (priceNum > 2) className = 'text-red-600'
    
    return <span className={`font-semibold ${className}`}>{priceNum.toFixed(2)} €</span>
  }

  const toggleFavorite = (item: MenuItem, restaurantName: string) => {
    const existingIndex = favorites.findIndex(fav => fav.id === item.id)
    
    if (existingIndex >= 0) {
      setFavorites(prev => prev.filter((_, index) => index !== existingIndex))
      toast.success('Uklonjeno iz favorita', { icon: '💔' })
    } else {
      const newFavorite: FavoriteItem = {
        ...item,
        restaurant: restaurantName,
        dateAdded: new Date().toISOString()
      }
      setFavorites(prev => [...prev, newFavorite])
      toast.success('Dodano u favorite!', { icon: '❤️' })
    }
  }

  const loadMenu = async () => {
    setLoading(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const timestamp = Date.now()
      let apiUrl = `https://www.sczg.unizg.hr/wp-json/wp/v2/menus?per_page=100&orderby=date&order=asc&timestamp=${timestamp}&menu_date=${dateStr}`
      
      if (selectedRestaurant) {
        apiUrl += `&restaurant=${selectedRestaurant}`
      }
      
      const response = await fetch(apiUrl)
      
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      
      const data: Restaurant[] = await response.json()
      setMenuData(data)
      
      if (data.length === 0) {
        toast.error('Jelovnik nije dostupan za odabrani datum')
      }
    } catch (error) {
      console.error('Error fetching menu data:', error)
      toast.error('Greška pri dohvaćanju jelovnika')
    } finally {
      setLoading(false)
    }
  }

  // Generate week days for weekly navigation
  const weekDays = useMemo(() => {
    const startWeek = startOfWeek(selectedDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(startWeek, i))
  }, [selectedDate])

  // Filter menu items
  const filteredMenuData = useMemo(() => {
    return menuData.map(restaurant => ({
      ...restaurant,
      meta: {
        ...restaurant.meta,
        menu_products: Object.fromEntries(
          Object.entries(restaurant.meta.menu_products).map(([mealType, sections]) => [
            mealType,
            Object.fromEntries(
              Object.entries(sections as MenuProducts).map(([sectionType, items]) => [
                sectionType,
                items?.filter(item => {
                  // Search filter
                  const matchesSearch = !searchQuery || 
                    item.title.toLowerCase().includes(searchQuery.toLowerCase())
                  
                  // Allergen filter
                  const hasRestrictedAllergens = selectedAllergens.size > 0 && 
                    item.allergens && 
                    item.allergens !== '-' &&
                    item.allergens.split(',').some(allergen => 
                      selectedAllergens.has(allergen.trim().replace('*', ''))
                    )
                  
                  // Quick filters
                  const matchesFilters = Array.from(activeFilters).every(filter => {
                    switch (filter) {
                      case 'vegetarian':
                        return sectionType === 'vege_menu'
                      case 'price-low':
                        return parseFloat(item.price) <= 1
                      case 'price-medium':
                        return parseFloat(item.price) > 1 && parseFloat(item.price) <= 2
                      case 'popular':
                        return favorites.some(fav => fav.id === item.id)
                      default:
                        return true
                    }
                  })
                  
                  return matchesSearch && !hasRestrictedAllergens && matchesFilters
                }) || []
              ])
            )
          ])
        )
      }
    }))
  }, [menuData, searchQuery, selectedAllergens, activeFilters, favorites])

  // Calculate statistics
  const statistics = useMemo(() => {
    let totalItems = 0
    let vegItems = 0
    let totalPrice = 0
    let priceCount = 0
    
    menuData.forEach(restaurant => {
      Object.values(restaurant.meta.menu_products).forEach(mealType => {
        Object.entries(mealType as MenuProducts).forEach(([sectionType, items]) => {
          if (items) {
            totalItems += items.length
            if (sectionType === 'vege_menu') {
              vegItems += items.length
            }
            items.forEach(item => {
              if (item.price) {
                totalPrice += parseFloat(item.price)
                priceCount++
              }
            })
          }
        })
      })
    })
    
    const avgPrice = priceCount > 0 ? totalPrice / priceCount : 0
    
    return {
      totalItems,
      vegItems,
      avgPrice,
      restaurantsCount: menuData.length,
      monthlyCost: avgPrice * 22
    }
  }, [menuData])

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Image src="/assets/images/Logo_transparent_3.png" alt="No Data" width={50} height={50} className="mx-auto" />
                Sveučilišni Restorani
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDarkMode(!isDarkMode)}
              >
                {<ThemeToggle/>}
              </Button>
              <Button variant="ghost" size="icon" className="relative">
                <Heart className="h-4 w-4" />
                {favorites.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {favorites.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="menu" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="menu">Jelovnik</TabsTrigger>
            <TabsTrigger value="favorites">Favoriti</TabsTrigger>
            <TabsTrigger value="analytics">Analitika</TabsTrigger>
            <TabsTrigger value="settings">Postavke</TabsTrigger>
          </TabsList>

          {/* Menu Tab */}
          <TabsContent value="menu" className="space-y-6">
            {/* Controls */}
            <Card>
  <CardHeader>
    <CardTitle>Kontrole jelovnika</CardTitle>
    <CardDescription>Odaberite datum i restoran za prikaz jelovnika</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Primary Controls - Always Visible */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Date Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Datum</label>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="flex-1"
          />
        </div>
      </div>

      {/* Restaurant Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Restoran</label>
        <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
          <SelectTrigger>
            <SelectValue placeholder="Odaberite restoran" />
          </SelectTrigger>
          <SelectContent>
            {restaurants.map(restaurant => (
              <SelectItem key={restaurant.value} value={restaurant.value}>
                {restaurant.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="space-y-2 md:col-span-2 lg:col-span-1">
        <label className="text-sm font-medium text-muted-foreground">Pretraživanje</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Pretražite jela..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Filters Dropdown */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Filteri</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filteri
                {(selectedAllergens.size > 0 || activeFilters.size > 0) && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedAllergens.size + activeFilters.size}
                  </Badge>
                )}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <div className="space-y-4">
              {/* Quick Filters Header */}
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Brzi filteri</h4>
                {(selectedAllergens.size > 0 || activeFilters.size > 0) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedAllergens(new Set())
                      setActiveFilters(new Set())
                    }}
                    className="text-xs h-7 px-2"
                  >
                    <FilterX className="h-3 w-3 mr-1" />
                    Očisti sve
                  </Button>
                )}
              </div>

              {/* Quick Filter Buttons */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'vegetarian', label: '🌱 Vegetarijanski' },
                  { key: 'price-low', label: '💰 Do 1€' },
                  { key: 'price-medium', label: '💰💰 1-2€' },
                  { key: 'popular', label: '🔥 Popularno' }
                ].map(filter => (
                  <Button
                    key={filter.key}
                    variant={activeFilters.has(filter.key) ? "default" : "outline"}
                    size="sm"
                    className="justify-start text-xs h-8"
                    onClick={() => {
                      const newFilters = new Set(activeFilters)
                      if (newFilters.has(filter.key)) {
                        newFilters.delete(filter.key)
                      } else {
                        newFilters.add(filter.key)
                      }
                      setActiveFilters(newFilters)
                    }}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>

              <Separator />

              {/* Allergen Filters */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Alergeni koje trebate izbjeći</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(allergenInfo).map(([code, info]) => (
                    <div key={code} className="flex items-center gap-2">
                      <Checkbox
                        id={`allergen-${code}`}
                        checked={selectedAllergens.has(code)}
                        onCheckedChange={(checked) => {
                          const newAllergens = new Set(selectedAllergens)
                          if (checked) {
                            newAllergens.add(code)
                          } else {
                            newAllergens.delete(code)
                          }
                          setSelectedAllergens(newAllergens)
                        }}
                      />
                      <label 
                        htmlFor={`allergen-${code}`} 
                        className="flex items-center gap-1 cursor-pointer text-xs"
                      >
                        <span className="text-sm">{info.icon}</span>
                        <span>{info.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>

    {/* Secondary Controls */}
    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t">
      {/* Week View Toggle */}
      <Button 
        onClick={() => setShowWeekView(!showWeekView)} 
        variant="outline" 
        size="sm"
        className="flex-shrink-0"
      >
        {showWeekView ? 'Sakrij' : 'Prikaži'} tjedni pregled
      </Button>

      {/* Active Filters Summary */}
      {(selectedAllergens.size > 0 || activeFilters.size > 0) && (
        <div className="flex flex-wrap gap-1 items-center text-xs text-muted-foreground">
          <span>Aktivni filteri:</span>
          {Array.from(activeFilters).map(filter => (
            <Badge key={filter} variant="secondary" className="text-xs">
              {filter === 'vegetarian' && '🌱 Vegetarijanski'}
              {filter === 'price-low' && '💰 Do 1€'}
              {filter === 'price-medium' && '💰💰 1-2€'}
              {filter === 'popular' && '🔥 Popularno'}
            </Badge>
          ))}
          {Array.from(selectedAllergens).map(allergen => (
            <Badge key={allergen} variant="destructive" className="text-xs">
              {allergenInfo[allergen as keyof typeof allergenInfo]?.icon} {allergenInfo[allergen as keyof typeof allergenInfo]?.name}
            </Badge>
          ))}
        </div>
      )}
    </div>

    {/* Weekly Navigation - Collapsible */}
    {showWeekView && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-2 pt-2 border-t"
      >
        <h4 className="text-sm font-medium">Odaberite dan u tjednu:</h4>
        <div className="flex gap-2 overflow-x-auto py-2">
          {weekDays.map((day, index) => (
            <Button
              key={index}
              variant={isSameDay(day, selectedDate) ? "default" : "outline"}
              className={`min-w-28 flex-shrink-0 ${isToday(day) ? 'ring-2 ring-green-500' : ''}`}
              onClick={() => setSelectedDate(day)}
              size="sm"
            >
              <div className="text-center">
                <div className="text-xs font-medium">
                  {format(day, 'EEE', { locale: hr })}
                </div>
                <div className="text-xs opacity-70">
                  {format(day, 'd/M')}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </motion.div>
    )}
  </CardContent>
</Card>

            {/* Statistics */}
            {menuData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{statistics.totalItems}</div>
                      <div className="text-sm text-muted-foreground">Ukupno jela</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{statistics.vegItems}</div>
                      <div className="text-sm text-muted-foreground">Vegetarijanska</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{statistics.avgPrice.toFixed(2)}€</div>
                      <div className="text-sm text-muted-foreground">Prosječna cijena</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{statistics.restaurantsCount}</div>
                      <div className="text-sm text-muted-foreground">Restorani</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p className="text-muted-foreground">Učitavanje jelovnika...</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error State */}
            {!loading && menuData.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <img src="/assets/images/Logo_transparent_2.png" alt="No Data" width={150} height={150} className="mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground">Jelovnik nije dostupan za odabrani datum.</p>
                  <p className="text-sm text-muted-foreground mt-2">Molimo pokušajte s drugim datumom ili restoranom.</p>
                </CardContent>
              </Card>
            )}

            {/* Allergen Legend */}
            <Card>
              <CardHeader>
                <CardTitle>Vodič za Alergene</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-sm">
                  {Object.entries(allergenInfo).map(([code, info]) => (
                    <div key={code} className="flex items-center gap-2">
                      <Badge variant="secondary" className={info.color}>
                        {info.icon}
                      </Badge>
                      <span className="text-muted-foreground">{code} - {info.name}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">* označava moguće tragove</p>
              </CardContent>
            </Card>

            {/* Menu Content */}
            <AnimatePresence>
              {filteredMenuData.map((restaurant, index) => (
                <motion.div
                  key={restaurant.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card>
                    <CardHeader className="bg-stone-100 p-8">
                      
                      <CardTitle>{restaurant.title.rendered}</CardTitle>
                      <CardDescription>
                        Jelovnik za {format(new Date(restaurant.meta.menu_date), 'EEEE, d. MMMM yyyy.', { locale: hr })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      {/* Lunch Section */}
                      {restaurant.meta.menu_products.rucak && (
                        <div className="space-y-6">
                          <h3 className="text-2xl font-light flex items-center gap-2">
                            🍽️ {sectionNames.rucak}
                          </h3>
                          
                          {Object.entries(restaurant.meta.menu_products.rucak).map(([sectionType, items]) => {
                            if (!items || items.length === 0) return null
                            
                            return (
                              <div key={sectionType} className={`space-y-3 ${sectionType === 'vege_menu' ? 'border-l-4 border-green-400 pl-4' : ''}`}>
                                <h4 className="text-lg font-medium flex items-center gap-2">
                                  {sectionType === 'vege_menu' && '🌱'} 
                                  {sectionNames[sectionType as keyof typeof sectionNames]}
                                </h4>
                                <div className="space-y-3">
                                  {items.map((item) => {
                                    const isFavorite = favorites.some(fav => fav.id === item.id)
                                    return (
                                      <div
                                        key={item.id}
                                        className={`flex justify-between items-center p-4 rounded-lg border transition-all hover:shadow-md ${
                                          isFavorite ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200' : 'bg-stone-50 hover:bg-white'
                                        }`}
                                      >
                                        <div className="flex-1 space-y-2">
                                          <div className="flex items-center gap-3">
                                            <h5 className="font-medium">{item.title}</h5>
                                            {settings.showWeights && item.weight && (
                                              <Badge variant="outline" className="text-xs">
                                                {item.weight}g
                                              </Badge>
                                            )}
                                            {sectionType === 'vege_menu' && (
                                              <Badge className="bg-green-100 text-green-800 text-xs">
                                                VEG
                                              </Badge>
                                            )}
                                          </div>
                                          {settings.showAllergens && (
                                            <div className="flex items-center gap-1 flex-wrap">
                                              {formatAllergens(item.allergens)}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                          {settings.showPrices && formatPrice(item.price)}
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => toggleFavorite(item, restaurant.title.rendered)}
                                            className="text-stone-400 hover:text-red-500"
                                          >
                                            <Heart 
                                              className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`}
                                            />
                                          </Button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Dinner Section */}
                      {restaurant.meta.menu_products.vecera && (
                        <div className="space-y-6 mt-8 pt-8 border-t">
                          <h3 className="text-2xl font-light flex items-center gap-2">
                            🌙 {sectionNames.vecera}
                          </h3>
                          
                          {Object.entries(restaurant.meta.menu_products.vecera).map(([sectionType, items]) => {
                            if (!items || items.length === 0) return null
                            
                            return (
                              <div key={sectionType} className={`space-y-3 ${sectionType === 'vege_menu' ? 'border-l-4 border-green-400 pl-4' : ''}`}>
                                <h4 className="text-lg font-medium flex items-center gap-2">
                                  {sectionType === 'vege_menu' && '🌱'} 
                                  {sectionNames[sectionType as keyof typeof sectionNames]}
                                </h4>
                                <div className="space-y-3">
                                  {items.map((item) => {
                                    const isFavorite = favorites.some(fav => fav.id === item.id)
                                    return (
                                      <div
                                        key={item.id}
                                        className={`flex justify-between items-center p-4 rounded-lg border transition-all hover:shadow-md ${
                                          isFavorite ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200' : 'bg-stone-50 hover:bg-white'
                                        }`}
                                      >
                                        <div className="flex-1 space-y-2">
                                          <div className="flex items-center gap-3">
                                            <h5 className="font-medium">{item.title}</h5>
                                            {settings.showWeights && item.weight && (
                                              <Badge variant="outline" className="text-xs">
                                                {item.weight}g
                                              </Badge>
                                            )}
                                            {sectionType === 'vege_menu' && (
                                              <Badge className="bg-green-100 text-green-800 text-xs">
                                                VEG
                                              </Badge>
                                            )}
                                          </div>
                                          {settings.showAllergens && (
                                            <div className="flex items-center gap-1 flex-wrap">
                                              {formatAllergens(item.allergens)}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                          {settings.showPrices && formatPrice(item.price)}
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => toggleFavorite(item, restaurant.title.rendered)}
                                            className="text-stone-400 hover:text-red-500"
                                          >
                                            <Heart 
                                              className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`}
                                            />
                                          </Button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </TabsContent>

          {/* Favorites Tab */}
          <TabsContent value="favorites" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" /> Vaši favoriti
                </CardTitle>
                <CardDescription>
                  Ovdje možete pregledati sva jela koja ste označili kao favorite
                </CardDescription>
              </CardHeader>
              <CardContent>
                {favorites.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="text-6xl mb-4">🍽️</div>
                    <p className="text-lg">Još nemate favorite!</p>
                    <p className="text-sm mt-2">Kliknite na srce pokraj jela da ga dodate u favorite.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-lg border border-red-200">
                        <div className="text-2xl font-bold text-red-700">{favorites.length}</div>
                        <div className="text-sm text-red-600">Ukupno favorita</div>
                      </div>
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                        <div className="text-2xl font-bold text-green-700">
                          {(favorites.reduce((sum, item) => sum + parseFloat(item.price || '0'), 0) / favorites.length).toFixed(2)}€
                        </div>
                        <div className="text-sm text-green-600">Prosjek cijena</div>
                      </div>
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-200">
                        <div className="text-lg font-bold text-blue-700">
                          {Math.min(...favorites.map(f => parseFloat(f.price || '0'))).toFixed(2)}€
                        </div>
                        <div className="text-sm text-blue-600">Najjeftiniji</div>
                      </div>
                      <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-lg border border-purple-200">
                        <div className="text-lg font-bold text-purple-700">
                          {Math.max(...favorites.map(f => parseFloat(f.price || '0'))).toFixed(2)}€
                        </div>
                        <div className="text-sm text-purple-600">Najskuplji</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const sorted = [...favorites].sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
                          setFavorites(sorted)
                        }}
                      >
                        Sortiraj po cijeni
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const sorted = [...favorites].sort((a, b) => a.title.localeCompare(b.title))
                          setFavorites(sorted)
                        }}
                      >
                        Sortiraj po imenu
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const csvContent = [
                            ['Naziv', 'Cijena', 'Alergeni', 'Restoran', 'Datum dodavanja'],
                            ...favorites.map(item => [
                              item.title,
                              item.price,
                              item.allergens || 'Nema',
                              item.restaurant,
                              new Date(item.dateAdded).toLocaleDateString('hr-HR')
                            ])
                          ].map(row => row.join(',')).join('\n')

                          const blob = new Blob([csvContent], { type: 'text/csv' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `favoriti_${format(new Date(), 'yyyy-MM-dd')}.csv`
                          a.click()
                          
                          toast.success('CSV izvoz dovršen!')
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Izvezi CSV
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => {
                          if (confirm('Jeste li sigurni da želite obrisati sve favorite?')) {
                            setFavorites([])
                            toast.success('Svi favoriti su obrisani')
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Obriši sve
                      </Button>
                    </div>

                    {/* Favorites List */}
                    <div className="space-y-3">
                      {favorites.map((item, index) => (
                        <div
                          key={`${item.id}-${item.dateAdded}`}
                          className="flex justify-between items-center p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200"
                        >
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                              <h5 className="font-medium">{item.title}</h5>
                              {item.weight && (
                                <Badge variant="outline" className="text-xs">
                                  {item.weight}g
                                </Badge>
                              )}
                              <Badge className="bg-amber-200 text-amber-800 text-xs">
                                #{index + 1}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {formatAllergens(item.allergens)}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Dodano: {format(new Date(item.dateAdded), 'd.M.yyyy.')}</span>
                              {item.restaurant && <span>Restoran: {item.restaurant}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              {formatPrice(item.price)}
                              <div className="text-xs text-muted-foreground">
                                {parseFloat(item.price) <= 1 ? '🟢 Jeftino' : 
                                 parseFloat(item.price) <= 2 ? '🟡 Umjereno' : '🔴 Skupo'}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setFavorites(prev => prev.filter(fav => fav.id !== item.id || fav.dateAdded !== item.dateAdded))
                                toast.success('Uklonjeno iz favorita')
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Raspodjela cijena</CardTitle>
                </CardHeader>
                <CardContent>
                  {menuData.length > 0 ? (
                    <PriceChart menuData={menuData} />
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      Učitajte jelovnik za prikaz podataka
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top 5 najjeftinijih jela</CardTitle>
                </CardHeader>
                <CardContent>
                  <CheapestItems menuData={menuData} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mjesečni troškovi</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{statistics.monthlyCost.toFixed(0)}€</div>
                    <div className="text-sm text-muted-foreground">Procijenjen mjesečni trošak</div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Temeljeno na prosjeku od 22 radna dana mjesečno
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Favoriti po kategorijama</CardTitle>
                </CardHeader>
                <CardContent>
                  <FavoritesAnalytics favorites={favorites} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" /> Postavke
                </CardTitle>
                <CardDescription>
                  Prilagodite prikaz aplikacije prema vašim potrebama
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">Prikaz</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'showPrices', label: 'Prikaži cijene' },
                      { key: 'showAllergens', label: 'Prikaži alergene' },
                      { key: 'showWeights', label: 'Prikaži težinu jela' },
                      { key: 'compactView', label: 'Kompaktni prikaz' }
                    ].map(setting => (
                      <div key={setting.key} className="flex items-center justify-between">
                        <label htmlFor={setting.key} className="text-sm font-medium">
                          {setting.label}
                        </label>
                        <Switch
                          id={setting.key}
                          checked={settings[setting.key as keyof typeof settings] as boolean}
                          onCheckedChange={(checked) => 
                            setSettings(prev => ({ ...prev, [setting.key]: checked }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-3">Obavještenja</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'dailyNotifications', label: 'Dnevna obavještenja o jelovniku' },
                      { key: 'favoriteNotifications', label: 'Obavještenja kada su favoriti dostupni' }
                    ].map(setting => (
                      <div key={setting.key} className="flex items-center justify-between">
                        <label htmlFor={setting.key} className="text-sm font-medium">
                          {setting.label}
                        </label>
                        <Switch
                          id={setting.key}
                          checked={settings[setting.key as keyof typeof settings] as boolean}
                          onCheckedChange={(checked) => 
                            setSettings(prev => ({ ...prev, [setting.key]: checked }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-3">Podaci</h3>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const dataStr = JSON.stringify(favorites, null, 2)
                        const blob = new Blob([dataStr], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'favoriti.json'
                        a.click()
                        toast.success('Favoriti su izvezeni!')
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Izvezi favorite
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => {
                        if (confirm('Jeste li sigurni da želite obrisati sve podatke? Ova akcija se ne može poništiti.')) {
                          setFavorites([])
                          setSelectedAllergens(new Set())
                          setActiveFilters(new Set())
                          setSearchQuery('')
                          localStorage.clear()
                          toast.success('Svi podaci su obrisani')
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Obriši sve podatke
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// Helper Components
function PriceChart({ menuData }: { menuData: Restaurant[] }) {
  const priceRanges = useMemo(() => {
    const ranges = { '0-1€': 0, '1-2€': 0, '2-3€': 0, '3€+': 0 }
    
    menuData.forEach(restaurant => {
      Object.values(restaurant.meta.menu_products).forEach(mealType => {
        Object.values(mealType as MenuProducts).forEach(items => {
          items?.forEach(item => {
            const price = parseFloat(item.price)
            if (price <= 1) ranges['0-1€']++
            else if (price <= 2) ranges['1-2€']++
            else if (price <= 3) ranges['2-3€']++
            else ranges['3€+']++
          })
        })
      })
    })
    
    return ranges
  }, [menuData])

  const chartData = {
    labels: Object.keys(priceRanges),
    datasets: [{
      data: Object.values(priceRanges),
      backgroundColor: ['#16a34a', '#d97706', '#dc2626', '#7c3aed'],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  }

  return (
    <Doughnut 
      data={chartData} 
      options={{
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }} 
    />
  )
}

function CheapestItems({ menuData }: { menuData: Restaurant[] }) {
  const cheapestItems = useMemo(() => {
    const allItems: Array<MenuItem & { restaurant: string }> = []
    
    menuData.forEach(restaurant => {
      Object.values(restaurant.meta.menu_products).forEach(mealType => {
        Object.values(mealType as MenuProducts).forEach(items => {
          items?.forEach(item => {
            if (item.price) {
              allItems.push({ ...item, restaurant: restaurant.title.rendered })
            }
          })
        })
      })
    })
    
    return allItems.sort((a, b) => parseFloat(a.price) - parseFloat(b.price)).slice(0, 5)
  }, [menuData])

  if (cheapestItems.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Učitajte jelovnik za prikaz podataka
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {cheapestItems.map((item, index) => (
        <div key={`${item.id}-${item.restaurant}`} className={`flex justify-between items-center py-2 ${index < 4 ? 'border-b' : ''}`}>
          <div>
            <div className="font-medium">{item.title}</div>
            <div className="text-sm text-muted-foreground">{item.restaurant}</div>
          </div>
          <div className="font-bold text-green-600">{parseFloat(item.price).toFixed(2)}€</div>
        </div>
      ))}
    </div>
  )
}

function FavoritesAnalytics({ favorites }: { favorites: FavoriteItem[] }) {
  const analytics = useMemo(() => {
    const restaurantCount: Record<string, number> = {}
    const priceRanges = { low: 0, medium: 0, high: 0 }
    
    favorites.forEach(item => {
      restaurantCount[item.restaurant] = (restaurantCount[item.restaurant] || 0) + 1
      
      const price = parseFloat(item.price)
      if (price <= 1) priceRanges.low++
      else if (price <= 2) priceRanges.medium++
      else priceRanges.high++
    })
    
    return { restaurantCount, priceRanges }
  }, [favorites])

  if (favorites.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Nemate favorite za analizu
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2">Po restoranima:</h4>
        <div className="space-y-1">
          {Object.entries(analytics.restaurantCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([restaurant, count]) => (
            <div key={restaurant} className="flex justify-between text-sm">
              <span>{restaurant}</span>
              <Badge variant="secondary">{count}</Badge>
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <h4 className="text-sm font-medium mb-2">Po cijeni:</h4>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Do 1€</span>
            <Badge variant="secondary" className="bg-green-100 text-green-800">{analytics.priceRanges.low}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span>1-2€</span>
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{analytics.priceRanges.medium}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span>Preko 2€</span>
            <Badge variant="secondary" className="bg-red-100 text-red-800">{analytics.priceRanges.high}</Badge>
          </div>
        </div>
      </div>
    </div>
  )
}