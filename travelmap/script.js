// Base map layers
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
});

const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/' +
  'World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri & contributors'
});

const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
});

const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
});

const topoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
});



// Temporary initial map (will re-center after CSV load)
const map = L.map('map', {
  center: [0, 0],
  zoom: 2,
  layers: [osm]
});

// Add layer switcher
const baseMaps = {
 "OpenStreetMap": osm,
  "Esri Satellite": esriSat,
  "Carto Light": cartoLight,
  "Carto Dark": cartoDark,
  "OpenTopoMap": topoMap
};
L.control.layers(baseMaps).addTo(map);

// Load and display CSV markers
Papa.parse("markers.csv", {
  download: true,
  header: true,
  complete: function(results) {
    const data = results.data.filter(row => row.latitude && row.longitude);
    
    if (data.length > 0) {
      const first = data[0];
      map.setView([parseFloat(first.latitude), parseFloat(first.longitude)], 8);
    }

    data.forEach(row => {
      const marker = L.marker([parseFloat(row.latitude), parseFloat(row.longitude)]).addTo(map);
      const popupContent = `
        <div class="popup-content">
          <strong>${row.title}</strong><br/>
          <p>${row.infotext}</p>
          <button onclick="window.open('${row.link}', '_blank')">More Info</button>
        </div>
      `;
      marker.bindPopup(popupContent);
    });
  }
});

// Locate Me button (one-time location)
document.getElementById('locate-btn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      map.setView([lat, lon], 13);
      L.marker([lat, lon]).addTo(map).bindPopup("📍 You are here").openPopup();
    },
    () => {
      alert("Unable to get location.");
    }
  );
});

// Track Me button (continuous location)
let tracking = false;
let watchId = null;
let userMarker = null;

document.getElementById('track-btn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported.");
    return;
  }

  if (!tracking) {
    watchId = navigator.geolocation.watchPosition(
      position => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        if (userMarker) {
          userMarker.setLatLng([lat, lon]);
        } else {
          userMarker = L.marker([lat, lon]).addTo(map).bindPopup("📍 Tracking...");
        }

        map.setView([lat, lon], 14);
      },
      error => {
        alert("Tracking failed: " + error.message);
      }
    );

    tracking = true;
    document.getElementById('track-btn').textContent = "⏹ Stop Tracking";
  } else {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    tracking = false;
    document.getElementById('track-btn').textContent = "🔄 Track Me";

    if (userMarker) {
      map.removeLayer(userMarker);
      userMarker = null;
    }
  }
});
