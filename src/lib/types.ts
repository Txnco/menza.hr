// Types
export interface MenuItem {
  id: string
  title: string
  price: string
  allergens: string
  weight?: string
}

export interface MenuProducts {
  menu?: MenuItem[]
  vege_menu?: MenuItem[]
  izbor?: MenuItem[]
  prilozi?: MenuItem[]
}

export interface MealTypes {
  rucak?: MenuProducts
  vecera?: MenuProducts
}

export interface Restaurant {
  id: string
  title: { rendered: string }
  meta: {
    menu_date: string
    menu_products: MealTypes
  }
}

export interface FavoriteItem extends MenuItem {
  restaurant: string
  dateAdded: string
}
