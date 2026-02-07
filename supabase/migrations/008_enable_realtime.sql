-- RUN THIS IN SUPABASE SQL EDITOR
-- This enables real-time updates for ride requests to reach drivers

-- 1. Enable realtime for the rides table
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;

-- 2. Also enable realtime for these tables (if not already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.carpool_offers;

-- 3. Create the get_nearby_drivers function (optional, but recommended)
CREATE OR REPLACE FUNCTION get_nearby_drivers(
  user_lat float, 
  user_long float,
  radius_meters float default 5000
)
RETURNS TABLE (
  driver_id uuid, 
  latitude float, 
  longitude float, 
  dist_meters float,
  vehicle_type text,
  plate_number text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dl.driver_id,
    st_y(dl.location::geometry) as latitude,
    st_x(dl.location::geometry) as longitude,
    st_distance(dl.location, st_point(user_long, user_lat)::geography) as dist_meters,
    d.vehicle_type,
    d.plate_number
  FROM public.driver_locations dl
  JOIN public.drivers d ON d.id = dl.driver_id
  WHERE d.is_online = true
  AND st_dwithin(dl.location, st_point(user_long, user_lat)::geography, radius_meters)
  ORDER BY dist_meters ASC;
END;
$$;

-- Done! After running this, drivers should receive ride requests in real-time.
