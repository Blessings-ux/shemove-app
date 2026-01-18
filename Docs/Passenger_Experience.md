# Passenger Experience Documentation

## Overview
The Passenger application focuses on ease of use, safety, and reliability. It allows users to quickly find rides, track their driver, and pay securely.

## Features

### 1. Booking Flow
- **Destination Search**: Autocomplete input for finding places.
- **Ride Options**: Selection between different vehicle types (Standard, Premium, Boda) or Carpooling.
- **Fare Estimation**: Upfront pricing displayed before confirmation.

### 2. Carpooling
- **Search**: Passengers can look for existing carpool offers along their route.
- **Cost Saving**: Significantly lower fares by sharing the ride.

### 3. Saved Locations
- **Home & Work**: Quick-access shortcuts for frequent destinations.
- **Recent Places**: History of previously visited locations.

### 4. Safety & tracking
- **Share Ride**: Ability to share live trip status with friends/family.
- **SOS Button**: Emergency contact integration.
- **Driver Info**: License plate, car model, and driver photo displayed clearly.

## Implementation
- **Supabase Realtime**: Used to track the "Assigned Driver" location.
- **Notifications**: System alerts for `Driver Arrived`, `Trip Started`, `Payment Successful`.
