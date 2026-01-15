import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import L from 'leaflet';

// Fix Leaflet's default icon path issues in Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

function LocationMarker({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
        map.flyTo(position, map.getZoom());
    }
  }, [position, map]);

  return position === null ? null : (
    <Marker position={position}>
      <Popup>You are here</Popup>
    </Marker>
  );
}

// Component to fit map bounds to route
function RouteFitter({ routeCoordinates }) {
  const map = useMap();
  
  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length > 0) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routeCoordinates, map]);
  
  return null;
}

export default function Map({ center = [-1.286389, 36.817223], zoom = 13, markers = [], routeCoordinates = [], className }) {
    // Default center: Nairobi
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} className={className} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((marker, idx) => (
         <Marker key={idx} position={marker.position}>
             {marker.popup && <Popup>{marker.popup}</Popup>}
         </Marker> 
      ))}
      
      {/* Render Route Polyline */}
      {routeCoordinates && routeCoordinates.length > 0 && (
        <>
          <Polyline 
            positions={routeCoordinates} 
            color="#059669" // Emerald 600
            weight={5} 
            opacity={0.8} 
          />
          <RouteFitter routeCoordinates={routeCoordinates} />
        </>
      )}
    </MapContainer>
  );
}
