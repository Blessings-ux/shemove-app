# Driver Features Documentation

## Overview
The Driver interface is designed to optimize efficiency and earnings. It provides real-time ride requests, navigation assistance, and financial tracking.

## Features

### 1. Driver Dashboard
- **Status Toggle**: Drivers can switch between "Online" (available for rides) and "Offline".
- **Real-time Requests**: Incoming ride requests appear as cards/modals with:
    - Passenger Name & Rating.
    - Pickup & Dropoff locations.
    - Estimated Fare.

### 2. Trip Management
- **Accept/Decline**: Fast-response buttons to claim a trip.
- **Navigation**: Integration with external maps (Google Maps/Waze) for turn-by-turn directions.
- **Trip Stages**:
    - `Arrived at Pickup`
    - `Start Trip`
    - `End Trip`

### 3. Earnings & Wallet
- **Daily/Weekly Summaries**: Charts showing income over time.
- **Transaction History**: Detailed list of completed trips and their payments.
- **M-Pesa Integration**: Direct payout to the driver's M-Pesa number.

## Implementation
- **Realtime Subscriptions**: The dashboard subscribes to the `rides` table filtering for `status = 'requested'` within a specific radius.
- **State Management**: Complex local state handles the active trip flow to ensure the app recovers correctly if closed and reopened during a trip.
