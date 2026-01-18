# Geolocation and Maps Documentation

## Overview
Mapping and geolocation are central to the JiraniRide experience, enabling real-time driver tracking, route visualization, and location-based searching for rides.

## Features

### 1. Live Tracking
- **Driver**: The driver's app continuously captures their GPS coordinates and updates the database.
- **Passenger**: Subscribes to driver location updates to see the car moving on the map in real-time.

### 2. Geocoding & Reverse Geocoding
- Converts addresses to coordinates (booking) and coordinates to readable addresses (display).
- **Service**: Likely uses OpenStreetMap (Nominatim) or Google Maps Geocoding API.

### 3. Route Calculation
- Draws a polyline between pickup and dropoff points.
- Estimates distance and time for fare calculation.

## Implementation

### Frontend Libraries
- **Leaflet / React-Leaflet**: Used for rendering the interactive map.
- **Tiles**: OpenStreetMap tiles are typically used for the base layer.

### Database (PostGIS)
- Supabase supports PostGIS extensions for efficient spatial queries.
- **Usage**:
    - Finding nearby drivers (`ST_DWithin`).
    - Calculating distances (`ST_Distance`).

### Wake Lock
- For drivers, the application implements a Wake Lock to prevent the phone screen from sleeping/locking while a trip is active, ensuring continuous GPS transmission.

## Challenges & Solutions
- **Battery Drain**: Optimized GPS update intervals (e.g., every 5-10 seconds instead of 1s).
- **Drift**: Client-side smoothing or snapping to roads can improve visual quality.
