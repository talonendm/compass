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

const iconColors = {
  red: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  green: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  blue: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  orange: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png",
  yellow: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png",
  violet: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png",
  grey: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png",
  black: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-black.png"
};

const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";
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
      const lat = parseFloat(row.latitude);
      const lon = parseFloat(row.longitude);
      const color = (row.color || "blue").toLowerCase();
      const iconUrl = iconColors[color] || iconColors.blue;

      const icon = L.icon({
        iconUrl: iconUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: shadowUrl,
        shadowSize: [41, 41],
        shadowAnchor: [12, 41]
      });

      const marker = L.marker([lat, lon], { icon }).addTo(map);

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
