// app/api/restaurants/route.ts
import { NextResponse } from 'next/server'

export interface Restaurant {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
}

// Hardcoded restaurants data (will be moved to database later)
const restaurants: Restaurant[] = [
  { id: '0',
    name: "Svi restorani"
  },
  {
    id: '1107',
    name: 'Restoran Savska'
  },
  {
    id: '8015',
    name: 'Stjepan Radić'
  },
  {
    id: '8040',
    name: 'Cvjetno naselje'
  },
  {
    id: '8042',
    name: 'Borongaj'
  },
  {
    id: '6571',
    name: 'Lašćina'
  },
  {
    id: '30822',
    name: 'Gaudeamus'
  },
  {
    id: '18992',
    name: 'Restoran Ekonomskog fakulteta'
  },
  {
    id: '8025',
    name: 'TTF'
  },
  {
    id: '8027',
    name: 'RGNF-PBF'
  },
  {
    id: '8029',
    name: 'Restoran SC-a NSK'
  },
  {
    id: '8031',
    name: 'Restoran na Medicinskom fakultetu'
  },
  {
    id: '8044',
    name: 'Restoran Agronomija i Šumarstvo ZELENI PAVILJON'
  },
  {
    id: '8035',
    name: 'Restoran FILOZOFSKI FAKULTET'
  }
]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    // If specific restaurant ID is requested
    if (id) {
      const restaurant = restaurants.find(r => r.id === id)
      if (!restaurant) {
        return NextResponse.json(
          { error: 'Restaurant not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(restaurant)
    }
    
    // Return all restaurants
    return NextResponse.json({
      restaurants,
      total: restaurants.length
    })
    
  } catch (error) {
    console.error('Error fetching restaurants:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// For future database implementation
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, name } = body
    
    if (!id || !name) {
      return NextResponse.json(
        { error: 'ID and name are required' },
        { status: 400 }
      )
    }
    
    // TODO: Implement database insertion
    // const newRestaurant = await db.restaurant.create({
    //   data: { id, name }
    // })
    
    return NextResponse.json(
      { message: 'Restaurant creation not implemented yet' },
      { status: 501 }
    )
    
  } catch (error) {
    console.error('Error creating restaurant:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}