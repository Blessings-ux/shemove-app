# Admin & Fleet Management Documentation

## Overview
This module provides high-level oversight of the platform. It is divided into Super Admin capabilities and Fleet Owner tools.

## Admin Features

### 1. Application Oversight
- **User Management**: View and ban/suspend users (drivers or passengers).
- **Verification Queue**: Review driver documents (DL, PSV license, Good Conduct) before activating their accounts.

### 2. Financial Analytics
- **Revenue Dashboard**: Total platform revenue, commission collected, and payouts pending.
- **Dispute Resolution**: Interface for handling refund requests or trip complaints.

## Fleet Owner Features

### 1. Asset Management
- **Vehicle Tracking**: Real-time map view of all vehicles owned by the fleet manager.
- **Driver Assignment**: Assigning specific drivers to vehicles.

### 2. Performance Monitoring
- **Revenue Reports**: Per-vehicle and per-driver earnings reports.
- **Maintenance Logs**: Tracking service intervals and vehicle health.

## Implementation
- **Role-Based Views**: The Dashboard component renders completely different sidebars and stats based on whether `user.role` is `admin` or `fleet_owner`.
- **Data Aggregation**: Uses SQL views or RPC calls to fetch summarized data (sums, counts, averages) efficiently.
